'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { VirtualPersona, getAvailableVideoActions } from '@/lib/virtualPersonas';

export interface ChatEntry {
  sender: 'user' | 'persona';
  text: string;
  timestamp: string;
  sentiment?: 'flirty' | 'happy' | 'thoughtful' | 'curious' | 'neutral';
}

export interface DiagnosticLog {
  id: string;
  timestamp: string;
  category: 'STT' | 'AI' | 'TTS' | 'AVATAR' | 'SYSTEM' | 'ECHO';
  message: string;
  level: 'info' | 'warn' | 'error' | 'success';
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
  const [micLanguage, setMicLanguage] = useState<'hi-IN' | 'en-US'>(
    persona.id === 'ananya-sharma' ? 'hi-IN' : 'en-US'
  );

  // Diagnostic Logs for On-Screen HUD & Debugging
  const [diagnosticLogs, setDiagnosticLogs] = useState<DiagnosticLog[]>([]);

  // Video Action State
  const [avatarAction, setAvatarAction] = useState<AvatarActionType>('idle');
  const [outfit, setOutfit] = useState<'casual' | 'formal' | 'cozy' | 'sporty'>('casual');

  // Stable Refs
  const localStreamRef = useRef<MediaStream | null>(null);
  const micLanguageRef = useRef<string>(persona.id === 'ananya-sharma' ? 'hi-IN' : 'en-US');
  const recognitionRef = useRef<any>(null);
  const recognitionStateRef = useRef<'idle' | 'starting' | 'listening' | 'stopping'>('idle');
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const speechDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioAnimationRef = useRef<number | null>(null);
  const accumulatedSpeechRef = useRef<string>('');
  const currentAudioElementRef = useRef<HTMLAudioElement | null>(null);
  const actionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Anti-Double-Sound Generation Token
  const speechGenIdRef = useRef<number>(0);
  const speechSafetyWatchdogRef = useRef<NodeJS.Timeout | null>(null);

  const callStatusRef = useRef<'connecting' | 'connected' | 'ended'>('connecting');
  const isSpeakingRef = useRef<boolean>(false);
  const isProcessingRef = useRef<boolean>(false);
  const isMicMutedRef = useRef<boolean>(false);
  const chatHistoryRef = useRef<ChatEntry[]>([]);
  const lastCompanionSpeechRef = useRef<string>('');
  const lastCompanionSpeechEndRef = useRef<number>(0);
  const currentExplicitActionRef = useRef<string | null>(null);

  // Forward references
  const startListeningRef = useRef<() => void>(() => {});
  const sendUserMessageRef = useRef<(text: string) => Promise<void>>(async () => {});

  // Keep refs synced
  useEffect(() => {
    callStatusRef.current = callStatus;
  }, [callStatus]);

  useEffect(() => {
    micLanguageRef.current = micLanguage;
  }, [micLanguage]);

  // ── 0. UNIFIED DIAGNOSTIC LOGGER ─────────────────────────────────────────────

  const addLog = useCallback(
    (
      category: 'STT' | 'AI' | 'TTS' | 'AVATAR' | 'SYSTEM' | 'ECHO',
      message: string,
      level: 'info' | 'warn' | 'error' | 'success' = 'info'
    ) => {
      const now = new Date();
      const timeStr = `${now.toTimeString().split(' ')[0]}.${String(now.getMilliseconds()).padStart(3, '0')}`;
      const entry: DiagnosticLog = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: timeStr,
        category,
        message,
        level,
      };

      // Output to developer console with color coding
      const colors = {
        STT: '#10b981', // green
        AI: '#8b5cf6', // purple
        TTS: '#ec4899', // pink
        AVATAR: '#f59e0b', // amber
        SYSTEM: '#3b82f6', // blue
        ECHO: '#ef4444', // red
      };
      const badgeStyle = `background: ${colors[category]}; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;`;
      console.log(`%c[${category}]%c ${timeStr} | ${message}`, badgeStyle, 'color: inherit;');

      setDiagnosticLogs((prev) => [entry, ...prev.slice(0, 39)]);
    },
    []
  );

  // Keep chatHistoryRef synced
  useEffect(() => {
    chatHistoryRef.current = chatHistory;
  }, [chatHistory]);

  useEffect(() => {
    isMicMutedRef.current = isMicMuted;
  }, [isMicMuted]);

  const cachedVoicesRef = useRef<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const updateVoices = () => {
        try {
          const v = window.speechSynthesis.getVoices();
          if (v && v.length > 0) {
            cachedVoicesRef.current = v;
          }
        } catch (_) {}
      };
      updateVoices();
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, []);

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

  // ── 1. SESSION MEMORY ─────────────────────────────────────────────────────────

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(`virtual_session_${persona.id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setChatHistory(parsed);
          chatHistoryRef.current = parsed;
          addLog('SYSTEM', `Restored ${parsed.length} previous messages from session memory`, 'info');
        }
      }
    } catch (_) {}
  }, [persona.id, addLog]);

  useEffect(() => {
    if (chatHistory.length > 0) {
      try {
        sessionStorage.setItem(`virtual_session_${persona.id}`, JSON.stringify(chatHistory.slice(-20)));
      } catch (_) {}
    }
  }, [chatHistory, persona.id]);

  // ── 2. CAMERA & MIC SETUP ────────────────────────────────────────────────────

  useEffect(() => {
    let isMounted = true;

    async function setupMedia() {
      addLog('SYSTEM', 'Requesting camera & microphone permissions...', 'info');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        if (isMounted) {
          registerStream(stream);
          localStreamRef.current = stream;
          setLocalStream(stream);
          addLog('SYSTEM', 'Camera & Microphone access granted successfully', 'success');
        } else {
          stream.getTracks().forEach((t) => {
            t.stop();
            t.enabled = false;
          });
        }
      } catch (err: any) {
        addLog('SYSTEM', `Could not access camera/mic: ${err.message || err}`, 'warn');
        console.warn('Could not access camera/mic:', err);
      }
    }

    setupMedia();

    return () => {
      isMounted = false;
      killAllMediaTracks();
      stopAllAudioPlayback('cleanup');
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
      if (speechSafetyWatchdogRef.current) clearTimeout(speechSafetyWatchdogRef.current);
    };
  }, [addLog]);

  // ── 3. CALL TIMER ─────────────────────────────────────────────────────────────

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

  // ── 4. COMPLETE AUDIO SHUTDOWN HELPER (PREVENTS ALL DOUBLE SOUND) ─────────────

  const stopAllAudioPlayback = useCallback((reason = 'manual') => {
    // Invalidate any in-flight async speech generations
    speechGenIdRef.current += 1;

    // Clear speech safety watchdog
    if (speechSafetyWatchdogRef.current) {
      clearTimeout(speechSafetyWatchdogRef.current);
      speechSafetyWatchdogRef.current = null;
    }

    // Stop HTML5 Audio Element
    if (currentAudioElementRef.current) {
      try {
        currentAudioElementRef.current.pause();
        currentAudioElementRef.current.currentTime = 0;
        currentAudioElementRef.current.src = '';
        currentAudioElementRef.current = null;
      } catch (_) {}
    }

    // Cancel WebSpeech Synthesis
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (_) {}
    }
    currentUtteranceRef.current = null;

    // Reset visual audio wave
    if (audioAnimationRef.current) {
      cancelAnimationFrame(audioAnimationRef.current);
      audioAnimationRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  // ── 5. SPEAK TEXT (NEURAL TTS + WEBSPEECH FALLBACK WITH PRECISE SYNC) ────────

  const speakText = useCallback(
    async (text: string, explicitAction?: string) => {
      if (!text || !text.trim()) return;

      // 1. Immediately kill ANY currently running sound to guarantee ZERO audio overlap
      stopAllAudioPlayback('new_speech_request');

      // Increment token for this exact speech utterance
      const currentGenId = speechGenIdRef.current;
      isSpeakingRef.current = true;
      lastCompanionSpeechRef.current = text.toLowerCase();

      addLog('TTS', `🔊 Preparing speech: "${text.slice(0, 50)}..." [GenID: ${currentGenId}]`, 'info');

      // Stop speech recognition while companion speaks to prevent acoustic feedback
      if (recognitionRef.current && recognitionStateRef.current === 'listening') {
        try {
          addLog('STT', 'Pausing speech recognition while AI companion is preparing speech...', 'info');
          recognitionRef.current.abort();
        } catch (_) {}
      }

      // Helper to activate visuals (captions + avatar movement + waveform) ONLY when audio actually plays
      const triggerSynchronizedPlayback = (spokenText: string, chosenAction?: string) => {
        if (speechGenIdRef.current !== currentGenId) return;

        setIsSpeaking(true);
        setCurrentCaption(spokenText);

        if (!chosenAction || chosenAction === 'speaking' || chosenAction === 'idle') {
          setAvatarAction('speaking');
          currentExplicitActionRef.current = null;
          addLog('AVATAR', 'Avatar started speaking action in sync with audio', 'info');
        } else {
          currentExplicitActionRef.current = chosenAction;
          setAvatarAction(chosenAction as AvatarActionType);
          addLog('AVATAR', `Avatar started "${chosenAction}" action in sync with audio`, 'info');
        }

        // Animate audio waveform
        let frame = 0;
        const animateAudio = () => {
          if (speechGenIdRef.current !== currentGenId) return;
          frame++;
          setAudioLevel(Math.abs(Math.sin(frame * 0.22)) * 0.8 + 0.2);
          audioAnimationRef.current = requestAnimationFrame(animateAudio);
        };
        audioAnimationRef.current = requestAnimationFrame(animateAudio);
      };

      // Speech Completion Handler
      const handleSpeechEnd = (callerId: number, source: string) => {
        if (speechGenIdRef.current !== callerId) {
          addLog('TTS', `Ignoring stale speechEnd callback from ${source} [GenID: ${callerId}]`, 'warn');
          return;
        }

        addLog('TTS', `✅ Speech finished from ${source} [GenID: ${callerId}]`, 'success');

        if (speechSafetyWatchdogRef.current) {
          clearTimeout(speechSafetyWatchdogRef.current);
          speechSafetyWatchdogRef.current = null;
        }

        setIsSpeaking(false);
        isSpeakingRef.current = false;
        setAudioLevel(0);
        if (audioAnimationRef.current) cancelAnimationFrame(audioAnimationRef.current);
        lastCompanionSpeechEndRef.current = Date.now();

        // Reset video to idle
        if (currentExplicitActionRef.current) {
          setTimeout(() => {
            if (speechGenIdRef.current === callerId) {
              setAvatarAction('idle');
              currentExplicitActionRef.current = null;
            }
          }, 2500);
        } else {
          setAvatarAction('idle');
        }

        // Clear subtitle after 2 seconds
        setTimeout(() => {
          if (!isSpeakingRef.current) setCurrentCaption('');
        }, 2000);

        // Resume listening automatically after echo decays (350ms)
        setTimeout(() => {
          if (!isSpeakingRef.current && !isMicMutedRef.current && callStatus !== 'ended') {
            addLog('STT', 'Echo decay complete. Automatically resuming microphone listening...', 'info');
            startListeningRef.current();
          }
        }, 350);
      };

      // Set safety watchdog timeout (prevents STT freeze if audio stalls)
      const estimatedDurationMs = Math.max(5000, Math.min(25000, text.length * 85 + 2000));
      speechSafetyWatchdogRef.current = setTimeout(() => {
        if (speechGenIdRef.current === currentGenId && isSpeakingRef.current) {
          addLog('TTS', `⚠️ Speech safety watchdog triggered (${estimatedDurationMs}ms). Forcing speech end to resume listening.`, 'warn');
          handleSpeechEnd(currentGenId, 'safety-watchdog');
        }
      }, estimatedDurationMs);

      // ── Sub-step: Speak with WebSpeech Fallback
      const speakWithWebSpeech = (speechText: string, genId: number) => {
        if (speechGenIdRef.current !== genId) return;

        if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
          addLog('TTS', 'WebSpeech API not supported in this browser', 'warn');
          handleSpeechEnd(genId, 'unsupported-webspeech');
          return;
        }

        try {
          window.speechSynthesis.cancel();

          // Clean speech text: remove emojis, markdown symbols, and multiple spaces
          const cleanSpeech = speechText
            .replace(/[*_~`#]/g, '')
            .replace(/[\uD83C-\uDBFF\uDC00-\uDFFF]+/g, '')
            .replace(/\s+/g, ' ')
            .trim();

          const utterance = new SpeechSynthesisUtterance(cleanSpeech);
          currentUtteranceRef.current = utterance;

          const isMan = persona.gender === 'man';
          const hasHindiText = /[\u0900-\u097F]/.test(cleanSpeech) || /\b(namaste|aap|kaise|kaisi|kaisa|main|meri|mera|mujhe|hum|theek|haan|nahi|kya|accha|achha|bahut|shukriya|pyaar|dil|chai|bolo|batao|karo|sach|arey|ji|yaar)\b/i.test(cleanSpeech);
          
          utterance.lang = hasHindiText ? 'hi-IN' : 'en-IN';
          utterance.pitch = isMan ? 0.92 : 1.05;
          utterance.rate = isMan ? 1.0 : 0.98;

          // Get voices from live API or cached ref
          let voices = window.speechSynthesis.getVoices();
          if (voices.length === 0 && cachedVoicesRef.current.length > 0) {
            voices = cachedVoicesRef.current;
          }

          if (voices.length > 0) {
            let matchedVoice: SpeechSynthesisVoice | undefined;

            const maleKeywords = ['rishi', 'kunal', 'pradeep', 'ravi', 'hemant', 'daniel', 'oliver', 'aaron', 'arthur', 'alex', 'david', 'mark', 'george', 'fred', 'tom', 'male', 'guy'];
            const femaleKeywords = ['aditi', 'kajal', 'veena', 'lekha', 'swara', 'heera', 'samantha', 'victoria', 'karen', 'zira', 'moira', 'tessa', 'fiona', 'serena', 'female', 'woman'];

            if (isMan) {
              matchedVoice = voices.find((v) => {
                const name = v.name.toLowerCase();
                const lang = v.lang.toLowerCase();
                const isInd = lang.includes('in') || lang.includes('hi');
                const isMale = maleKeywords.some((k) => name.includes(k));
                const isFemale = femaleKeywords.some((k) => name.includes(k));
                return isInd && isMale && !isFemale;
              });

              if (!matchedVoice) {
                matchedVoice = voices.find((v) => {
                  const name = v.name.toLowerCase();
                  const isMale = maleKeywords.some((k) => name.includes(k));
                  const isFemale = femaleKeywords.some((k) => name.includes(k));
                  return isMale && !isFemale;
                });
              }

              if (!matchedVoice) {
                matchedVoice = voices.find((v) => {
                  const name = v.name.toLowerCase();
                  return !femaleKeywords.some((k) => name.includes(k));
                });
              }
            } else {
              matchedVoice = voices.find((v) => {
                const name = v.name.toLowerCase();
                const isFemale = femaleKeywords.some((k) => name.includes(k));
                const isMale = maleKeywords.some((k) => name.includes(k));
                return isFemale && !isMale;
              });
            }

            if (!matchedVoice && persona.voiceStyle?.preferredVoiceNames) {
              matchedVoice = voices.find((v) =>
                persona.voiceStyle.preferredVoiceNames?.some((pref) =>
                  v.name.toLowerCase().includes(pref.toLowerCase())
                )
              );
            }

            if (matchedVoice) {
              utterance.voice = matchedVoice;
              addLog('TTS', `Selected ${isMan ? '👨 Natural Male' : '👩 Natural Female'} Voice: "${matchedVoice.name}" (${matchedVoice.lang})`, 'info');
            }
          }

          utterance.onend = () => {
            currentUtteranceRef.current = null;
            handleSpeechEnd(genId, 'webspeech-onend');
          };
          utterance.onerror = (e) => {
            currentUtteranceRef.current = null;
            addLog('TTS', `WebSpeech error: ${e.error}`, 'warn');
            handleSpeechEnd(genId, 'webspeech-onerror');
          };

          // Synchronize visual animation at the exact instant speech starts playing
          utterance.onstart = () => {
            triggerSynchronizedPlayback(cleanSpeech, explicitAction);
          };

          addLog('TTS', `Speaking with ${isMan ? '👨 natural male' : '👩 warm female'} voice...`, 'info');
          window.speechSynthesis.speak(utterance);
        } catch (err: any) {
          addLog('TTS', `WebSpeech execution failed: ${err.message}`, 'error');
          handleSpeechEnd(genId, 'webspeech-exception');
        }
      };

      // ── Step 1: Request studio TTS binary stream (Chariot.in / ElevenLabs / Google TTS)
      try {
        addLog('TTS', `Requesting Neural TTS audio stream from /api/virtual/tts (${persona.gender === 'man' ? 'Darshan Male' : 'Meera Female'})...`, 'info');
        const ttsRes = await fetch('/api/virtual/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            personaId: persona.id,
          }),
        });

        // Check if generation token changed while fetch was in flight
        if (speechGenIdRef.current !== currentGenId) {
          addLog('TTS', `Discarding Neural TTS response because new speech was requested [GenID: ${currentGenId}]`, 'warn');
          return;
        }

        if (ttsRes.ok && (ttsRes.headers.get('content-type')?.includes('audio') || ttsRes.headers.get('content-type')?.includes('octet-stream'))) {
          const audioBlob = await ttsRes.blob();
          if (speechGenIdRef.current !== currentGenId) return;

          const blobUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(blobUrl);
          currentAudioElementRef.current = audio;

          audio.onplay = () => {
            triggerSynchronizedPlayback(text, explicitAction);
          };

          audio.onended = () => {
            URL.revokeObjectURL(blobUrl);
            currentAudioElementRef.current = null;
            handleSpeechEnd(currentGenId, 'neural-tts-ended');
          };

          audio.onerror = (err) => {
            URL.revokeObjectURL(blobUrl);
            currentAudioElementRef.current = null;
            addLog('TTS', 'Neural TTS playback error, falling back to WebSpeech', 'warn');
            speakWithWebSpeech(text, currentGenId);
          };

          addLog('TTS', `Neural TTS stream loaded (${audioBlob.size} bytes). Starting audio playback...`, 'success');
          try {
            await audio.play();
            return;
          } catch (playErr: any) {
            addLog('TTS', `Audio play error (${playErr.message}), falling back to WebSpeech`, 'warn');
            speakWithWebSpeech(text, currentGenId);
            return;
          }
        } else {
          addLog('TTS', 'Neural TTS unavailable, falling back to WebSpeech', 'info');
          speakWithWebSpeech(text, currentGenId);
        }
      } catch (err: any) {
        addLog('TTS', `Neural TTS request failed (${err.message}), falling back to WebSpeech`, 'warn');
        speakWithWebSpeech(text, currentGenId);
      }
    },
    [persona, addLog, stopAllAudioPlayback, callStatus]
  );

  // ── 6. MANUAL ACTION BUTTONS ──────────────────────────────────────────────────

  const triggerAction = useCallback(
    (newAction: AvatarActionType, duration = 8000) => {
      if (actionTimeoutRef.current) clearTimeout(actionTimeoutRef.current);
      setAvatarAction(newAction);
      addLog('AVATAR', `Manually triggered avatar action: "${newAction}"`, 'info');

      if (newAction !== 'idle' && newAction !== 'speaking') {
        actionTimeoutRef.current = setTimeout(() => {
          setAvatarAction((current) => (current === newAction ? 'idle' : current));
        }, duration);
      }
    },
    [addLog]
  );

  // ── 7. SEND USER MESSAGE (AI BRAIN PIPELINE) ──────────────────────────────────

  const sendUserMessage = useCallback(
    async (messageText: string) => {
      if (!messageText || !messageText.trim() || isProcessingRef.current) {
        if (isProcessingRef.current) {
          addLog('AI', `Ignored duplicate message while previous request is still processing`, 'warn');
        }
        return;
      }

      const cleanedText = messageText.trim();
      addLog('AI', `🧠 User message submitted: "${cleanedText}"`, 'info');

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
        recognitionStateRef.current = 'idle';
      }

      try {
        const fetchStart = Date.now();
        addLog('AI', `Sending request to /api/virtual/chat (Persona: ${persona.id})...`, 'info');

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

        const fetchDuration = Date.now() - fetchStart;
        const data = await res.json();

        const replyText =
          data.reply ||
          (persona.gender === 'man'
            ? `Main samajh gaya! Aap bataiye, dil mein aur kya chal raha hai?`
            : `Aapse baat karke sach mein bahut accha lag raha hai! Aur bataiye apne baare mein.`);
        const aiAction = data.action || 'speaking';
        const emotion = data.emotion || 'happy';
        const source = data.source || 'unknown';

        addLog(
          'AI',
          `⚡ AI Replied in ${fetchDuration}ms [Source: ${source}, Action: "${aiAction}", Emotion: "${emotion}"]`,
          'success'
        );
        addLog('AI', `Companion: "${replyText}"`, 'info');

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
      } catch (err: any) {
        addLog('AI', `Chat API failed: ${err.message}. Falling back to default companion reply.`, 'error');
        console.error('Failed to get companion reply:', err);
        setIsProcessing(false);
        isProcessingRef.current = false;
        speakText("Aapse baat karke sach mein bahut accha lag raha hai! Aur bataiye apne baare mein.", 'speaking');
      }
    },
    [persona, speakText, addLog]
  );

  useEffect(() => {
    sendUserMessageRef.current = sendUserMessage;
  }, [sendUserMessage]);

  // ── 8. SPEECH RECOGNITION (BULLETPROOF LIFECYCLE & AUTO-HEALING) ──────────────

  const startListening = useCallback(() => {
    if (typeof window === 'undefined') return;

    if (isMicMutedRef.current) {
      addLog('STT', 'Microphone is currently MUTED. Skipping startListening.', 'warn');
      return;
    }

    if (isSpeakingRef.current) {
      addLog('STT', 'Companion is currently SPEAKING. Postponing listening until speech ends.', 'info');
      return;
    }

    if (callStatusRef.current === 'ended') {
      addLog('STT', 'Call is ended. Skipping listening.', 'info');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      addLog('STT', 'SpeechRecognition API not supported in this browser.', 'error');
      return;
    }

    // Clean up if stuck in starting or stopping state
    if (recognitionStateRef.current === 'listening') {
      return;
    }

    try {
      recognitionStateRef.current = 'starting';
      addLog('STT', 'Initializing SpeechRecognition engine...', 'info');

      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (_) {}
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = micLanguageRef.current || (persona.id === 'ananya-sharma' ? 'hi-IN' : 'en-US');

      recognition.onstart = () => {
        if (!isSpeakingRef.current) {
          recognitionStateRef.current = 'listening';
          setIsListening(true);
          accumulatedSpeechRef.current = '';
          addLog('STT', `🟢 Microphone is ACTIVE (${recognition.lang}) and listening for user voice...`, 'success');
        } else {
          try {
            recognition.abort();
          } catch (_) {}
          recognitionStateRef.current = 'idle';
        }
      };

      recognition.onresult = (event: any) => {
        // Acoustic echo barrier
        const now = Date.now();
        if (isSpeakingRef.current || now - lastCompanionSpeechEndRef.current < 450) {
          addLog('ECHO', 'Dropped acoustic noise/echo during companion speech window', 'warn');
          return;
        }

        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) finalTranscript += transcript + ' ';
          else interimTranscript += transcript;
        }

        const currentHeard = (finalTranscript || interimTranscript).trim();
        if (currentHeard) {
          // Acoustic echo filter against companion's last spoken text
          const lowerHeard = currentHeard.toLowerCase();
          const lowerCompanion = lastCompanionSpeechRef.current;
          if (
            lowerCompanion &&
            lowerHeard.length > 6 &&
            (lowerCompanion.includes(lowerHeard) || lowerHeard.includes(lowerCompanion))
          ) {
            addLog('ECHO', `Acoustic filter filtered companion echo: "${currentHeard}"`, 'warn');
            return;
          }

          accumulatedSpeechRef.current = currentHeard;
          setCurrentCaption(`Listening: "${currentHeard}"`);
          addLog('STT', `🎙️ Heard (${recognition.lang}): "${currentHeard}"`, 'info');

          // Debounce: send message after 1.2s pause in speech
          if (speechDebounceTimerRef.current) clearTimeout(speechDebounceTimerRef.current);
          speechDebounceTimerRef.current = setTimeout(() => {
            const textToSend = accumulatedSpeechRef.current.trim();
            if (
              textToSend &&
              textToSend.length > 1 &&
              !isSpeakingRef.current &&
              !isProcessingRef.current
            ) {
              addLog('STT', `🚀 User speech finalized: "${textToSend}". Dispatching to AI...`, 'success');
              accumulatedSpeechRef.current = '';
              sendUserMessageRef.current(textToSend);
            }
          }, 1200);
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          addLog('STT', `⚠️ Speech recognition error: ${event.error}`, 'warn');
        }
      };

      recognition.onend = () => {
        recognitionStateRef.current = 'idle';
        setIsListening(false);
        addLog('STT', 'Microphone session cycle finished.', 'info');

        // Automatically restart speech recognition whenever silent and call is active
        if (!isMicMutedRef.current && !isSpeakingRef.current && callStatusRef.current !== 'ended') {
          setTimeout(() => {
            if (!isMicMutedRef.current && !isSpeakingRef.current && recognitionStateRef.current === 'idle') {
              startListeningRef.current();
            }
          }, 300);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      recognitionStateRef.current = 'idle';
      setIsListening(false);
      addLog('STT', `Failed to start speech recognition: ${err.message || err}`, 'error');
    }
  }, [persona.id, addLog]);

  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

  // ── 9. INITIAL GREETING ───────────────────────────────────────────────────────

  useEffect(() => {
    const greetingTimer = setTimeout(() => {
      setCallStatus('connected');
      addLog('SYSTEM', `Call connected with ${persona.name}`, 'success');

      if (chatHistoryRef.current.length === 0) {
        const greetingEntry: ChatEntry = {
          sender: 'persona',
          text: persona.greeting,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setChatHistory([greetingEntry]);
        chatHistoryRef.current = [greetingEntry];
        addLog('AI', `Speaking companion opening greeting: "${persona.greeting}"`, 'info');
        speakText(persona.greeting, 'speaking');
      } else {
        startListening();
      }
    }, 1200);

    return () => clearTimeout(greetingTimer);
  }, []);

  const cycleOutfit = useCallback(() => {
    setAvatarAction('changing_clothes');
    addLog('AVATAR', 'Companion changing outfit...', 'info');
    setTimeout(() => {
      setOutfit((prev) => {
        const next = prev === 'casual' ? 'formal' : prev === 'formal' ? 'cozy' : prev === 'cozy' ? 'sporty' : 'casual';
        addLog('AVATAR', `Outfit changed to: "${next}"`, 'success');
        return next;
      });
      setAvatarAction('idle');
    }, 1200);
  }, [addLog]);

  // ── 10. CONTROLS & MANUAL DIAGNOSTIC TOOLS ────────────────────────────────────

  const toggleMic = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = isMicMuted));
    }
    if (!isMicMuted) {
      addLog('STT', 'Microphone MUTED by user', 'warn');
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (_) {}
      }
      recognitionStateRef.current = 'idle';
      setIsListening(false);
    } else {
      addLog('STT', 'Microphone UNMUTED by user. Resuming listening...', 'success');
      startListeningRef.current();
    }
    setIsMicMuted((prev) => !prev);
  }, [isMicMuted, addLog]);

  const toggleMicLanguage = useCallback(() => {
    setMicLanguage((prev) => {
      const next = prev === 'hi-IN' ? 'en-US' : 'hi-IN';
      micLanguageRef.current = next;
      addLog('STT', `Microphone recognition language switched to: ${next === 'hi-IN' ? 'Hindi (हिन्दी)' : 'English (US)'}`, 'info');
      // Restart recognition with new language
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (_) {}
      }
      recognitionStateRef.current = 'idle';
      setIsListening(false);
      setTimeout(() => {
        startListeningRef.current();
      }, 300);
      return next;
    });
  }, [addLog]);

  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((t) => (t.enabled = isVideoOff));
    }
    addLog('SYSTEM', `User video camera turned ${isVideoOff ? 'ON' : 'OFF'}`, 'info');
    setIsVideoOff((prev) => !prev);
  }, [isVideoOff, addLog]);

  const forceRestartMic = useCallback(() => {
    addLog('STT', '🔄 Force restarting microphone listening engine...', 'info');
    stopAllAudioPlayback('force_restart_mic');
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (_) {}
    }
    recognitionStateRef.current = 'idle';
    setIsListening(false);
    isSpeakingRef.current = false;
    setIsSpeaking(false);
    setTimeout(() => {
      startListeningRef.current();
    }, 300);
  }, [addLog, stopAllAudioPlayback]);

  const testAudioSynthesis = useCallback(() => {
    addLog('TTS', '🧪 Running manual test of companion audio synthesis...', 'info');
    speakText("I can hear you loud and clear! Our video call connection is completely active and healthy.", 'wave');
  }, [addLog, speakText]);

  const clearDiagnosticLogs = useCallback(() => {
    setDiagnosticLogs([]);
  }, []);

  const endCall = useCallback(() => {
    addLog('SYSTEM', 'Ending call...', 'info');
    stopAllAudioPlayback('end_call');

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        recognitionRef.current.abort();
      } catch (_) {}
      recognitionRef.current = null;
    }
    recognitionStateRef.current = 'idle';

    killAllMediaTracks();
    setLocalStream(null);

    if (timerRef.current) {
      clearInterval(timerRef.current);
            timerRef.current = null;
    }
    if (speechDebounceTimerRef.current) clearTimeout(speechDebounceTimerRef.current);
    if (actionTimeoutRef.current) clearTimeout(actionTimeoutRef.current);

    // Log virtual call duration
    if (callDuration > 0) {
      fetch('/api/activity/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'virtual_dating',
          action: 'virtual_call_end',
          targetId: persona.id,
          targetName: persona.name,
          durationSec: callDuration,
        }),
      }).catch(() => {});
    }

    isSpeakingRef.current = false;
    isProcessingRef.current = false;
    chatHistoryRef.current = [];
    accumulatedSpeechRef.current = '';
    lastCompanionSpeechRef.current = '';
    setChatHistory([]);
    setCurrentCaption('');
    setIsSpeaking(false);
    setIsListening(false);
    setIsProcessing(false);
    setAudioLevel(0);
    setAvatarAction('idle');
    setCallStatus('ended');
  }, [addLog, stopAllAudioPlayback]);

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
    diagnosticLogs,
    micLanguage,
    triggerAction,
    cycleOutfit,
    toggleMic,
    toggleMicLanguage,
    toggleVideo,
    forceRestartMic,
    testAudioSynthesis,
    clearDiagnosticLogs,
    endCall,
    sendUserMessage,
  };
}
