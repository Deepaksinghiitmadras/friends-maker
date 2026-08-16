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

  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioAnimationRef = useRef<number | null>(null);

  // ── 1. INITIALIZE LOCAL CAMERA & MIC ───────────────────────────────────────
  useEffect(() => {
    let activeStream: MediaStream | null = null;

    async function setupMedia() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        activeStream = stream;
        setLocalStream(stream);
      } catch (err) {
        console.warn('Could not access camera/mic, falling back to simulated stream:', err);
      }
    }

    setupMedia();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
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
        // Resume listening after companion finishes speaking
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
      console.warn('Web Speech Recognition not supported in this browser.');
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
      // Companion speaks greeting upon connecting
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

  // ── 7. CONTROLS (MUTE / VIDEO TOGGLE / HANGUP) ─────────────────────────────
  const toggleMic = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((t) => (t.enabled = isMicMuted));
    }
    if (!isMicMuted && recognitionRef.current) {
      recognitionRef.current.stop();
    } else if (isMicMuted) {
      startListening();
    }
    setIsMicMuted((prev) => !prev);
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((t) => (t.enabled = isVideoOff));
    }
    setIsVideoOff((prev) => !prev);
  };

  const endCall = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
    }
    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
    }
    setCallStatus('ended');
  };

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
    toggleMic,
    toggleVideo,
    endCall,
    sendUserMessage,
  };
}
