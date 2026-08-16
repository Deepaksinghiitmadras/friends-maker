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

// All possible avatar action types
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

  // Video Action State — THIS is what drives VirtualAvatarCanvas
  const [avatarAction, setAvatarAction] = useState<AvatarActionType>('idle');
  const [outfit, setOutfit] = useState<'casual' | 'formal' | 'cozy' | 'sporty'>('casual');

  const localStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const speechDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioAnimationRef = useRef<number | null>(null);
  const accumulatedSpeechRef = useRef<string>('');
  const currentAudioElementRef = useRef<HTMLAudioElement | null>(null);
  const actionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Anti-Acoustic Echo State
  const isSpeakingRef = useRef<boolean>(false);
  const lastCompanionSpeechRef = useRef<string>('');
  const lastCompanionSpeechEndRef = useRef<number>(0);
  // Track the "explicit" action the AI chose (not speaking)
  const currentExplicitActionRef = useRef<string | null>(null);
  // Ref to break circular dependency: speakText → startListening → sendUserMessage → speakText
  const startListeningRef = useRef<() => void>(() => {});

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
        try { stream.getTracks().forEach((t) => { t.stop(); t.enabled = false; }); } catch (_) {}
      });
      window.__ACTIVE_MEDIA_STREAMS__ = [];
    }
    if (localStreamRef.current) {
      try { localStreamRef.current.getTracks().forEach((t) => { t.stop(); t.enabled = false; }); } catch (_) {}
      localStreamRef.current = null;
    }
  };

  // ── 0. SESSION MEMORY ─────────────────────────────────────────────────────────

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(`virtual_session_${persona.id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) setChatHistory(parsed);
      }
    } catch (_) {}
  }, [persona.id]);

  useEffect(() => {
    if (chatHistory.length > 0) {
      try { sessionStorage.setItem(`virtual_session_${persona.id}`, JSON.stringify(chatHistory.slice(-20))); } catch (_) {}
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
          stream.getTracks().forEach((t) => { t.stop(); t.enabled = false; });
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
        try { currentAudioElementRef.current.pause(); currentAudioElementRef.current.src = ''; } catch (_) {}
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); recognitionRef.current.abort(); } catch (_) {}
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
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [callStatus]);

  // ── 3. SPEAK TEXT (NEURAL TTS + WEBSPEECH FALLBACK) ───────────────────────────
  //
  // KEY SYNC LOGIC:
  //   1. When speakText is called, we set isSpeaking=true
  //   2. If there's an explicit action (e.g. "standing"), avatarAction stays as that action
  //   3. If there's NO explicit action, avatarAction is set to "speaking"
  //   4. When speech ends, avatarAction resets to "idle"

  const speakText = useCallback(
    async (text: string, explicitAction?: string) => {
      isSpeakingRef.current = true;
      lastCompanionSpeechRef.current = text.toLowerCase();
      setIsSpeaking(true);
      setCurrentCaption(text);

      // Set the video action:
      // - If there's an explicit action (standing, coffee, kiss etc.), keep it
      // - Otherwise switch to "speaking" video
      if (!explicitAction || explicitAction === 'speaking' || explicitAction === 'idle') {
        setAvatarAction('speaking');
        currentExplicitActionRef.current = null;
      } else {
        // Explicit action already set by sendUserMessage - keep it
        currentExplicitActionRef.current = explicitAction;
      }

      // Stop recognition while speaking
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (_) {}
      }

      // Stop any existing audio
      if (currentAudioElementRef.current) {
        try { currentAudioElementRef.current.pause(); currentAudioElementRef.current.src = ''; } catch (_) {}
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
        setAudioLevel(0);
        if (audioAnimationRef.current) cancelAnimationFrame(audioAnimationRef.current);
        lastCompanionSpeechEndRef.current = Date.now();

        // Reset video to idle after speech ends
        // If there was an explicit action, keep it for 2 more seconds then go idle
        if (currentExplicitActionRef.current) {
          setTimeout(() => {
            setAvatarAction('idle');
            currentExplicitActionRef.current = null;
          }, 2000);
        } else {
          setAvatarAction('idle');
        }

        // Clear subtitle after 2.5s
        setTimeout(() => {
          if (!isSpeakingRef.current) setCurrentCaption('');
        }, 2500);

        // Resume listening after echo decay
        setTimeout(() => {
          isSpeakingRef.current = false;
          startListeningRef.current();
        }, 450);
      };

      // Try Neural TTS API first (returns proxied audio/mpeg binary stream)
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
          // Server proxied the audio — create a local blob URL
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
            console.warn('[TTS] Audio blob playback failed, falling back to WebSpeech');
            speakWithWebSpeech(text, handleSpeechEnd);
          };
          await audio.play();
          return;
        } else {
          console.warn('[TTS] Server returned non-audio response, using WebSpeech');
        }
      } catch (err) {
        console.warn('[TTS] Neural TTS error, falling back to WebSpeech:', err);
      }

      speakWithWebSpeech(text, handleSpeechEnd);
    },
    [persona]
  );

  const speakWithWebSpeech = (text: string, onEnd: () => void) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) { onEnd(); return; }

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
      utterance.onerror = () => {
        console.warn('[WebSpeech] Utterance error, ending speech');
        onEnd();
      };
      window.speechSynthesis.speak(utterance);

      // Chrome bug workaround: speechSynthesis pauses after ~15s
      // Periodically resume to prevent stalling
      const resumeInterval = setInterval(() => {
        if (!window.speechSynthesis.speaking) {
          clearInterval(resumeInterval);
        } else {
          window.speechSynthesis.resume();
        }
      }, 5000);
      utterance.onend = () => {
        clearInterval(resumeInterval);
        onEnd();
      };
    };

    // Voices might not be loaded yet — wait for them
    const voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.onvoiceschanged = null;
        doSpeak();
      };
      // Fallback: if voices still don't load after 500ms, speak anyway
      setTimeout(() => {
        if (window.speechSynthesis.onvoiceschanged) {
          window.speechSynthesis.onvoiceschanged = null;
          doSpeak();
        }
      }, 500);
    } else {
      doSpeak();
    }
  };

  // ── 4. TRIGGER ACTION (MANUAL BUTTONS) ────────────────────────────────────────

  const triggerAction = useCallback((newAction: AvatarActionType, duration = 8000) => {
    // Clear any existing action timeout
    if (actionTimeoutRef.current) clearTimeout(actionTimeoutRef.current);
    
    setAvatarAction(newAction);
    
    // Auto-revert to idle after duration (except for persistent states)
    if (newAction !== 'idle' && newAction !== 'speaking') {
      actionTimeoutRef.current = setTimeout(() => {
        // Only revert if we're still on this action (not overridden)
        setAvatarAction((current) => current === newAction ? 'idle' : current);
      }, duration);
    }
  }, []);

  // ── 5. SEND MESSAGE TO AI (WITH VIDEO FILE ACTIONS) ───────────────────────────
  //
  // PIPELINE:
  //   1. User speaks → text recognized → sendUserMessage(text)
  //   2. POST to /api/virtual/chat with { message, personaId, conversationHistory }
  //      (API internally reads persona's videoClips to know available actions)
  //   3. API returns { reply, action, emotion }
  //   4. We FIRST set avatarAction to the AI's chosen action video
  //   5. THEN call speakText(reply, action) which keeps that action during speech
  //   6. When speech ends, action reverts to idle

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

      // Pause recognition while AI thinks
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (_) {}
      }

      try {
        const res = await fetch('/api/virtual/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            personaId: persona.id,
            message: cleanedText,
            conversationHistory: [...chatHistory, userEntry].slice(-16).map((c) => ({
              role: c.sender === 'user' ? 'user' : 'assistant',
              content: c.text,
            })),
          }),
        });

        const data = await res.json();
        const replyText = data.reply || "I'm so glad we are talking right now, tell me more!";
        const aiAction = data.action || 'speaking';

        console.log(`[VIDEO SYNC] AI action="${aiAction}" for message="${cleanedText}"`);

        // STEP 1: Set the action video IMMEDIATELY (before speech starts)
        if (aiAction !== 'idle' && aiAction !== 'speaking') {
          // Clear any previous action timeout
          if (actionTimeoutRef.current) clearTimeout(actionTimeoutRef.current);
          setAvatarAction(aiAction as AvatarActionType);
        }

        const companionEntry: ChatEntry = {
          sender: 'persona',
          text: replyText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        setChatHistory((prev) => [...prev, companionEntry]);
        setIsProcessing(false);

        // STEP 2: Start speaking — pass the explicit action so it stays during speech
        speakText(replyText, aiAction);
      } catch (err) {
        console.error('Failed to get companion reply:', err);
        setIsProcessing(false);
        speakText("You have such a wonderful way with words. Tell me more about that!", 'speaking');
      }
    },
    [chatHistory, isProcessing, persona, speakText]
  );

  // ── 6. SPEECH RECOGNITION (ANTI-ECHO) ─────────────────────────────────────────

  const startListening = useCallback(() => {
    if (typeof window === 'undefined' || isMicMuted || isSpeakingRef.current) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch (_) {}
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
          // Echo filter
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
        if (!isMicMuted && !isSpeakingRef.current && callStatus !== 'ended') {
          setTimeout(() => {
            if (!isMicMuted && !isSpeakingRef.current) startListening();
          }, 300);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn('Failed to start speech recognition:', err);
    }
  }, [callStatus, isMicMuted, persona.id, sendUserMessage]);

  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

  // ── 7. INITIAL GREETING ───────────────────────────────────────────────────────

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
      try { recognitionRef.current.abort(); } catch (_) {}
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
      try { currentAudioElementRef.current.pause(); currentAudioElementRef.current.src = ''; } catch (_) {}
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.pause();
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); recognitionRef.current.abort(); } catch (_) {}
      recognitionRef.current = null;
    }
    killAllMediaTracks();
    setLocalStream(null);
    if (audioAnimationRef.current) { cancelAnimationFrame(audioAnimationRef.current); audioAnimationRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (speechDebounceTimerRef.current) clearTimeout(speechDebounceTimerRef.current);
    if (actionTimeoutRef.current) clearTimeout(actionTimeoutRef.current);
    isSpeakingRef.current = false;
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
