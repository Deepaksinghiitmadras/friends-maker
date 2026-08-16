'use client';

import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { VirtualPersona } from '@/lib/virtualPersonas';
import { FaHeart, FaVolumeUp } from 'react-icons/fa';

interface Props {
  persona: VirtualPersona;
  isSpeaking: boolean;
  isListening: boolean;
  isProcessing: boolean;
  audioLevel: number;
}

export default function VirtualAvatarCanvas({
  persona,
  isSpeaking,
  isListening,
  isProcessing,
  audioLevel,
}: Props) {
  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden bg-gray-950 flex items-center justify-center select-none shadow-2xl border border-purple-500/20">
      {/* ── BACKGROUND LIVE VIDEO STREAM AMBIENCE ──────────────────────────── */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/60 z-10 pointer-events-none" />

      {/* Dynamic Aura Glow when Avatar is Speaking */}
      {isSpeaking && (
        <motion.div
          className="absolute inset-0 z-0 bg-gradient-to-r from-pink-600/30 via-purple-600/30 to-indigo-600/30 blur-2xl pointer-events-none"
          animate={{
            opacity: [0.3, 0.7, 0.3],
            scale: [0.98, 1.02, 0.98],
          }}
          transition={{
            repeat: Infinity,
            duration: 1.5,
            ease: 'easeInOut',
          }}
        />
      )}

      {/* ── HIGH DEFINITION AVATAR PORTRAIT & ANIMATION ──────────────────────── */}
      <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
        <motion.div
          className="relative w-full h-full"
          animate={
            isSpeaking
              ? {
                  scale: [1, 1.015 + audioLevel * 0.02, 1],
                  y: [0, -2, 0],
                }
              : isListening
              ? {
                  scale: [1, 1.005, 1],
                  y: [0, -1, 0],
                }
              : {
                  scale: 1,
                  y: 0,
                }
          }
          transition={{
            repeat: Infinity,
            duration: isSpeaking ? 0.35 : 3.5,
            ease: 'easeInOut',
          }}
        >
          <Image
            src={persona.avatarImage}
            alt={persona.name}
            fill
            className="object-cover object-center filter brightness-95 contrast-105"
            priority
            sizes="100vw"
          />
        </motion.div>
      </div>

      {/* ── LIVE CALL STATUS BADGE ─────────────────────────────────────────── */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white text-xs font-semibold shadow-lg">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isSpeaking
                  ? 'bg-pink-500 animate-ping'
                  : isListening
                  ? 'bg-emerald-400 animate-pulse'
                  : isProcessing
                  ? 'bg-amber-400 animate-bounce'
                  : 'bg-indigo-400'
              }`}
            />
            <span>
              {isSpeaking
                ? 'Speaking...'
                : isProcessing
                ? 'Thinking...'
                : isListening
                ? 'Listening to you...'
                : 'Connected'}
            </span>
          </div>
        </div>

        {/* Audio Wave Visualizer when companion speaks */}
        {isSpeaking && (
          <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-pink-900/60 backdrop-blur-md border border-pink-500/30 text-pink-300 text-xs">
            <FaVolumeUp className="text-xs mr-1 animate-pulse" />
            <span className="w-1 h-3 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1 h-4 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1 h-2.5 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        )}
      </div>

      {/* ── COMPANION NAME & INFO OVERLAY ────────────────────────────────────── */}
      <div className="absolute bottom-6 left-6 z-20 text-white">
        <div className="flex items-center gap-2">
          <h3 className="text-2xl font-bold tracking-tight drop-shadow-lg">
            {persona.name}, {persona.age}
          </h3>
          <span className="px-2 py-0.5 rounded-full bg-purple-500/80 text-[11px] font-semibold tracking-wide backdrop-blur-sm shadow-sm">
            AI Companion
          </span>
        </div>
        <p className="text-xs text-purple-200 font-medium drop-shadow-sm mt-0.5 flex items-center gap-2">
          <span>{persona.title}</span>
          <span>•</span>
          <span>{persona.location}</span>
        </p>
      </div>

      {/* ── EMOTIONAL IQ / WARMTH BADGE ──────────────────────────────────────── */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white text-xs">
        <FaHeart className="text-rose-400 text-xs animate-pulse" />
        <span className="text-xs text-gray-300 font-medium">Warmth {persona.traits.warmth}%</span>
      </div>
    </div>
  );
}
