'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getPersonaById } from '@/lib/virtualPersonas';
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
import { Button, Input, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from '@nextui-org/react';
import { motion, AnimatePresence } from 'framer-motion';

export default function VirtualVideoCallPage() {
  const params = useParams<{ personaId: string }>();
  const router = useRouter();
  const persona = getPersonaById(params.personaId);

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
  } = useVirtualCall(
    persona || {
      id: 'elena-rostova',
      name: 'Companion',
      age: 28,
      gender: 'woman',
      title: 'AI Companion',
      location: 'Online',
      tagline: '',
      avatarImage: '',
      personality: '',
      interests: [],
      languages: ['English'],
      greeting: 'Hello!',
      voiceStyle: { pitch: 1, rate: 1 },
      systemPrompt: '',
      traits: { warmth: 90, humor: 90, intellect: 90, energy: 90 },
      sampleQuestions: [],
    }
  );

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

  if (!persona) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-2xl font-bold mb-4">Companion Not Found</h2>
        <Button as={Link} href="/virtual" color="primary">
          Back to Virtual Companions
        </Button>
      </div>
    );
  }

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

          {/* Microphone Language Switcher (Hindi / English) */}
          <button
            onClick={toggleMicLanguage}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-purple-900/80 hover:bg-purple-800 border border-purple-400/40 text-purple-100 backdrop-blur-md transition-all cursor-pointer shadow-md"
            title="Click to switch your microphone language between Hindi and English"
          >
            <span>{micLanguage === 'hi-IN' ? '🇮🇳 Mic: Hindi' : '🌐 Mic: English'}</span>
            <span className="text-[10px] text-purple-300">⇄ Switch</span>
          </button>

          {/* Languages Spoken Badge */}
          {persona.languages && persona.languages.length > 0 && (
            <div className="hidden lg:flex items-center gap-1.5 text-xs font-semibold bg-white/10 border border-white/15 px-3 py-1.5 rounded-full backdrop-blur-md text-purple-200">
              <span className="text-[10px] text-purple-400 font-bold uppercase">Speaks:</span>
              <span className="text-white font-medium">{persona.languages.join(' · ')}</span>
            </div>
          )}

          {/* Live Diagnostics HUD Toggle Button */}
          <button
            onClick={() => setIsDiagnosticsOpen((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all backdrop-blur-md cursor-pointer border ${
              isDiagnosticsOpen
                ? 'bg-amber-500 text-black border-amber-400 shadow-lg shadow-amber-500/30'
                : 'bg-white/10 text-amber-300 hover:bg-white/20 border-amber-500/30'
            }`}
            title="Open Live Pipeline Diagnostics & Debug Log"
          >
            <FaTerminal className="text-[11px]" />
            <span>Diagnostics</span>
            <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] bg-black/40 text-amber-200">
              {diagnosticLogs.length}
            </span>
          </button>
        </div>

        {/* Live Call Duration & Status */}
        <div className="flex items-center gap-2 bg-black/60 border border-white/10 px-3.5 py-1.5 rounded-full backdrop-blur-md text-xs font-mono font-bold text-pink-400">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
          <span>{formatDuration(callDuration)}</span>
        </div>
      </div>

      {/* ── MAIN VIDEO STAGE ────────────────────────────────────────────────── */}
      <div className="relative flex-1 min-h-0 w-full flex items-center justify-center p-2 sm:p-4 pt-16 pb-2">
        {/* Remote Companion Video Canvas */}
        <div className="relative w-full h-full max-w-5xl mx-auto rounded-3xl overflow-hidden shadow-2xl">
          <VirtualAvatarCanvas
            persona={persona}
            isSpeaking={isSpeaking}
            isListening={isListening}
            isProcessing={isProcessing}
            audioLevel={audioLevel}
            action={avatarAction}
            outfit={outfit}
          />

          {/* User Floating Video (Picture-in-Picture) */}
          <motion.div
            drag
            dragConstraints={{ left: 0, right: 300, top: 0, bottom: 400 }}
            className="absolute top-4 right-4 z-30 w-28 sm:w-40 aspect-[3/4] rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20 bg-gray-900 cursor-grab active:cursor-grabbing backdrop-blur-md"
          >
            {!isVideoOff ? (
              <video
                ref={userVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform -scale-x-100"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gray-800 text-gray-400 p-2 text-center text-xs">
                <FaVideoSlash className="text-xl mb-1 text-gray-500" />
                <span>Camera Off</span>
              </div>
            )}

            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between px-2 py-1 rounded-md bg-black/60 backdrop-blur-md text-[10px] text-white">
              <span className="font-semibold truncate">You</span>
              {isMicMuted && <FaMicrophoneSlash className="text-rose-400" />}
            </div>
          </motion.div>

          {/* Live Subtitles & Captions Overlay */}
          <div className="absolute bottom-16 sm:bottom-20 left-4 right-4 sm:left-12 sm:right-12 z-20 flex justify-center pointer-events-none">
            <AnimatePresence mode="wait">
              {currentCaption && (
                <motion.div
                  key={currentCaption}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="max-w-xl bg-black/85 backdrop-blur-xl border border-white/20 px-5 py-3 rounded-2xl text-xs sm:text-sm text-center text-white shadow-2xl"
                >
                  <p className="leading-snug">{currentCaption}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Suggested Icebreaker Questions */}
          <div className="absolute bottom-3 sm:bottom-4 left-4 right-4 z-20 flex items-center justify-center gap-2 overflow-x-auto py-1 no-scrollbar">
            {persona.sampleQuestions.map((q, idx) => (
              <button
                key={idx}
                onClick={() => sendUserMessage(q)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-black/70 hover:bg-black/95 backdrop-blur-md border border-white/20 text-xs text-purple-200 hover:text-white whitespace-nowrap transition-all duration-200 cursor-pointer shadow-md"
              >
                <HiSparkles className="text-xs text-amber-300" />
                <span>{q}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── LIVE DIAGNOSTICS & DEBUGGING HUD DRAWER ─────────────────────── */}
        <AnimatePresence>
          {isDiagnosticsOpen && (
            <motion.div
              initial={{ x: -400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -400, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute top-16 bottom-24 left-4 sm:left-8 z-40 w-84 sm:w-[420px] rounded-3xl bg-gray-950/95 backdrop-blur-2xl border border-amber-500/30 shadow-2xl flex flex-col overflow-hidden text-xs"
            >
              {/* Diagnostics Header */}
              <div className="p-3.5 border-b border-white/10 flex items-center justify-between bg-black/40">
                <div className="flex items-center gap-2">
                  <FaTerminal className="text-amber-400 text-sm" />
                  <h4 className="font-bold text-white text-sm">Pipeline Diagnostics</h4>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={clearDiagnosticLogs}
                    className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-white px-2 py-1 rounded bg-white/5"
                    title="Clear Logs"
                  >
                    <FaTrash className="text-[10px]" />
                    <span>Clear</span>
                  </button>
                  <button
                    onClick={() => setIsDiagnosticsOpen(false)}
                    className="text-gray-400 hover:text-white text-xs px-2 py-1 rounded-md bg-white/5"
                  >
                    Close
                  </button>
                </div>
              </div>

              {/* Status Badges Matrix */}
              <div className="p-3 bg-black/60 border-b border-white/10 grid grid-cols-3 gap-2 text-center text-[11px]">
                <div className="p-2 rounded-xl bg-gray-900 border border-white/10 flex flex-col items-center">
                  <span className="text-[10px] text-gray-400 uppercase font-semibold">Microphone</span>
                  <span
                    className={`font-bold mt-0.5 ${
                      isMicMuted
                        ? 'text-rose-400'
                        : isListening
                        ? 'text-emerald-400 animate-pulse'
                        : 'text-gray-400'
                    }`}
                  >
                    {isMicMuted ? 'Muted' : isListening ? 'Listening' : 'Paused'}
                  </span>
                </div>

                <div className="p-2 rounded-xl bg-gray-900 border border-white/10 flex flex-col items-center">
                  <span className="text-[10px] text-gray-400 uppercase font-semibold">AI Brain</span>
                  <span
                    className={`font-bold mt-0.5 ${
                      isProcessing ? 'text-amber-400 animate-bounce' : 'text-purple-400'
                    }`}
                  >
                    {isProcessing ? 'Thinking...' : 'Ready'}
                  </span>
                </div>

                <div className="p-2 rounded-xl bg-gray-900 border border-white/10 flex flex-col items-center">
                  <span className="text-[10px] text-gray-400 uppercase font-semibold">Companion TTS</span>
                  <span
                    className={`font-bold mt-0.5 ${
                      isSpeaking ? 'text-pink-400 animate-pulse' : 'text-gray-400'
                    }`}
                  >
                    {isSpeaking ? 'Speaking' : 'Silent'}
                  </span>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="px-3 py-2 bg-black/30 border-b border-white/10 flex items-center justify-between gap-2">
                <button
                  onClick={forceRestartMic}
                  className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/40 text-emerald-300 font-semibold cursor-pointer text-[11px]"
                >
                  <FaSyncAlt className="text-[10px]" />
                  <span>Restart Mic</span>
                </button>

                <button
                  onClick={testAudioSynthesis}
                  className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-pink-600/30 hover:bg-pink-600/50 border border-pink-500/40 text-pink-300 font-semibold cursor-pointer text-[11px]"
                >
                  <FaVolumeUp className="text-[10px]" />
                  <span>Test Voice</span>
                </button>
              </div>

              {/* Live Log Stream */}
              <div ref={logScrollRef} className="flex-grow p-3 overflow-y-auto space-y-1.5 font-mono text-[11px]">
                {diagnosticLogs.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    No pipeline events recorded yet. Start speaking or interact to view live logs.
                  </div>
                ) : (
                  diagnosticLogs.map((log) => (
                    <div
                      key={log.id}
                      className={`p-2 rounded-lg border leading-tight ${
                        log.level === 'error'
                          ? 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                          : log.level === 'warn'
                          ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                          : log.level === 'success'
                          ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                          : 'bg-gray-900/80 border-white/5 text-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                            log.category === 'STT'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : log.category === 'AI'
                              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                              : log.category === 'TTS'
                              ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30'
                              : log.category === 'AVATAR'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : log.category === 'ECHO'
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          }`}
                        >
                          {log.category}
                        </span>
                        <span className="text-[9px] text-gray-500">{log.timestamp}</span>
                      </div>
                      <p className="break-words font-sans text-xs">{log.message}</p>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── IN-CALL CHAT DRAWER ───────────────────────────────────────────── */}
        <AnimatePresence>
          {isChatDrawerOpen && (
            <motion.div
              initial={{ x: 350, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 350, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute top-16 bottom-24 right-4 sm:right-8 z-40 w-80 sm:w-96 rounded-3xl bg-gray-900/95 backdrop-blur-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FaCommentDots className="text-pink-500" />
                  <h4 className="font-bold text-sm text-white">In-Call Messages</h4>
                </div>
                <button
                  onClick={() => setIsChatDrawerOpen(false)}
                  className="text-gray-400 hover:text-white text-xs px-2 py-1 rounded-md bg-white/5"
                >
                  Close
                </button>
              </div>

              <div ref={chatScrollRef} className="flex-grow p-4 overflow-y-auto space-y-3">
                {chatHistory.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col ${
                      msg.sender === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`max-w-[85%] px-3.5 py-2 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                        msg.sender === 'user'
                          ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-br-none'
                          : 'bg-gray-800 text-gray-200 border border-white/10 rounded-bl-none'
                      }`}
                    >
                      {msg.text}
                    </div>
                    <span className="text-[10px] text-gray-500 mt-1 px-1">{msg.timestamp}</span>
                  </div>
                ))}
              </div>

              <form onSubmit={handleSendTyped} className="p-3 border-t border-white/10 flex gap-2">
                <Input
                  size="sm"
                  variant="bordered"
                  placeholder="Type a message..."
                  value={typedMessage}
                  onChange={(e) => setTypedMessage(e.target.value)}
                  className="text-white"
                />
                <Button
                  isIconOnly
                  size="sm"
                  type="submit"
                  className="bg-pink-500 text-white font-bold"
                >
                  <FaPaperPlane className="text-xs" />
                </Button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── BOTTOM CONTROLS & ACTIVITY BAR ──────────────────────────────────── */}
      <div className="flex-shrink-0 z-30 flex flex-col items-center gap-2 pb-4 pt-1 bg-gradient-to-t from-black via-black/90 to-transparent">
        {/* Real-Life Activity Actions */}
        <div className="flex items-center gap-1.5 p-1 rounded-full bg-black/70 backdrop-blur-xl border border-white/15 shadow-2xl overflow-x-auto no-scrollbar max-w-full">
          <button
            onClick={() => {
              if (avatarAction === 'standing') {
                triggerAction('idle');
              } else {
                triggerAction('standing', 10000);
                sendUserMessage('Can you stand up and show me your outfit?');
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer whitespace-nowrap"
            title="Ask companion to stand or sit"
          >
            <span>🪑</span>
            <span>{avatarAction === 'standing' ? 'Sit Down' : 'Stand Up'}</span>
          </button>

          <button
            onClick={() => {
              triggerAction('coffee' as any, 8000);
              sendUserMessage("Could you make us some warm coffee?");
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white/10 hover:bg-white/20 text-amber-200 transition-all cursor-pointer whitespace-nowrap"
            title="Ask companion to prepare coffee/food"
          >
            <span>☕</span>
            <span>Make Coffee</span>
          </button>

          <button
            onClick={cycleOutfit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white/10 hover:bg-white/20 text-pink-300 transition-all cursor-pointer whitespace-nowrap"
            title="Change companion outfit"
          >
            <span>👗</span>
            <span>Change Outfit</span>
          </button>

          <button
            onClick={() => {
              triggerAction('workout', 7000);
              sendUserMessage("Let's do a quick workout stretch together!");
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white/10 hover:bg-white/20 text-cyan-200 transition-all cursor-pointer whitespace-nowrap"
            title="Do a workout session"
          >
            <span>🤸</span>
            <span>Workout</span>
          </button>

          <button
            onClick={() => triggerAction('wave', 4000)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white/10 hover:bg-white/20 text-emerald-200 transition-all cursor-pointer whitespace-nowrap"
            title="Wave hand"
          >
            <span>👋</span>
            <span>Wave</span>
          </button>

          <button
            onClick={() => triggerAction('kiss', 5000)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white/10 hover:bg-white/20 text-rose-300 transition-all cursor-pointer whitespace-nowrap"
            title="Blow a kiss"
          >
            <span>💋</span>
            <span>Kiss</span>
          </button>
        </div>

        {/* Media Control Dock */}
        <div className="flex items-center justify-center gap-4 sm:gap-6">
          {/* Toggle Microphone */}
          <button
            onClick={toggleMic}
            className={`w-11 h-11 sm:w-13 sm:h-13 rounded-full flex items-center justify-center transition-all duration-200 shadow-xl cursor-pointer ${
              isMicMuted
                ? 'bg-rose-600 text-white hover:bg-rose-700 ring-4 ring-rose-500/30'
                : isListening
                ? 'bg-emerald-500 text-white hover:bg-emerald-600 ring-4 ring-emerald-400/40 animate-pulse'
                : 'bg-white/20 hover:bg-white/30 text-white backdrop-blur-md'
            }`}
            title={isMicMuted ? 'Unmute Mic' : 'Mute Mic'}
          >
            {isMicMuted ? <FaMicrophoneSlash className="text-lg" /> : <FaMicrophone className="text-lg" />}
          </button>

          {/* Toggle Camera */}
          <button
            onClick={toggleVideo}
            className={`w-11 h-11 sm:w-13 sm:h-13 rounded-full flex items-center justify-center transition-all duration-200 shadow-xl cursor-pointer ${
              isVideoOff
                ? 'bg-gray-700 text-white hover:bg-gray-600 ring-4 ring-gray-500/30'
                : 'bg-white/20 hover:bg-white/30 text-white backdrop-blur-md'
            }`}
            title={isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}
          >
            {isVideoOff ? <FaVideoSlash className="text-lg" /> : <FaVideo className="text-lg" />}
          </button>

          {/* In-Call Text Chat Toggle */}
          <button
            onClick={() => setIsChatDrawerOpen((prev) => !prev)}
            className={`w-11 h-11 sm:w-13 sm:h-13 rounded-full flex items-center justify-center transition-all duration-200 shadow-xl cursor-pointer ${
              isChatDrawerOpen
                ? 'bg-purple-600 text-white'
                : 'bg-white/20 hover:bg-white/30 text-white backdrop-blur-md'
            }`}
            title="Open Chat"
          >
            <FaCommentDots className="text-lg" />
          </button>

          {/* End Call / Hang Up */}
          <button
            onClick={handleExitCall}
            className="w-13 h-13 sm:w-15 sm:h-15 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center transition-all duration-200 shadow-2xl ring-4 ring-rose-500/30 hover:scale-105 active:scale-95 cursor-pointer"
            title="End Call"
          >
            <FaPhoneSlash className="text-xl" />
          </button>
        </div>
      </div>

      {/* ── CALL ENDED SUMMARY MODAL ────────────────────────────────────────── */}
      <Modal
        isOpen={callStatus === 'ended'}
        onClose={() => router.push('/virtual')}
        isDismissable={false}
        hideCloseButton
        backdrop="blur"
        className="bg-gray-900 border border-white/10 text-white"
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1 text-center">
            <h3 className="text-xl font-bold bg-gradient-to-r from-pink-500 to-purple-400 bg-clip-text text-transparent">
              Call Completed
            </h3>
            <p className="text-xs text-gray-400 font-normal">
              You connected with {persona.name}
            </p>
          </ModalHeader>
          <ModalBody className="py-6 flex flex-col items-center">
            <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-purple-500 mb-3 shadow-lg">
              <img
                src={persona.avatarImage}
                alt={persona.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <FaClock className="text-pink-400" />
              <span>Duration: {formatDuration(callDuration)}</span>
            </div>
            <p className="text-xs text-gray-400 text-center mt-3 max-w-xs">
              Hope you enjoyed the connection! Your conversation memory has been saved.
            </p>
          </ModalBody>
          <ModalFooter className="flex justify-center gap-3">
            <Button
              color="primary"
              variant="flat"
              onPress={() => window.location.reload()}
              startContent={<FaRedoAlt className="text-xs" />}
            >
              Call Again
            </Button>
            <Button
              color="primary"
              onPress={() => handleExitCall()}
              startContent={<FaUserFriends className="text-xs" />}
            >
              Explore More Companions
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
