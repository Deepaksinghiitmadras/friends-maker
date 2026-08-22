'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getPersonaById, VirtualPersona } from '@/lib/virtualPersonas';
import { useVirtualCall } from '@/hooks/useVirtualCall';
import VirtualAvatarCanvas from '@/components/virtual/VirtualAvatarCanvas';
import {
  FaMicrophone,
  FaMicrophoneSlash,
  FaVideo,
  FaVideoSlash,
  FaPhoneSlash,
  FaCommentDots,
  FaChevronLeft,
  FaLock,
  FaPaperPlane,
  FaClock,
  FaRedoAlt,
  FaUserFriends,
  FaTerminal,
  FaVolumeUp,
  FaSyncAlt,
  FaTrash,
} from 'react-icons/fa';
import { HiSparkles } from 'react-icons/hi2';
import { Button, Input, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Spinner } from '@nextui-org/react';
import { motion, AnimatePresence } from 'framer-motion';

export default function VirtualVideoCallPage() {
  const params = useParams<{ personaId: string }>();
  const [persona, setPersona] = useState<VirtualPersona | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function loadPersona() {
      const personaId = params.personaId;

      // 1. Fetch latest persona from API (with PostgreSQL overrides)
      try {
        const res = await fetch('/api/virtual/custom-persona');
        const data = await res.json();
        if (data.personas && Array.isArray(data.personas)) {
          const found = data.personas.find((p: VirtualPersona) => p.id === personaId);
          if (found) {
            setPersona(found);
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        console.error('Failed to load persona from API:', err);
      }

      // 2. Fallback to built-in lookup
      const local = getPersonaById(personaId);
      if (local) {
        setPersona(local);
        setLoading(false);
        return;
      }

      setNotFound(true);
      setLoading(false);
    }

    loadPersona();
  }, [params.personaId]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black text-white flex flex-col items-center justify-center gap-4 z-50">
        <Spinner size="lg" color="secondary" />
        <p className="text-sm font-semibold text-purple-300 animate-pulse">
          Connecting to Virtual Companion...
        </p>
      </div>
    );
  }

  if (notFound || !persona) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-pink-500/10 flex items-center justify-center text-pink-500 text-3xl mb-4">
          <FaUserFriends />
        </div>
        <h2 className="text-2xl font-bold mb-2">Companion Not Found</h2>
        <p className="text-sm text-gray-400 max-w-md mb-6">
          The virtual companion you are looking for may have been removed or is pending approval.
        </p>
        <Button as={Link} href="/virtual" color="primary" className="bg-gradient-to-r from-pink-500 to-purple-600 font-bold">
          Back to Virtual Companions
        </Button>
      </div>
    );
  }

  return <ActiveCallSession persona={persona} />;
}

function ActiveCallSession({ persona }: { persona: VirtualPersona }) {
  const router = useRouter();
  const [isChatDrawerOpen, setIsChatDrawerOpen] = useState(false);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [typedMessage, setTypedMessage] = useState('');
  const userVideoRef = useRef<HTMLVideoElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const logScrollRef = useRef<HTMLDivElement>(null);

  const {
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
  } = useVirtualCall(persona);

  // Attach local stream to user video element & STRICTLY MUTE to eliminate local audio feedback
  useEffect(() => {
    if (userVideoRef.current) {
      userVideoRef.current.muted = true;
      userVideoRef.current.volume = 0;
      if (localStream) {
        userVideoRef.current.srcObject = localStream;
      }
    }
  }, [localStream]);

  // Auto scroll chat drawer
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatHistory, isChatDrawerOpen]);

  // Auto scroll diagnostics log drawer
  useEffect(() => {
    if (logScrollRef.current) {
      logScrollRef.current.scrollTop = 0;
    }
  }, [diagnosticLogs, isDiagnosticsOpen]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSendTyped = (e: React.FormEvent) => {
    e.preventDefault();
    if (!typedMessage.trim()) return;
    sendUserMessage(typedMessage.trim());
    setTypedMessage('');
  };

  const handleExitCall = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    endCall();
    window.location.href = '/virtual';
  };

  return (
    <div className="fixed inset-0 z-50 bg-black text-white flex flex-col overflow-hidden select-none">
      {/* ── TOP CALL HEADER ────────────────────────────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <button
            onClick={handleExitCall}
            className="flex items-center gap-2 text-xs sm:text-sm text-gray-300 hover:text-white bg-white/10 px-3 py-1.5 rounded-full backdrop-blur-md transition-colors cursor-pointer"
          >
            <FaChevronLeft className="text-xs" />
            <span className="hidden sm:inline">Exit Call</span>
          </button>

          <div className="flex items-center gap-2 text-xs font-semibold bg-white/10 px-3 py-1.5 rounded-full backdrop-blur-md">
            <FaLock className="text-emerald-400 text-xs" />
            <span className="text-gray-200 hidden sm:inline">Encrypted 1-on-1 Call</span>
          </div>

          {/* Persona Identity Tag */}
          <div className="flex items-center gap-2 bg-pink-500/20 border border-pink-500/40 px-3 py-1.5 rounded-full backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-xs font-bold text-pink-200">
              {persona.name}, {persona.age}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Call Timer */}
          <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-full backdrop-blur-md text-xs font-mono text-gray-200">
            <FaClock className="text-pink-400 text-xs" />
            <span>{formatDuration(callDuration)}</span>
          </div>

          {/* Diagnostics Panel Toggle */}
          <button
            onClick={() => setIsDiagnosticsOpen(true)}
            className="flex items-center gap-1.5 text-xs bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-200 px-3 py-1.5 rounded-full backdrop-blur-md transition-colors"
          >
            <FaTerminal className="text-xs text-purple-300" />
            <span className="hidden sm:inline">Diagnostics</span>
          </button>
        </div>
      </div>

      {/* ── MAIN AVATAR CANVAS AREA ────────────────────────────────────────── */}
      <div className="relative flex-1 w-full h-full overflow-hidden bg-gradient-to-b from-gray-950 to-black flex items-center justify-center">
        <VirtualAvatarCanvas
          persona={persona}
          action={avatarAction}
          outfit={outfit}
          isSpeaking={isSpeaking}
          isListening={isListening}
          isProcessing={isProcessing}
          audioLevel={audioLevel}
        />

        {/* Dynamic Action Overlay Badge */}
        <AnimatePresence>
          {avatarAction !== 'idle' && avatarAction !== 'speaking' && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.9 }}
              className="absolute top-20 left-1/2 -translate-x-1/2 z-20 px-4 py-1.5 rounded-full bg-pink-500/30 border border-pink-400/50 backdrop-blur-md text-pink-200 text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg"
            >
              <HiSparkles className="text-amber-300 animate-spin" style={{ animationDuration: '4s' }} />
              <span>Action: {avatarAction.replace('_', ' ')}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Live Subtitle / Caption Banner */}
        <AnimatePresence>
          {currentCaption && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute bottom-28 left-4 right-4 sm:left-1/2 sm:-translate-x-1/2 sm:max-w-2xl z-20 text-center"
            >
              <div className="inline-block px-5 py-2.5 rounded-2xl bg-black/75 backdrop-blur-md border border-white/20 text-white text-sm sm:text-base font-medium shadow-2xl leading-relaxed">
                {currentCaption}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* User PIP WebCam Box */}
        <div className="absolute top-20 right-4 sm:right-6 z-20 w-28 h-36 sm:w-36 sm:h-48 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl bg-gray-900 group">
          <video
            ref={userVideoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover transform -scale-x-100 ${
              isVideoOff ? 'hidden' : 'block'
            }`}
          />
          {isVideoOff && (
            <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-gray-900 text-xs p-2 text-center">
              <FaVideoSlash className="text-xl mb-1 text-red-400" />
              <span>Camera Off</span>
            </div>
          )}

          {/* User Mic Status Indicator in PIP */}
          <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full text-[10px] text-white">
            {isMicMuted ? (
              <FaMicrophoneSlash className="text-red-400" />
            ) : (
              <FaMicrophone className={isListening ? 'text-emerald-400 animate-pulse' : 'text-gray-300'} />
            )}
            <span>You</span>
          </div>

          {/* Audio Visualizer Ring */}
          {!isMicMuted && isListening && audioLevel > 5 && (
            <div
              className="absolute inset-0 rounded-2xl border-2 border-emerald-400 pointer-events-none animate-ping opacity-75"
              style={{ animationDuration: '1.5s' }}
            />
          )}
        </div>

        {/* AI Speaking / Listening Waves Animation */}
        <div className="absolute bottom-28 left-6 z-20 hidden md:flex items-center gap-2 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-xs">
          {isProcessing ? (
            <div className="flex items-center gap-2 text-amber-300 font-semibold">
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>{persona.name} is thinking...</span>
            </div>
          ) : isSpeaking ? (
            <div className="flex items-center gap-2 text-pink-300 font-semibold">
              <div className="w-2 h-2 rounded-full bg-pink-400 animate-pulse" />
              <span>{persona.name} is talking...</span>
            </div>
          ) : isListening ? (
            <div className="flex items-center gap-2 text-emerald-300 font-semibold">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Listening to you...</span>
            </div>
          ) : (
            <span className="text-gray-400">Ready</span>
          )}
        </div>
      </div>

      {/* ── BOTTOM CALL CONTROL BAR ────────────────────────────────────────── */}
      <div className="relative z-30 px-4 sm:px-8 py-4 sm:py-5 bg-gradient-to-t from-black via-black/90 to-transparent flex items-center justify-between gap-4">
        {/* Left Side: Language & Trigger Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={toggleMicLanguage}
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/10 text-xs font-bold text-purple-200 backdrop-blur-md transition-colors"
          >
            <span>Mic: {micLanguage === 'hi-IN' ? '🇮🇳 Hindi' : '🇬🇧 English'}</span>
          </button>

          {/* Quick Outfit / Persona action trigger */}
          <button
            onClick={cycleOutfit}
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/10 text-xs font-bold text-gray-200 backdrop-blur-md transition-colors"
          >
            <FaRedoAlt className="text-xs text-pink-400" />
            <span className="capitalize">Style: {outfit}</span>
          </button>
        </div>

        {/* Center: Primary Call Controls (Mic, Video, End Call) */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Mute/Unmute Mic */}
          <button
            onClick={toggleMic}
            className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center text-lg sm:text-xl transition-all duration-200 shadow-xl ${
              isMicMuted
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-white/15 text-white hover:bg-white/25 border border-white/20 backdrop-blur-md'
            }`}
          >
            {isMicMuted ? <FaMicrophoneSlash /> : <FaMicrophone className={isListening ? 'text-emerald-400' : ''} />}
          </button>

          {/* End Call Button */}
          <button
            onClick={handleExitCall}
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center text-xl sm:text-2xl shadow-2xl shadow-red-600/50 hover:scale-105 active:scale-95 transition-all"
          >
            <FaPhoneSlash />
          </button>

          {/* Video Camera Toggle */}
          <button
            onClick={toggleVideo}
            className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center text-lg sm:text-xl transition-all duration-200 shadow-xl ${
              isVideoOff
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-white/15 text-white hover:bg-white/25 border border-white/20 backdrop-blur-md'
            }`}
          >
            {isVideoOff ? <FaVideoSlash /> : <FaVideo />}
          </button>
        </div>

        {/* Right Side: Text Chat Drawer Toggle */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setIsChatDrawerOpen(!isChatDrawerOpen)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs sm:text-sm font-bold transition-all ${
              isChatDrawerOpen
                ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/30'
                : 'bg-white/10 hover:bg-white/20 border border-white/10 text-gray-200 backdrop-blur-md'
            }`}
          >
            <FaCommentDots className="text-sm" />
            <span className="hidden sm:inline">Text Chat</span>
            {chatHistory.length > 1 && (
              <span className="w-5 h-5 rounded-full bg-pink-600 text-white text-[10px] flex items-center justify-center font-bold">
                {chatHistory.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── CHAT DRAWER MODAL / SIDEBAR ────────────────────────────────────── */}
      <AnimatePresence>
        {isChatDrawerOpen && (
          <motion.div
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 300 }}
            className="absolute top-16 right-4 bottom-24 w-80 sm:w-96 z-40 bg-gray-950/95 backdrop-blur-xl border border-purple-500/30 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
          >
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FaCommentDots className="text-pink-400" />
                <h3 className="font-bold text-sm text-white">Live Conversation</h3>
              </div>
              <button
                onClick={() => setIsChatDrawerOpen(false)}
                className="text-gray-400 hover:text-white text-xs font-bold px-2 py-1 bg-white/10 rounded-lg"
              >
                Close
              </button>
            </div>

            <div ref={chatScrollRef} className="flex-1 p-4 overflow-y-auto space-y-3 text-xs">
              {chatHistory.map((item, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col ${item.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] px-3.5 py-2 rounded-2xl ${
                      item.sender === 'user'
                        ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-br-none'
                        : 'bg-white/10 text-gray-200 border border-white/10 rounded-bl-none'
                    }`}
                  >
                    {item.text}
                  </div>
                  <span className="text-[10px] text-gray-500 mt-1 px-1">{item.timestamp}</span>
                </div>
              ))}
            </div>

            {/* Typed Chat Input */}
            <form onSubmit={handleSendTyped} className="p-3 border-t border-white/10 flex items-center gap-2">
              <Input
                size="sm"
                placeholder={`Message ${persona.name}...`}
                value={typedMessage}
                onChange={(e) => setTypedMessage(e.target.value)}
                variant="bordered"
                classNames={{
                  input: 'text-white text-xs',
                  inputWrapper: 'border-white/20 bg-black/40',
                }}
              />
              <Button
                type="submit"
                isIconOnly
                size="sm"
                className="bg-pink-500 hover:bg-pink-600 text-white rounded-xl"
              >
                <FaPaperPlane className="text-xs" />
              </Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── DIAGNOSTICS & SYSTEM LOGS MODAL ─────────────────────────────────── */}
      <Modal
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
        size="2xl"
        className="bg-gray-950 text-white border border-purple-500/30 rounded-3xl"
      >
        <ModalContent>
          <ModalHeader className="border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold">
              <FaTerminal className="text-purple-400" />
              <span>Live Diagnostics &amp; Telemetry</span>
            </div>
          </ModalHeader>
          <ModalBody className="p-4 space-y-4 max-h-[420px] overflow-y-auto">
            {/* Quick Action Tools */}
            <div className="flex flex-wrap gap-2 p-3 rounded-2xl bg-white/5 border border-white/10 text-xs">
              <Button
                size="sm"
                variant="flat"
                color="secondary"
                startContent={<FaSyncAlt />}
                onClick={forceRestartMic}
              >
                Restart Speech Recognition
              </Button>
              <Button
                size="sm"
                variant="flat"
                color="primary"
                startContent={<FaVolumeUp />}
                onClick={testAudioSynthesis}
              >
                Test Voice Audio
              </Button>
              <Button
                size="sm"
                variant="flat"
                color="danger"
                startContent={<FaTrash />}
                onClick={clearDiagnosticLogs}
              >
                Clear Logs
              </Button>
            </div>

            {/* Realtime Event Logs Stream */}
            <div
              ref={logScrollRef}
              className="p-3 rounded-2xl bg-black border border-white/10 font-mono text-[11px] space-y-1.5 max-h-60 overflow-y-auto"
            >
              {diagnosticLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                  <span className="text-gray-500">[{log.timestamp}]</span>
                  <span
                    className={`font-bold ${
                      log.category === 'AI'
                        ? 'text-purple-400'
                        : log.category === 'STT'
                        ? 'text-emerald-400'
                        : log.category === 'TTS'
                        ? 'text-pink-400'
                        : 'text-gray-400'
                    }`}
                  >
                    [{log.category}]
                  </span>
                  <span
                    className={
                      log.level === 'error'
                        ? 'text-red-400'
                        : log.level === 'warn'
                        ? 'text-amber-400'
                        : log.level === 'success'
                        ? 'text-emerald-300'
                        : 'text-gray-300'
                    }
                  >
                    {log.message}
                  </span>
                </div>
              ))}
            </div>
          </ModalBody>
          <ModalFooter className="border-t border-white/10">
            <Button size="sm" color="primary" onClick={() => setIsDiagnosticsOpen(false)}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
