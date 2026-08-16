'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { VirtualPersona } from '@/lib/virtualPersonas';

export interface ChatEntry {
  sender: 'user' | 'persona';
  text: string;
  timestamp: string;
  sentiment?: 'flirty' | 'happy' | 'thoughtful' | 'curious' | 'neutral';
}

declare global {
  interface Window {
    __ACTIVE_MEDIA_STREAMS__?: MediaStream[];
  }
}

export function useVirtualCall(persona: VirtualPersona) {
  const [callStatus, setCallStatus] = useState<'connecting' | 'connected' | 'ended'>('connecting');
  const [callDuration, setCallDuration] = useState<number>(0);

  // Media State
  const [isMicMuted, setIsMicMuted] = useState<boolean>(false);
  const [isVideoOff, setIsVideoOff] = useState<boolean>(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  // Conversational State
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [currentCaption, setCurrentCaption] = useState<string>('');
  const [chatHistory, setChatHistory] = useState<ChatEntry[]>([]);
  const [audioLevel, setAudioLevel] = useState<number>(0);

  // Activity & Outfit State
  const [avatarAction, setAvatarAction] = useState<
    | 'idle'
    | 'speaking'
    | 'standing'
    | 'sitting'
    | 'cooking'
    | 'changing_clothes'
    | 'workout'
    | 'wave'
    | 'kiss'
  >('idle');
  const [outfit, setOutfit] = useState<'casual' | 'formal' | 'cozy' | 'sporty'>('casual');

  const localStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const speechDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioAnimationRef = useRef<number | null>(null);
  const accumulatedSpeechRef = useRef<string>('');
  const currentAudioElementRef = useRef<HTMLAudioElement | null>(null);
  
  // Anti-Acoustic Echo State
  const isSpeakingRef = useRef<boolean>(false);
  const lastCompanionSpeechRef = useRef<string>('');
  const lastCompanionSpeechEndRef = useRef<number>(0);

  // Helper to register global streams for foolproof cleanup
  const registerStream = (stream: MediaStream) => {
    if (typeof window !== 'undefined') {
      window.__ACTIVE_MEDIA_STREAMS__ = window.__ACTIVE_MEDIA_STREAMS__ || [];
      window.__ACTIVE_MEDIA_STREAMS__.push(stream);
    }
  };

  // Helper to kill all global active streams
  const killAllMediaTracks = () => {
    if (typeof window !== 'undefined' && window.__ACTIVE_MEDIA_STREAMS__) {
      window.__ACTIVE_MEDIA_STREAMS__.forEach((stream) => {
        try {
          stream.getTracks().forEach((track) => {
            track.stop();
            track.enabled = false;
          });
        } catch (_) {}
      });
      window.__ACTIVE_MEDIA_STREAMS__ = [];
    }
    if (localStreamRef.current) {
      try {
        localStreamRef.current.getTracks().forEach((track) => {
          track.stop();
          track.enabled = false;
        });
      } catch (_) {}
      localStreamRef.current = null;
    }
  };

  // ── 0. LOAD SESSION MEMORY ──────────────────────────────────────────────────
  useEffect(() => {
    try {
      const savedHistory = sessionStorage.getItem(`virtual_session_${persona.id}`);
      if (savedHistory) {
        const parsed = JSON.parse(savedHistory);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setChatHistory(parsed);
        }
      }
    } catch (_) {}
  }, [persona.id]);

  // Persist session history on change
  useEffect(() => {
    if (chatHistory.length > 0) {
      try {
        sessionStorage.setItem(`virtual_session_${persona.id}`, JSON.stringify(chatHistory.slice(-20)));
      } catch (_) {}
    }
  }, [chatHistory, persona.id]);

  // ── 1. INITIALIZE LOCAL CAMERA & MIC ───────────────────────────────────────
  useEffect(() => {
    let isMounted = true;

    async function setupMedia() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        if (isMounted) {
          registerStream(stream);
          localStreamRef.current = stream;
          setLocalStream(stream);
        } else {
          stream.getTracks().forEach((t) => {
            t.stop();
            t.enabled = false;
          });
        }
      } catch (err) {
        console.warn('Could not access camera/mic, fallback active:', err);
      }
    }

    setupMedia();

    return () => {
      isMounted = false;
      killAllMediaTracks();
      if (currentAudioElementRef.current) {
        try {
          currentAudioElementRef.current.pause();
          currentAudioElementRef.current.src = '';
        } catch (_) {}
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
          recognitionRef.current.abort();
        } catch (_) {}
        recognitionRef.current = null;
      }
      if (audioAnimationRef.current) {
        cancelAnimationFrame(audioAnimationRef.current);
      }
      if (speechDebounceTimerRef.current) {
        clearTimeout(speechDebounceTimerRef.current);
      }
    };
  }, []);

  // ── 2. CALL TIMER ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (callStatus === 'connected') {
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callStatus]);

  // ── 3. SPEECH SYNTHESIS (NEURAL TTS WITH WEBSPEECH FALLBACK) ──────────────
  const speakText = useCallback(
    async (text: string) => {
      // 1. HARD-PAUSE speech recognition so speaker audio is NEVER picked up as user input
      isSpeakingRef.current = true;
      lastCompanionSpeechRef.current = text.toLowerCase();
      setIsSpeaking(true);
      setCurrentCaption(text);

      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (_) {}
      }

      // Stop any existing audio element
      if (currentAudioElementRef.current) {
        try {
          currentAudioElementRef.current.pause();
          currentAudioElementRef.current.src = '';
        } catch (_) {}
      }

      // Audio waveform animation during speech
      let frame = 0;
      const animateAudio = () => {
        frame++;
        const wave = Math.abs(Math.sin(frame * 0.22)) * 0.8 + 0.2;
        setAudioLevel(wave);
        audioAnimationRef.current = requestAnimationFrame(animateAudio);
      };
      audioAnimationRef.current = requestAnimationFrame(animateAudio);

      const handleSpeechEnd = () => {
        setIsSpeaking(false);
        setAudioLevel(0);
        if (audioAnimationRef.current) cancelAnimationFrame(audioAnimationRef.current);
        lastCompanionSpeechEndRef.current = Date.now();

        // Wait 450ms for room echo to decay before resuming speech recognition
        setTimeout(() => {
          isSpeakingRef.current = false;
          startListening();
        }, 450);
      };

      // Try Neural TTS API first for human-realistic voice
      try {
        const ttsRes = await fetch('/api/virtual/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            personaId: persona.id,
            language: persona.id === 'ananya-sharma' ? 'hi' : 'en',
          }),
        });

        if (ttsRes.ok) {
          const ttsData = await ttsRes.json();
          if (ttsData.audioUrl) {
            const audio = new Audio(ttsData.audioUrl);
            currentAudioElementRef.current = audio;
            audio.onended = handleSpeechEnd;
            audio.onerror = () => {
              // If neural audio stream errors, fallback to browser speech synthesis
              speakWithWebSpeech(text, handleSpeechEnd);
            };
            await audio.play();
            return;
          }
        }
      } catch (err) {
        console.warn('Neural TTS fetch error, using WebSpeech fallback:', err);
      }

      // Fallback to WebSpeech API
      speakWithWebSpeech(text, handleSpeechEnd);
    },
    [persona]
  );

  const speakWithWebSpeech = (text: string, onEndCallback: () => void) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      onEndCallback();
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.pitch = persona.voiceStyle.pitch;
    utterance.rate = persona.voiceStyle.rate;

    if (persona.id === 'ananya-sharma') {
      utterance.lang = 'hi-IN';
    } else {
      utterance.lang = 'en-US';
    }

    const voices = window.speechSynthesis.getVoices();
    if (persona.voiceStyle.preferredVoiceNames && voices.length > 0) {
      const found = voices.find((v) =>
        persona.voiceStyle.preferredVoiceNames?.some((pref) =>
          v.name.toLowerCase().includes(pref.toLowerCase())
        )
      );
      if (found) {
        utterance.voice = found;
      } else if (persona.id === 'ananya-sharma') {
        const indianVoice = voices.find(
          (v) => v.lang.includes('hi') || v.lang.includes('IN') || v.name.toLowerCase().includes('india')
        );
        if (indianVoice) utterance.voice = indianVoice;
      }
    }

    utterance.onend = onEndCallback;
    utterance.onerror = onEndCallback;
    window.speechSynthesis.speak(utterance);
  };

  // ── 4. MANUAL ACTIONS DOCK ─────────────────────────────────────────────────
  const triggerAction = useCallback(
    (
      newAction:
        | 'idle'
        | 'speaking'
        | 'standing'
        | 'sitting'
        | 'cooking'
        | 'changing_clothes'
        | 'workout'
        | 'wave'
        | 'kiss',
      duration = 8000
    ) => {
      setAvatarAction(newAction);
      if (newAction !== 'standing' && newAction !== 'sitting' && newAction !== 'idle') {
        setTimeout(() => {
          setAvatarAction('idle');
        }, duration);
      }
    },
    []
  );

  // ── 5. SEND MESSAGE TO AI BACKEND (WITH AVAILABLE ACTIONS LIST) ────────────
  const sendUserMessage = useCallback(
    async (messageText: string) => {
      if (!messageText.trim() || isProcessing) return;

      const cleanedText = messageText.trim();
      const userEntry: ChatEntry = {
        sender: 'user',
        text: cleanedText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setChatHistory((prev) => [...prev, userEntry]);
      setCurrentCaption(`You: "${cleanedText}"`);
      setIsProcessing(true);

      // Pause speech recognition while AI thinks & responds
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (_) {}
      }

      // Collect available actions from persona
      const availableActions = Object.keys(persona.videoClips || {}).concat([
        'idle', 'speaking', 'standing', 'coffee', 'kiss', 'wave', 'workout', 'laugh'
      ]);

      try {
        const res = await fetch('/api/virtual/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            personaId: persona.id,
            message: cleanedText,
            availableActions,
            conversationHistory: [...chatHistory, userEntry].slice(-16).map((c) => ({
              role: c.sender === 'user' ? 'user' : 'assistant',
              content: c.text,
            })),
          }),
        });

        const data = await res.json();
        const replyText = data.reply || "I'm so glad we are talking right now, tell me more!";

        // Trigger AI Decided Action (e.g. standing, coffee, kiss, wave, workout)
        if (data.action && data.action !== 'idle') {
          const actionMap: any = {
            coffee: 'cooking',
            cooking: 'cooking',
            kiss: 'kiss',
            wave: 'wave',
            workout: 'workout',
            standing: 'standing',
            laugh: 'speaking',
          };
          triggerAction(actionMap[data.action] || data.action, 8000);
        }

        const companionEntry: ChatEntry = {
          sender: 'persona',
          text: replyText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        setChatHistory((prev) => [...prev, companionEntry]);
        setIsProcessing(false);
        speakText(replyText);
      } catch (err) {
        console.error('Failed to get companion reply:', err);
        setIsProcessing(false);
        speakText("You have such a wonderful way with words. Tell me more about that!");
      }
    },
    [chatHistory, isProcessing, persona, speakText, triggerAction]
  );

  // ── 6. ROBUST SPEECH RECOGNITION (ANTI-FEEDBACK ECHO FILTER) ──────────────
  const startListening = useCallback(() => {
    if (typeof window === 'undefined' || isMicMuted || isSpeakingRef.current) return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (_) {}
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = persona.id === 'ananya-sharma' ? 'en-IN' : 'en-US';

      recognition.onstart = () => {
        if (!isSpeakingRef.current) {
          setIsListening(true);
          accumulatedSpeechRef.current = '';
        }
      };

      recognition.onresult = (event: any) => {
        // Discard any audio if companion is currently speaking or just finished (<400ms)
        if (isSpeakingRef.current || Date.now() - lastCompanionSpeechEndRef.current < 400) {
          return;
        }

        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }

        const currentHeard = (finalTranscript || interimTranscript).trim();
        if (currentHeard) {
          // Acoustic echo filter: if the heard text is just a repeat of what the companion said, ignore it!
          const lowerHeard = currentHeard.toLowerCase();
          if (
            lastCompanionSpeechRef.current &&
            (lastCompanionSpeechRef.current.includes(lowerHeard) || lowerHeard.includes(lastCompanionSpeechRef.current)) &&
            lowerHeard.length > 8
          ) {
            return; // Reject echo
          }

          accumulatedSpeechRef.current = currentHeard;
          setCurrentCaption(`Listening: "${currentHeard}"`);

          // Debounce: when user pauses for 1.3s after speaking, send the message
          if (speechDebounceTimerRef.current) clearTimeout(speechDebounceTimerRef.current);
          speechDebounceTimerRef.current = setTimeout(() => {
            const textToSend = accumulatedSpeechRef.current.trim();
            if (textToSend && textToSend.length > 1 && !isSpeakingRef.current) {
              accumulatedSpeechRef.current = '';
              sendUserMessage(textToSend);
            }
          }, 1300);
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          console.warn('Speech recognition error:', event.error);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        // Automatically restart listening if call is active and companion is not speaking
        if (!isMicMuted && !isSpeakingRef.current && callStatus !== 'ended') {
          setTimeout(() => {
            if (!isMicMuted && !isSpeakingRef.current) {
              startListening();
            }
          }, 300);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn('Failed to start speech recognition:', err);
    }
  }, [callStatus, isMicMuted, persona.id, sendUserMessage]);

  // ── 7. INITIAL GREETING ON CONNECT ─────────────────────────────────────────
  useEffect(() => {
    const greetingTimer = setTimeout(() => {
      setCallStatus('connected');
      if (chatHistory.length === 0) {
        const greetingEntry: ChatEntry = {
          sender: 'persona',
          text: persona.greeting,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setChatHistory([greetingEntry]);
        speakText(persona.greeting);
      } else {
        startListening();
      }
    }, 1500);

    return () => clearTimeout(greetingTimer);
  }, []);

  const cycleOutfit = useCallback(() => {
    setAvatarAction('changing_clothes');
    setTimeout(() => {
      setOutfit((prev) => {
        if (prev === 'casual') return 'formal';
        if (prev === 'formal') return 'cozy';
        if (prev === 'cozy') return 'sporty';
        return 'casual';
      });
      setAvatarAction('idle');
    }, 1200);
  }, []);

  // ── 8. CONTROLS (MUTE / VIDEO TOGGLE / HANGUP) ─────────────────────────────
  const toggleMic = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = isMicMuted));
    }
    if (!isMicMuted && recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (_) {}
    } else if (isMicMuted) {
      startListening();
    }
    setIsMicMuted((prev) => !prev);
  }, [isMicMuted, startListening]);

  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((t) => (t.enabled = isVideoOff));
    }
    setIsVideoOff((prev) => !prev);
  }, [isVideoOff]);

  const endCall = useCallback(() => {
    if (currentAudioElementRef.current) {
      try {
        currentAudioElementRef.current.pause();
        currentAudioElementRef.current.src = '';
      } catch (_) {}
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.pause();
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        recognitionRef.current.abort();
      } catch (_) {}
      recognitionRef.current = null;
    }
    killAllMediaTracks();
    setLocalStream(null);

    if (audioAnimationRef.current) {
      cancelAnimationFrame(audioAnimationRef.current);
      audioAnimationRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (speechDebounceTimerRef.current) {
      clearTimeout(speechDebounceTimerRef.current);
    }
    isSpeakingRef.current = false;
    setIsSpeaking(false);
    setIsListening(false);
    setIsProcessing(false);
    setAudioLevel(0);
    setCallStatus('ended');
  }, []);

  return {
    callStatus,
    callDuration,
    isMicMuted,
    isVideoOff,
    isListening,
    isProcessing,
    isSpeaking,
    audioLevel,
    currentCaption,
    chatHistory,
    localStream,
    avatarAction,
    outfit,
    triggerAction,
    cycleOutfit,
    toggleMic,
    toggleVideo,
    endCall,
    sendUserMessage,
  };
}
