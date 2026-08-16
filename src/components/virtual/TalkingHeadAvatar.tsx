'use client';

/**
 * TalkingHeadAvatar — iframe wrapper around /public/avatar-player.html
 *
 * TalkingHead.js loads via CDN inside the iframe (ESM importmap).
 * This completely bypasses Next.js webpack/SSR — zero bundling issues.
 * Communication: postMessage API (React → iframe & iframe → React).
 *
 * Features (all from TalkingHead.js + Three.js running in iframe):
 * - Real-time 15-viseme lip sync from audio PCM stream
 * - Natural eye blinking & gaze tracking
 * - Breathing & head movement at 60 FPS
 * - Mood expressions: happy / love / neutral
 * - setView() for activity poses
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { VirtualPersona } from '@/lib/virtualPersonas';
import { AvatarActionType, OutfitStyle } from './ThreeAvatarScene';
import { FaHeart, FaVolumeUp } from 'react-icons/fa';

interface Props {
  persona: VirtualPersona;
  isSpeaking: boolean;
  isListening: boolean;
  isProcessing: boolean;
  audioLevel: number;
  currentSpeechText?: string;
  action?: AvatarActionType;
  outfit?: OutfitStyle;
}

export default function TalkingHeadAvatar({
  persona,
  isSpeaking,
  isListening,
  isProcessing,
  audioLevel,
  currentSpeechText,
  action = 'idle',
  outfit = 'casual',
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const iframeReadyRef = useRef(false);
  const speakingRef = useRef(false);
  const prevActionRef = useRef<AvatarActionType>('idle');

  // ── Post message to iframe ─────────────────────────────────────────────────
  const sendMessage = useCallback((type: string, payload?: Record<string, unknown>) => {
    try {
      iframeRef.current?.contentWindow?.postMessage({ type, payload }, '*');
    } catch (_) {}
  }, []);

  // ── Listen for messages from iframe ───────────────────────────────────────
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!e.data || typeof e.data !== 'object') return;
      const { type } = e.data;
      if (type === 'AVATAR_READY') {
        // Iframe loaded and script ready — send INIT with photo URL
        iframeReadyRef.current = true;
        sendMessage('INIT', {
          photoUrl: persona.avatarImage,
          gender: persona.gender === 'woman' ? 'female' : 'male',
        });
      } else if (type === 'AVATAR_LOADED') {
        setStatus('ready');
      } else if (type === 'AVATAR_ERROR') {
        setStatus('error');
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [persona.gender, sendMessage]);

  // ── Speaking control ───────────────────────────────────────────────────────
  useEffect(() => {
    if (status !== 'ready') return;

    if (isSpeaking && !speakingRef.current) {
      speakingRef.current = true;
      sendMessage('SPEAKING_START', { audioLevel });
    } else if (!isSpeaking && speakingRef.current) {
      speakingRef.current = false;
      sendMessage('SPEAKING_STOP');
    } else if (isSpeaking) {
      // Update level continuously
      sendMessage('SPEAKING_UPDATE', { audioLevel });
    }
  }, [isSpeaking, audioLevel, status, sendMessage]);

  // ── Listening state ────────────────────────────────────────────────────────
  useEffect(() => {
    if (status !== 'ready') return;
    sendMessage('LISTENING', { active: isListening });
  }, [isListening, status, sendMessage]);

  // ── Activity actions ───────────────────────────────────────────────────────
  useEffect(() => {
    if (status !== 'ready') return;
    if (action === prevActionRef.current) return;
    prevActionRef.current = action;
    sendMessage('SET_ACTION', { action, outfit });
  }, [action, outfit, status, sendMessage]);

  return (
    <div
      className="relative w-full h-full rounded-2xl overflow-hidden select-none shadow-2xl border border-purple-500/20"
      style={{ background: 'radial-gradient(ellipse at 50% 40%, #0f0a1e 0%, #060610 100%)' }}
    >
      {/* ── TalkingHead iframe — CDN-loaded, zero webpack ───────────────────── */}
      <iframe
        ref={iframeRef}
        src="/avatar-player.html"
        className="absolute inset-0 w-full h-full border-0"
        style={{
          background: 'transparent',
          opacity: status === 'ready' ? 1 : 0,
          transition: 'opacity 0.5s ease',
        }}
        allow="autoplay"
        title={`${persona.name} avatar`}
      />

      {/* ── Loading overlay ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {status === 'loading' && (
          <motion.div
            key="loading"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-gradient-to-b from-gray-950 to-black"
          >
            <div className="relative mb-5">
              <div className="w-16 h-16 border-4 border-purple-500/20 border-t-purple-400 rounded-full animate-spin" />
              <div
                className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-pink-400 rounded-full animate-spin"
                style={{ animationDuration: '1.5s', animationDirection: 'reverse' }}
              />
            </div>
            <p className="text-purple-300 text-sm font-semibold">Loading 3D Avatar…</p>
            <p className="text-gray-600 text-xs mt-1 text-center px-4">
              TalkingHead.js · Three.js WebGL · ReadyPlayerMe
            </p>
          </motion.div>
        )}

        {status === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-gray-950 text-center px-8"
          >
            <div className="text-5xl mb-3">⚠️</div>
            <p className="text-white font-semibold">3D Avatar Unavailable</p>
            <p className="text-gray-500 text-xs mt-1">Avatar model could not be loaded</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Speaking glow aura ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {isSpeaking && status === 'ready' && (
          <motion.div
            key="aura"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.08, 0.3, 0.08] }}
            exit={{ opacity: 0 }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="absolute inset-0 z-10 pointer-events-none rounded-2xl"
            style={{
              background:
                'radial-gradient(ellipse at 50% 28%, rgba(160,80,255,0.15) 0%, transparent 62%)',
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Bottom gradient for name readability ─────────────────────────────── */}
      <div className="absolute inset-x-0 bottom-0 h-1/3 z-20 pointer-events-none bg-gradient-to-t from-black/90 via-black/30 to-transparent rounded-b-2xl" />

      {/* ── Status badge (top-left) ─────────────────────────────────────────── */}
      <div className="absolute top-3 left-3 z-40 flex items-center gap-2">
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full backdrop-blur-md border text-xs font-semibold shadow text-white ${
            isSpeaking
              ? 'bg-pink-900/80 border-pink-500/40'
              : isListening
              ? 'bg-emerald-900/80 border-emerald-500/40'
              : isProcessing
              ? 'bg-amber-900/80 border-amber-500/40'
              : 'bg-black/60 border-white/15'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isSpeaking
                ? 'bg-pink-400 animate-ping'
                : isListening
                ? 'bg-emerald-400 animate-pulse'
                : isProcessing
                ? 'bg-amber-400 animate-bounce'
                : 'bg-indigo-400'
            }`}
          />
          {isSpeaking
            ? 'Speaking...'
            : isProcessing
            ? 'Thinking...'
            : isListening
            ? 'Listening...'
            : 'Connected'}
        </div>

        {isSpeaking && (
          <div className="flex items-center gap-0.5 px-2 py-1 rounded-full bg-pink-900/70 border border-pink-500/30 text-pink-300">
            <FaVolumeUp className="text-[10px] mr-1 animate-pulse" />
            {[0, 120, 240].map((d) => (
              <span
                key={d}
                className="w-0.5 rounded-full bg-pink-400 animate-bounce"
                style={{
                  height: `${8 + audioLevel * 12}px`,
                  animationDelay: `${d}ms`,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Action badge (top-right) ────────────────────────────────────────── */}
      <div className="absolute top-3 right-3 z-40 flex items-center gap-2">
        <AnimatePresence>
          {action !== 'idle' && action !== 'speaking' && (
            <motion.div
              key={action}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-900/85 backdrop-blur-md border border-purple-400/40 text-purple-100 text-xs font-semibold shadow-xl"
            >
              {action === 'standing' && '🧍 Standing'}
              {action === 'sitting' && '🪑 Sitting'}
              {action === 'cooking' && '☕ Coffee'}
              {action === 'changing_clothes' && `👗 ${outfit}`}
              {action === 'workout' && '💪 Workout'}
              {action === 'wave' && '👋 Waving'}
              {action === 'kiss' && '💋 Kiss'}
            </motion.div>
          )}
        </AnimatePresence>
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 text-white text-xs">
          <FaHeart className="text-rose-400 text-[10px] animate-pulse" />
          <span className="text-gray-300 font-medium">{persona.traits.warmth}%</span>
        </div>
      </div>

      {/* ── Name overlay (bottom-left) ────────────────────────────────────────── */}
      <div className="absolute bottom-5 left-5 z-40 text-white">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-xl font-bold tracking-tight drop-shadow-lg">
            {persona.name}, {persona.age}
          </h3>
          <span className="px-2 py-0.5 rounded-full bg-purple-500/80 text-[10px] font-semibold backdrop-blur-sm">
            AI Companion
          </span>
          <span className="px-1.5 py-0.5 rounded-full bg-cyan-600/70 text-[9px] font-bold text-cyan-100">
            3D Live
          </span>
        </div>
        <p className="text-[11px] text-purple-200 font-medium mt-0.5 drop-shadow-sm">
          {persona.title} · {persona.location}
        </p>
      </div>
    </div>
  );
}
