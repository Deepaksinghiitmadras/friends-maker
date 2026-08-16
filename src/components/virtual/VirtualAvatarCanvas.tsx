'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { VirtualPersona } from '@/lib/virtualPersonas';
import { FaHeart, FaVolumeUp, FaCube, FaVideo } from 'react-icons/fa';
import ThreeAvatarScene, { AvatarActionType, OutfitStyle } from './ThreeAvatarScene';

interface Props {
  persona: VirtualPersona;
  isSpeaking: boolean;
  isListening: boolean;
  isProcessing: boolean;
  audioLevel: number;
  action?: AvatarActionType;
  outfit?: OutfitStyle;
}

export default function VirtualAvatarCanvas({
  persona,
  isSpeaking,
  isListening,
  isProcessing,
  audioLevel,
  action = 'idle',
  outfit = 'casual',
}: Props) {
  const [renderMode, setRenderMode] = useState<'3d' | 'cinematic'>('3d');

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden bg-gray-950 flex items-center justify-center select-none shadow-2xl border border-purple-500/20">
      {/* ── BACKGROUND LIVE STREAM AMBIENCE ───────────────────────────────── */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/50 z-10 pointer-events-none" />

      {/* Dynamic Aura Glow when Avatar is Speaking */}
      {isSpeaking && (
        <motion.div
          className="absolute inset-0 z-0 bg-gradient-to-r from-pink-600/25 via-purple-600/25 to-indigo-600/25 blur-3xl pointer-events-none"
          animate={{
            opacity: [0.3, 0.75, 0.3],
            scale: [0.98, 1.02, 0.98],
          }}
          transition={{
            repeat: Infinity,
            duration: 1.5,
            ease: 'easeInOut',
          }}
        />
      )}

      {/* ── 1. 3D WEBGL AVATAR ENGINE OR 2. CINEMATIC REAL-LIFE MOTION ─────── */}
      <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
        {renderMode === '3d' ? (
          <ThreeAvatarScene
            persona={persona}
            isSpeaking={isSpeaking}
            audioLevel={audioLevel}
            action={action}
            outfit={outfit}
          />
        ) : (
          /* 🎬 Cinematic Real-Life Video Motion Mode */
          <motion.div
            className="relative w-full h-full"
            animate={
              isSpeaking
                ? {
                    scale: [1, 1.02 + audioLevel * 0.03, 1],
                    y: [0, -3, 0],
                    rotate: [0, 0.5, -0.5, 0],
                  }
                : isListening
                ? {
                    scale: [1, 1.008, 1],
                    y: [0, -1.5, 0],
                  }
                : action === 'standing'
                ? { scale: 0.85, y: -20 }
                : action === 'cooking'
                ? { x: [0, -15, 0], scale: 1.02 }
                : action === 'workout'
                ? { y: [0, -25, 0], scale: [1, 1.04, 1] }
                : action === 'kiss'
                ? { scale: 1.12, y: 0 }
                : {
                    scale: [1, 1.006, 1],
                    y: [0, -1, 0],
                  }
            }
            transition={{
              repeat: Infinity,
              duration: isSpeaking ? 0.35 : action === 'workout' ? 0.8 : 3.5,
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
            {/* Cinematic Live Motion Overlay Shimmer */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/5 to-transparent mix-blend-overlay animate-pulse pointer-events-none" />
          </motion.div>
        )}
      </div>

      {/* ── LIVE ACTION FLOATING BADGE (COOKING, WORKOUT, OUTFIT, ETC) ─────── */}
      <AnimatePresence>
        {action !== 'idle' && action !== 'speaking' && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.9 }}
            className="absolute top-16 left-4 z-30 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-900/80 backdrop-blur-md border border-purple-400/40 text-purple-100 text-xs font-semibold shadow-xl"
          >
            <span>
              {action === 'standing' && '🪑 Standing Up'}
              {action === 'sitting' && '🪑 Sitting Down'}
              {action === 'cooking' && '☕ Preparing Warm Coffee...'}
              {action === 'changing_clothes' && `👗 Changing Outfit (${outfit.toUpperCase()})`}
              {action === 'workout' && '💪 Workout Session'}
              {action === 'wave' && '👋 Waving Hello'}
              {action === 'kiss' && '💋 Blowing a Kiss'}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── TOP-LEFT: LIVE CALL STATUS BADGE ───────────────────────────────── */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/65 backdrop-blur-md border border-white/15 text-white text-xs font-semibold shadow-lg">
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
          <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-pink-900/70 backdrop-blur-md border border-pink-500/30 text-pink-300 text-xs">
            <FaVolumeUp className="text-xs mr-1 animate-pulse" />
            <span className="w-1 h-3 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1 h-4 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1 h-2.5 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        )}
      </div>

      {/* ── TOP-RIGHT: 3D / CINEMATIC MODE TOGGLE & WARMTH ─────────────────── */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        {/* Render Engine Switcher */}
        <div className="flex items-center bg-black/60 backdrop-blur-md border border-white/15 rounded-full p-0.5 shadow-lg">
          <button
            onClick={() => setRenderMode('3d')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
              renderMode === '3d'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <FaCube className="text-[10px]" />
            <span>3D Avatar</span>
          </button>
          <button
            onClick={() => setRenderMode('cinematic')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
              renderMode === 'cinematic'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <FaVideo className="text-[10px]" />
            <span>Cinematic</span>
          </button>
        </div>

        {/* Warmth indicator */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white text-xs">
          <FaHeart className="text-rose-400 text-xs animate-pulse" />
          <span className="text-xs text-gray-300 font-medium">{persona.traits.warmth}%</span>
        </div>
      </div>

      {/* ── BOTTOM-LEFT: COMPANION NAME & INFO OVERLAY ───────────────────────── */}
      <div className="absolute bottom-6 left-6 z-20 text-white">
        <div className="flex items-center gap-2">
          <h3 className="text-2xl font-bold tracking-tight drop-shadow-lg">
            {persona.name}, {persona.age}
          </h3>
          <span className="px-2 py-0.5 rounded-full bg-purple-500/80 text-[11px] font-semibold tracking-wide backdrop-blur-sm shadow-sm">
            AI Companion
          </span>
          <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] uppercase font-semibold backdrop-blur-sm">
            {outfit}
          </span>
        </div>
        <p className="text-xs text-purple-200 font-medium drop-shadow-sm mt-0.5 flex items-center gap-2">
          <span>{persona.title}</span>
          <span>•</span>
          <span>{persona.location}</span>
        </p>
      </div>
    </div>
  );
}
