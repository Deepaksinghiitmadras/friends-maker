'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { VirtualPersona, getAvailableVideoActions } from '@/lib/virtualPersonas';

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

export type AvatarActionType =
  | 'idle'
  | 'speaking'
  | 'standing'
  | 'sitting'
  | 'coffee'
  | 'cooking'
  | 'changing_clothes'
  | 'workout'
  | 'wave'
  | 'kiss'
  | 'laugh'
  | 'blush'
  | 'cheers'
  | 'cozy'
  | 'lean_in'
  | 'thinking'
  | 'hair_flip'
  | 'wink'
  | 'heart_hands'
  | 'phone';

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

  // Video Action State
  const [avatarAction, setAvatarAction] = useState<AvatarActionType>('idle');
  const [outfit, setOutfit] = useState<'casual' | 'formal' | 'cozy' | 'sporty'>('casual');

  // Stable Refs to prevent ANY stale closure problems across turns
  const localStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const speechDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioAnimationRef = useRef<number | null>(null);
  const accumulatedSpeechRef = useRef<string>('');
  const currentAudioElementRef = useRef<HTMLAudioElement | null>(null);
  const actionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isSpeakingRef = useRef<boolean>(false);
  const isProcessingRef = useRef<boolean>(false);
  const isMicMutedRef = useRef<boolean>(false);
  const chatHistoryRef = useRef<ChatEntry[]>([]);
  const lastCompanionSpeechRef = useRef<string>('');
  const lastCompanionSpeechEndRef = useRef<number>(0);
  const currentExplicitActionRef = useRef<string | null>(null);

  // Forward references to break circular dependency and ensure always latest logic
  const startListeningRef = useRef<() => void>(() => {});
  const sendUserMessageRef = useRef<(text: string) => Promise<void>>(async () => {});

  // Keep chatHistoryRef synced
  useEffect(() => {
    chatHistoryRef.current = chatHistory;
  }, [chatHistory]);

  useEffect(() => {
    isMicMutedRef.current = isMicMuted;
  }, [isMicMuted]);

  // ── HELPERS ───────────────────────────────────────────────────────────────────

  const registerStream = (stream: MediaStream) => {
    if (typeof window !== 'undefined') {
      window.__ACTIVE_MEDIA_STREAMS__ = window.__ACTIVE_MEDIA_STREAMS__ || [];
      window.__ACTIVE_MEDIA_STREAMS__.push(stream);
    }
  };

  const killAllMediaTracks = () => {
    if (typeof window !== 'undefined' && window.__ACTIVE_MEDIA_STREAMS__) {
      window.__ACTIVE_MEDIA_STREAMS__.forEach((stream) => {
        try {
          stream.getTracks().forEach((t) => {
            t.stop();
            t.enabled = false;
          });
        } catch (_) {}
      });
      window.__ACTIVE_MEDIA_STREAMS__ = [];
    }
    if (localStreamRef.current) {
      try {
        localStreamRef.current.getTracks().forEach((t) => {
          t.stop();
          t.enabled = false;
        });
      } catch (_) {}
      localStreamRef.current = null;
    }
  };

  // ── 0. SESSION MEMORY ─────────────────────────────────────────────────────────

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(`virtual_session_${persona.id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setChatHistory(parsed);
          chatHistoryRef.current = parsed;
        }
      }
    } catch (_) {}
  }, [persona.id]);

  useEffect(() => {
    if (chatHistory.length > 0) {
      try {
        sessionStorage.setItem(`virtual_session_${persona.id}`, JSON.stringify(chatHistory.slice(-20)));
      } catch (_) {}
    }
  }, [chatHistory, persona.id]);

  // ── 1. CAMERA & MIC SETUP ────────────────────────────────────────────────────

  useEffect(() => {
    let isMounted = true;

    async function setupMedia() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
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
        console.warn('Could not access camera/mic:', err);
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
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
          recognitionRef.current.abort();
        } catch (_) {}
        recognitionRef.current = null;
      }
      if (audioAnimationRef.current) cancelAnimationFrame(audioAnimationRef.current);
      if (speechDebounceTimerRef.current) clearTimeout(speechDebounceTimerRef.current);
      if (actionTimeoutRef.current) clearTimeout(actionTimeoutRef.current);
    };
  }, []);

  // ── 2. CALL TIMER ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (callStatus === 'connected') {
      timerRef.current = setInterval(() => setCallDuration((p) => p + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callStatus]);

  // ── 3. SPEAK TEXT (NEURAL TTS + WEBSPEECH FALLBACK) ───────────────────────────

  const speakText = useCallback(
    async (text: string, explicitAction?: string) => {
      isSpeakingRef.current = true;
      lastCompanionSpeechRef.current = text.toLowerCase();
      setIsSpeaking(true);
      setCurrentCaption(text);

      // Set video action
      if (!explicitAction || explicitAction === 'speaking' || explicitAction === 'idle') {
        setAvatarAction('speaking');
        currentExplicitActionRef.current = null;
      } else {
        currentExplicitActionRef.current = explicitAction;
        setAvatarAction(explicitAction as AvatarActionType);
      }

      // Stop speech recognition while companion speaks
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (_) {}
      }

      // Stop any existing audio
      if (currentAudioElementRef.current) {
        try {
          currentAudioElementRef.current.pause();
          currentAudioElementRef.current.src = '';
        } catch (_) {}
      }

      // Animate audio waveform
      let frame = 0;
      const animateAudio = () => {
        frame++;
        setAudioLevel(Math.abs(Math.sin(frame * 0.22)) * 0.8 + 0.2);
        audioAnimationRef.current = requestAnimationFrame(animateAudio);
      };
      audioAnimationRef.current = requestAnimationFrame(animateAudio);

      const handleSpeechEnd = () => {
        setIsSpeaking(false);
        isSpeakingRef.current = false;
        setAudioLevel(0);
        if (audioAnimationRef.current) cancelAnimationFrame(audioAnimationRef.current);
        lastCompanionSpeechEndRef.current = Date.now();

        // Reset video to idle
        if (currentExplicitActionRef.current) {
          setTimeout(() => {
            setAvatarAction('idle');
            currentExplicitActionRef.current = null;
          }, 2500);
        } else {
          setAvatarAction('idle');
        }

        // Clear subtitle after 2 seconds
        setTimeout(() => {
          if (!isSpeakingRef.current) setCurrentCaption('');
        }, 2000);

        // Resume listening automatically after echo decays
        setTimeout(() => {
          if (!isSpeakingRef.current && !isMicMutedRef.current) {
            startListeningRef.current();
          }
        }, 400);
      };

      // Try Neural TTS API first (proxied audio/mpeg binary stream)
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

        if (ttsRes.ok && ttsRes.headers.get('content-type')?.includes('audio')) {
          const audioBlob = await ttsRes.blob();
          const blobUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(blobUrl);
          currentAudioElementRef.current = audio;

          audio.onended = () => {
            URL.revokeObjectURL(blobUrl);
            handleSpeechEnd();
          };
          audio.onerror = () => {
            URL.revokeObjectURL(blobUrl);
            speakWithWebSpeech(text, handleSpeechEnd);
          };

          await audio.play();
          return;
        }
      } catch (err) {
        console.warn('[TTS] Neural TTS playback error, falling back to WebSpeech:', err);
      }

      speakWithWebSpeech(text, handleSpeechEnd);
    },
    [persona]
  );

  const speakWithWebSpeech = (text: string, onEnd: () => void) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      onEnd();
      return;
    }

    window.speechSynthesis.cancel();

    const doSpeak = () => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.pitch = persona.voiceStyle.pitch;
      utterance.rate = persona.voiceStyle.rate;
      utterance.lang = persona.id === 'ananya-sharma' ? 'hi-IN' : 'en-US';

      const voices = window.speechSynthesis.getVoices();
      if (persona.voiceStyle.preferredVoiceNames && voices.length > 0) {
        const found = voices.find((v) =>
          persona.voiceStyle.preferredVoiceNames?.some((pref) =>
            v.name.toLowerCase().includes(pref.toLowerCase())
          )
        );
        if (found) utterance.voice = found;
        else if (persona.id === 'ananya-sharma') {
          const iv = voices.find((v) => v.lang.includes('hi') || v.lang.includes('IN'));
          if (iv) utterance.voice = iv;
        }
      }

      utterance.onend = onEnd;
      utterance.onerror = onEnd;
      window.speechSynthesis.speak(utterance);
    };

    const voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.onvoiceschanged = null;
        doSpeak();
      };
      setTimeout(() => doSpeak(), 400);
    } else {
      doSpeak();
    }
  };

  // ── 4. MANUAL ACTION BUTTONS ──────────────────────────────────────────────────

  const triggerAction = useCallback((newAction: AvatarActionType, duration = 8000) => {
    if (actionTimeoutRef.current) clearTimeout(actionTimeoutRef.current);
    setAvatarAction(newAction);

    if (newAction !== 'idle' && newAction !== 'speaking') {
      actionTimeoutRef.current = setTimeout(() => {
        setAvatarAction((current) => (current === newAction ? 'idle' : current));
      }, duration);
    }
  }, []);

  // ── 5. SEND MESSAGE (FULL REFS — ZERO STALE CLOSURES) ─────────────────────────

  const sendUserMessage = useCallback(
    async (messageText: string) => {
      if (!messageText || !messageText.trim() || isProcessingRef.current) return;

      const cleanedText = messageText.trim();
      const userEntry: ChatEntry = {
        sender: 'user',
        text: cleanedText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      const updatedHistory = [...chatHistoryRef.current, userEntry];
      setChatHistory(updatedHistory);
      chatHistoryRef.current = updatedHistory;

      setCurrentCaption(`You: "${cleanedText}"`);
      setIsProcessing(true);
      isProcessingRef.current = true;

      // Pause recognition while AI processes
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (_) {}
      }

      try {
        const res = await fetch('/api/virtual/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            personaId: persona.id,
            message: cleanedText,
            conversationHistory: updatedHistory.slice(-16).map((c) => ({
              role: c.sender === 'user' ? 'user' : 'assistant',
              content: c.text,
            })),
          }),
        });

        const data = await res.json();
        const replyText = data.reply || "I'm so glad we are talking right now, tell me more!";
        const aiAction = data.action || 'speaking';

        // Set action immediately
        if (aiAction !== 'idle' && aiAction !== 'speaking') {
          if (actionTimeoutRef.current) clearTimeout(actionTimeoutRef.current);
          setAvatarAction(aiAction as AvatarActionType);
        } else {
          setAvatarAction('speaking');
        }

        const companionEntry: ChatEntry = {
          sender: 'persona',
          text: replyText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        const finalHistory = [...updatedHistory, companionEntry];
        setChatHistory(finalHistory);
        chatHistoryRef.current = finalHistory;

        setIsProcessing(false);
        isProcessingRef.current = false;

        speakText(replyText, aiAction);
      } catch (err) {
        console.error('Failed to get companion reply:', err);
        setIsProcessing(false);
        isProcessingRef.current = false;
        speakText("You have such a wonderful way with words. Tell me more about that!", 'speaking');
      }
    },
    [persona, speakText]
  );

  useEffect(() => {
    sendUserMessageRef.current = sendUserMessage;
  }, [sendUserMessage]);

  // ── 6. SPEECH RECOGNITION (ANTI-ECHO & AUTO-RESTART) ──────────────────────────

  const startListening = useCallback(() => {
    if (typeof window === 'undefined' || isMicMutedRef.current || isSpeakingRef.current) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
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
        if (isSpeakingRef.current || Date.now() - lastCompanionSpeechEndRef.current < 400) return;

        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) finalTranscript += transcript + ' ';
          else interimTranscript += transcript;
        }

        const currentHeard = (finalTranscript || interimTranscript).trim();
        if (currentHeard) {
          // Acoustic echo filter
          const lowerHeard = currentHeard.toLowerCase();
          if (
            lastCompanionSpeechRef.current &&
            (lastCompanionSpeechRef.current.includes(lowerHeard) ||
              lowerHeard.includes(lastCompanionSpeechRef.current)) &&
            lowerHeard.length > 8
          ) {
            return;
          }

          accumulatedSpeechRef.current = currentHeard;
          setCurrentCaption(`Listening: "${currentHeard}"`);

          // Debounce: send message after 1.2s pause in speech
          if (speechDebounceTimerRef.current) clearTimeout(speechDebounceTimerRef.current);
          speechDebounceTimerRef.current = setTimeout(() => {
            const textToSend = accumulatedSpeechRef.current.trim();
            if (textToSend && textToSend.length > 1 && !isSpeakingRef.current && !isProcessingRef.current) {
              accumulatedSpeechRef.current = '';
              sendUserMessageRef.current(textToSend);
            }
          }, 1200);
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
        // Automatically restart speech recognition whenever silent and call is active
        if (!isMicMutedRef.current && !isSpeakingRef.current && callStatus !== 'ended') {
          setTimeout(() => {
            if (!isMicMutedRef.current && !isSpeakingRef.current) {
              startListeningRef.current();
            }
          }, 300);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn('Failed to start speech recognition:', err);
    }
  }, [callStatus, persona.id]);

  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

  // ── 7. INITIAL GREETING ───────────────────────────────────────────────────────

  useEffect(() => {
    const greetingTimer = setTimeout(() => {
      setCallStatus('connected');
      if (chatHistoryRef.current.length === 0) {
        const greetingEntry: ChatEntry = {
          sender: 'persona',
          text: persona.greeting,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setChatHistory([greetingEntry]);
        chatHistoryRef.current = [greetingEntry];
        speakText(persona.greeting, 'speaking');
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

  // ── 8. CONTROLS ───────────────────────────────────────────────────────────────

  const toggleMic = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = isMicMuted));
    }
    if (!isMicMuted && recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (_) {}
    } else if (isMicMuted) {
      startListeningRef.current();
    }
    setIsMicMuted((prev) => !prev);
  }, [isMicMuted]);

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
    if (speechDebounceTimerRef.current) clearTimeout(speechDebounceTimerRef.current);
    if (actionTimeoutRef.current) clearTimeout(actionTimeoutRef.current);
    isSpeakingRef.current = false;
    isProcessingRef.current = false;
    setIsSpeaking(false);
    setIsListening(false);
    setIsProcessing(false);
    setAudioLevel(0);
    setAvatarAction('idle');
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
