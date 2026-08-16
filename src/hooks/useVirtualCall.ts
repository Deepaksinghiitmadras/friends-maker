'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { VirtualPersona } from '@/lib/virtualPersonas';

export interface ChatEntry {
  sender: 'user' | 'persona';
  text: string;
  timestamp: string;
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
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioAnimationRef = useRef<number | null>(null);

  // ── 1. INITIALIZE LOCAL CAMERA & MIC ───────────────────────────────────────
  useEffect(() => {
    async function setupMedia() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        localStreamRef.current = stream;
        setLocalStream(stream);
      } catch (err) {
        console.warn('Could not access camera/mic, fallback active:', err);
      }
    }

    setupMedia();

    return () => {
      // Synchronously stop all media tracks on unmount
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          track.stop();
          track.enabled = false;
        });
        localStreamRef.current = null;
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (_) {}
      }
      if (audioAnimationRef.current) {
        cancelAnimationFrame(audioAnimationRef.current);
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

  // ── 3. SPEECH SYNTHESIS (AVATAR TALKING) ────────────────────────────────────
  const speakText = useCallback(
    (text: string) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

      window.speechSynthesis.cancel();
      setIsSpeaking(true);
      setCurrentCaption(text);

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.pitch = persona.voiceStyle.pitch;
      utterance.rate = persona.voiceStyle.rate;

      const voices = window.speechSynthesis.getVoices();
      if (persona.voiceStyle.preferredVoiceNames) {
        const found = voices.find((v) =>
          persona.voiceStyle.preferredVoiceNames?.some((pref) =>
            v.name.toLowerCase().includes(pref.toLowerCase())
          )
        );
        if (found) utterance.voice = found;
      }

      // Simulate audio waveform movement during speech
      let frame = 0;
      const animateAudio = () => {
        frame++;
        const wave = Math.abs(Math.sin(frame * 0.2)) * 0.8 + 0.2;
        setAudioLevel(wave);
        audioAnimationRef.current = requestAnimationFrame(animateAudio);
      };
      audioAnimationRef.current = requestAnimationFrame(animateAudio);

      utterance.onend = () => {
        setIsSpeaking(false);
        setAudioLevel(0);
        if (audioAnimationRef.current) cancelAnimationFrame(audioAnimationRef.current);
        startListening();
      };

      utterance.onerror = () => {
        setIsSpeaking(false);
        setAudioLevel(0);
        if (audioAnimationRef.current) cancelAnimationFrame(audioAnimationRef.current);
        startListening();
      };

      currentUtteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [persona]
  );

  // ── 4. SEND MESSAGE TO BACKEND AI ENGINE ───────────────────────────────────
  const sendUserMessage = useCallback(
    async (messageText: string) => {
      if (!messageText.trim() || isProcessing) return;

      const userEntry: ChatEntry = {
        sender: 'user',
        text: messageText.trim(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setChatHistory((prev) => [...prev, userEntry]);
      setCurrentCaption(`You: "${messageText.trim()}"`);
      setIsProcessing(true);

      // Natural speech action intent parsing
      const lower = messageText.toLowerCase();
      if (lower.includes('stand') && !lower.includes('sit')) {
        setAvatarAction('standing');
      } else if (lower.includes('sit')) {
        setAvatarAction('sitting');
      } else if (lower.includes('coffee') || lower.includes('cook') || lower.includes('food')) {
        setAvatarAction('cooking');
        setTimeout(() => setAvatarAction('idle'), 8000);
      } else if (lower.includes('outfit') || lower.includes('clothes') || lower.includes('dress')) {
        setAvatarAction('changing_clothes');
        setTimeout(() => {
          setOutfit((prev) => (prev === 'casual' ? 'formal' : prev === 'formal' ? 'cozy' : 'sporty'));
          setAvatarAction('idle');
        }, 1200);
      } else if (lower.includes('workout') || lower.includes('exercise') || lower.includes('stretch')) {
        setAvatarAction('workout');
        setTimeout(() => setAvatarAction('idle'), 7000);
      } else if (lower.includes('wave') || lower.includes('hello') || lower.includes('hi')) {
        setAvatarAction('wave');
        setTimeout(() => setAvatarAction('idle'), 4000);
      } else if (lower.includes('kiss') || lower.includes('love')) {
        setAvatarAction('kiss');
        setTimeout(() => setAvatarAction('idle'), 5000);
      }

      // Stop speech recognition while processing
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (_) {}
      }

      try {
        const res = await fetch('/api/virtual/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            personaId: persona.id,
            message: messageText.trim(),
            conversationHistory: chatHistory.map((c) => ({
              role: c.sender === 'user' ? 'user' : 'assistant',
              content: c.text,
            })),
          }),
        });

        const data = await res.json();
        const replyText = data.reply || "I'm so glad we are talking right now.";

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
        speakText("That's so interesting, tell me more about that!");
      }
    },
    [chatHistory, isProcessing, persona.id, speakText]
  );

  // ── 5. SPEECH RECOGNITION (USER TALKING) ───────────────────────────────────
  const startListening = useCallback(() => {
    if (typeof window === 'undefined' || isMicMuted || isSpeaking) return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      return;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0].transcript)
        .join('');

      setCurrentCaption(`Listening: "${transcript}"`);

      if (event.results[0]?.isFinal) {
        sendUserMessage(transcript);
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error !== 'no-speech') {
        console.warn('Speech recognition error:', event.error);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (_) {}
  }, [isMicMuted, isSpeaking, sendUserMessage]);

  // ── 6. CONNECT CALL & DELIVER GREETING ─────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      setCallStatus('connected');
      const initialEntry: ChatEntry = {
        sender: 'persona',
        text: persona.greeting,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatHistory([initialEntry]);
      speakText(persona.greeting);
    }, 1200);

    return () => clearTimeout(timer);
  }, [persona.greeting, speakText]);

  // ── 7. ACTIVITY ACTIONS & OUTFIT CONTROLS ─────────────────────────────────
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
      duration = 6000
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
    if (localStream) {
      localStream.getAudioTracks().forEach((t) => (t.enabled = isMicMuted));
    }
    if (!isMicMuted && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
    } else if (isMicMuted) {
      startListening();
    }
    setIsMicMuted((prev) => !prev);
  }, [isMicMuted, localStream, startListening]);

  const toggleVideo = useCallback(() => {
    if (localStream) {
      localStream.getVideoTracks().forEach((t) => (t.enabled = isVideoOff));
    }
    setIsVideoOff((prev) => !prev);
  }, [isVideoOff, localStream]);

  const endCall = useCallback(() => {
    // 1. Immediately cancel all speech synthesis voice
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.pause();
      window.speechSynthesis.cancel();
    }
    // 2. Stop speech recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        recognitionRef.current.abort();
      } catch (_) {}
      recognitionRef.current = null;
    }
    // 3. Immediately stop and disable all local camera and microphone tracks
    const streamToStop = localStreamRef.current || localStream;
    if (streamToStop) {
      streamToStop.getTracks().forEach((t) => {
        t.stop();
        t.enabled = false;
      });
      localStreamRef.current = null;
      setLocalStream(null);
    }
    // 4. Cancel any audio animations
    if (audioAnimationRef.current) {
      cancelAnimationFrame(audioAnimationRef.current);
      audioAnimationRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsSpeaking(false);
    setIsListening(false);
    setIsProcessing(false);
    setAudioLevel(0);
    setCallStatus('ended');
  }, [localStream]);

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
