'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { VirtualPersona } from '@/lib/virtualPersonas';
import { AvatarActionType, OutfitStyle } from './ThreeAvatarScene';
import { FaHeart, FaVolumeUp, FaWifi, FaCoffee, FaDumbbell } from 'react-icons/fa';

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

export default function VirtualAvatarCanvas({
  persona,
  isSpeaking,
  isListening,
  isProcessing,
  audioLevel,
  action = 'idle',
  outfit = 'casual',
}: Props) {
  const [steamParticles] = useState<number[]>([1, 2, 3, 4, 5]);
  const [idleVideoLoaded, setIdleVideoLoaded] = useState<boolean>(false);
  const [actionVideoReady, setActionVideoReady] = useState<boolean>(false);

  const idleVideoRef = useRef<HTMLVideoElement>(null);
  const prevActionSrcRef = useRef<string | undefined>(undefined);

  // Base idle video (always active in background)
  const idleVideoSrc = persona.videoClips?.idle;

  // ─── CRITICAL: Resolve action → video file path ──────────────────────────
  // This is the SINGLE source of truth for which video file plays on the overlay.
  const actionVideoSrc = useMemo(() => {
    // Priority 1: Explicit action from AI (standing, coffee, kiss, laugh, etc.)
    if (action && action !== 'idle') {
      // Map action name to the video clip key in persona config
      const clipKey = action === 'cooking' ? 'coffee' : action;
      
      // Check if persona has this clip configured
      if (persona.videoClips && (persona.videoClips as any)[clipKey]) {
        return (persona.videoClips as any)[clipKey] as string;
      }
      
      // Fallback: construct path from convention
      return `/videos/${persona.id}/${clipKey}.mp4`;
    }

    // Priority 2: Speaking state (isSpeaking is true but action is 'idle')
    if (isSpeaking) {
      return persona.videoClips?.speaking || `/videos/${persona.id}/speaking.mp4`;
    }

    // No action, not speaking → no overlay (idle.mp4 plays in background)
    return undefined;
  }, [persona.id, persona.videoClips, action, isSpeaking]);

  // ─── CRITICAL FIX: Reset actionVideoReady when the video source CHANGES ───
  // Without this, switching from speaking.mp4 → standing.mp4 never updates
  // because actionVideoReady stays `true` from the previous video.
  useEffect(() => {
    if (actionVideoSrc !== prevActionSrcRef.current) {
      setActionVideoReady(false);
      prevActionSrcRef.current = actionVideoSrc;
    }
  }, [actionVideoSrc]);

  const normalizedLevel = Math.max(0.1, Math.min(1, audioLevel || 0.4));

  // Human-readable action label for the badge
  const actionLabel = useMemo(() => {
    const labels: Record<string, string> = {
      standing: '🧍 Showing Outfit',
      sitting: '🪑 Sitting Down',
      coffee: '☕ Sipping Coffee',
      cooking: '☕ Brewing Coffee',
      changing_clothes: `👗 ${outfit}`,
      workout: '💪 Workout',
      wave: '👋 Waving',
      kiss: '💋 Sweet Kiss',
      laugh: '😂 Laughing',
      blush: '🙈 Blushing',
      cheers: '🥂 Cheers!',
      cozy: '🧣 Getting Cozy',
      lean_in: '🤫 Leaning Closer',
      thinking: '🤔 Thinking',
      hair_flip: '💇 Playing with Hair',
      wink: '😉 Wink',
      heart_hands: '🫶 Heart Hands',
      phone: '📱 Sharing Photo',
    };
    return labels[action] || null;
  }, [action, outfit]);

  return (
    <div className="relative w-full h-full rounded-3xl overflow-hidden select-none bg-gray-950 border border-white/10 shadow-2xl flex items-center justify-center">
      {/* ── AMBIENT DEPTH BACKDROP ──────────────────────────────────────────── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute inset-[-20%] bg-cover bg-center filter blur-3xl opacity-35 scale-125 transition-all duration-1000"
          style={{ backgroundImage: `url(${persona.avatarImage})` }}
        />
        <div
          className={`absolute inset-0 transition-opacity duration-700 ${
            action === 'kiss'
              ? 'bg-gradient-to-t from-pink-950/60 via-purple-950/40 to-transparent'
              : action === 'workout'
              ? 'bg-gradient-to-t from-orange-950/50 via-amber-950/30 to-transparent'
              : action === 'coffee' || action === 'cooking'
              ? 'bg-gradient-to-t from-amber-950/60 via-stone-900/40 to-transparent'
              : action === 'cheers'
              ? 'bg-gradient-to-t from-amber-950/50 via-yellow-950/30 to-transparent'
              : 'bg-gradient-to-t from-black/80 via-purple-950/20 to-black/60'
          }`}
        />
      </div>

      {/* ── DUAL-LAYER VIDEO STAGE ─────────────────────────────────────────── */}
      <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
        <div className="relative w-full h-full max-w-5xl flex items-center justify-center">
          <div className="relative w-full h-full max-h-[80vh] aspect-[4/3] sm:aspect-[16/10] md:aspect-[16/9] mx-auto flex items-center justify-center">
            {/* Layer 1: Static Image (instant zero-flicker base) */}
            <Image
              src={persona.avatarImage}
              alt={persona.name}
              fill
              priority
              sizes="(max-width: 1200px) 100vw, 1200px"
              className="object-cover object-top sm:object-center rounded-2xl drop-shadow-2xl"
            />

            {/* Layer 2: Idle Video (always loops in background) */}
            {idleVideoSrc && (
              <video
                ref={idleVideoRef}
                src={idleVideoSrc}
                autoPlay
                loop
                muted
                playsInline
                onLoadedData={() => setIdleVideoLoaded(true)}
                className={`absolute inset-0 w-full h-full object-cover object-center rounded-2xl transition-opacity duration-500 ${
                  idleVideoLoaded ? 'opacity-100' : 'opacity-0'
                }`}
              />
            )}

            {/* Layer 3: ACTION VIDEO OVERLAY — the critical synced layer */}
            {actionVideoSrc && (
              <video
                key={actionVideoSrc}
                src={actionVideoSrc}
                autoPlay
                loop
                muted
                playsInline
                onEnded={(e) => {
                  e.currentTarget.currentTime = 0;
                  e.currentTarget.play().catch(() => {});
                }}
                onPause={(e) => {
                  if (isSpeaking) {
                    e.currentTarget.play().catch(() => {});
                  }
                }}
                onError={(e) => {
                  console.warn(`[AVATAR VIDEO] Failed to load clip "${actionVideoSrc}", falling back to speaking/idle`);
                  const target = e.currentTarget;
                  if (persona.videoClips?.speaking && target.src !== persona.videoClips.speaking) {
                    target.src = persona.videoClips.speaking;
                    target.play().catch(() => {});
                  }
                }}
                className="absolute inset-0 w-full h-full object-cover object-center rounded-2xl opacity-100 z-10"
              />
            )}

            {/* Layer 4: Speaking Aura Ring */}
            <AnimatePresence>
              {isSpeaking && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{
                    opacity: [0.35, 0.75, 0.35],
                    scale: [1.0, 1.02 + normalizedLevel * 0.02, 1.0],
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute inset-0 rounded-2xl pointer-events-none border-2 border-pink-500/50 shadow-[0_0_45px_rgba(236,72,153,0.3)]"
                />
              )}
            </AnimatePresence>

            {/* Studio Vignette */}
            <div className="absolute inset-0 rounded-2xl pointer-events-none bg-gradient-to-t from-black/80 via-transparent to-black/30" />
            <div className="absolute inset-0 rounded-2xl pointer-events-none ring-1 ring-inset ring-white/10" />

            {/* ── ACTION PARTICLE OVERLAYS ─────────────────────────────────────── */}
            {(action === 'coffee' || action === 'cooking') && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute bottom-16 right-10 sm:right-20 flex flex-col items-center pointer-events-none z-30"
              >
                <div className="relative w-8 h-10 mb-[-6px]">
                  {steamParticles.map((p, i) => (
                    <motion.span
                      key={p}
                      animate={{
                        y: [-5, -30],
                        x: [0, i % 2 === 0 ? 6 : -6],
                        opacity: [0, 0.7, 0],
                        scale: [0.6, 1.3],
                      }}
                      transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.35, ease: 'easeOut' }}
                      className="absolute bottom-0 left-3 w-2 h-2 rounded-full bg-white/40 filter blur-xs"
                    />
                  ))}
                </div>
                <div className="p-3 rounded-full bg-amber-950/80 border border-amber-500/40 shadow-xl backdrop-blur-md text-amber-300">
                  <FaCoffee className="text-2xl" />
                </div>
              </motion.div>
            )}

            {action === 'kiss' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
                {[1, 2, 3].map((k) => (
                  <motion.span
                    key={k}
                    animate={{
                      scale: [0.5, 1.4, 0.8],
                      y: [0, -60, -100],
                      x: [(k - 2) * 40, (k - 2) * 70],
                      opacity: [0, 0.9, 0],
                    }}
                    transition={{ duration: 2.0, repeat: Infinity, delay: k * 0.5, ease: 'easeOut' }}
                    className="absolute text-3xl sm:text-4xl"
                  >
                    💋
                  </motion.span>
                ))}
              </motion.div>
            )}

            {action === 'wave' && (
              <motion.div
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: [0, 15, -10, 15, 0] }}
                transition={{ duration: 1.2, repeat: Infinity }}
                className="absolute top-16 right-10 sm:right-16 z-30 p-3.5 rounded-full bg-purple-900/80 border border-purple-400/50 shadow-2xl backdrop-blur-md text-yellow-300 pointer-events-none text-2xl"
              >
                👋
              </motion.div>
            )}

            {action === 'workout' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute top-16 right-10 sm:right-16 z-30 p-3 rounded-full bg-orange-950/80 border border-orange-500/50 shadow-2xl backdrop-blur-md text-orange-400 flex items-center gap-2 pointer-events-none"
              >
                <FaDumbbell className="text-xl animate-bounce" />
                <span className="text-xs font-bold font-mono text-white">Active</span>
              </motion.div>
            )}

            {action === 'cheers' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute top-16 right-10 sm:right-16 z-30 p-3.5 rounded-full bg-amber-950/80 border border-amber-400/50 shadow-2xl backdrop-blur-md pointer-events-none text-2xl"
              >
                🥂
              </motion.div>
            )}

            {action === 'blush' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.6, 0.3, 0.6, 0] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="absolute inset-0 rounded-2xl pointer-events-none z-20 bg-gradient-to-t from-pink-500/10 via-transparent to-transparent"
              />
            )}
          </div>
        </div>
      </div>

      {/* ── TOP-LEFT STATUS BADGE ──────────────────────────────────────────── */}
      <div className="absolute top-4 left-4 z-40 flex items-center gap-2">
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-xl border text-xs font-semibold shadow-xl text-white transition-colors duration-300 ${
            isSpeaking
              ? 'bg-pink-900/80 border-pink-500/50 shadow-pink-500/20'
              : isListening
              ? 'bg-emerald-900/80 border-emerald-500/50 shadow-emerald-500/20'
              : isProcessing
              ? 'bg-amber-900/80 border-amber-500/50 shadow-amber-500/20'
              : 'bg-black/60 border-white/20'
          }`}
        >
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              isSpeaking
                ? 'bg-pink-400 animate-ping'
                : isListening
                ? 'bg-emerald-400 animate-pulse'
                : isProcessing
                ? 'bg-amber-400 animate-bounce'
                : 'bg-indigo-400'
            }`}
          />
          <span>
            {isSpeaking
              ? 'Speaking Live'
              : isProcessing
              ? 'Thinking...'
              : isListening
              ? 'Listening...'
              : 'Live Connected'}
          </span>
        </div>

        {isSpeaking && (
          <div className="flex items-center gap-0.5 px-2.5 py-1.5 rounded-full bg-pink-950/80 border border-pink-500/30 backdrop-blur-md text-pink-300">
            <FaVolumeUp className="text-xs mr-1 animate-pulse text-pink-400" />
            {[0.2, 0.8, 0.4, 1.0, 0.6].map((multiplier, idx) => (
              <motion.span
                key={idx}
                animate={{
                  height: ['4px', `${Math.max(6, Math.min(20, normalizedLevel * 20 * multiplier))}px`, '4px'],
                }}
                transition={{ duration: 0.35, repeat: Infinity, delay: idx * 0.07 }}
                className="w-0.5 bg-pink-400 rounded-full"
              />
            ))}
          </div>
        )}
      </div>

      {/* ── TOP-RIGHT ACTION BADGE ─────────────────────────────────────────── */}
      <div className="absolute top-4 right-4 z-40 flex items-center gap-2">
        <AnimatePresence>
          {actionLabel && (
            <motion.div
              key={action}
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 15 }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-900/90 backdrop-blur-xl border border-purple-400/40 text-purple-100 text-xs font-semibold shadow-xl"
            >
              {actionLabel}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-xl border border-white/10 text-white text-xs">
          <FaWifi className="text-emerald-400 text-xs" />
          <span className="text-gray-300 font-mono text-[11px] hidden sm:inline">1080p · 60fps</span>
          <div className="w-px h-3 bg-white/20" />
          <FaHeart className="text-rose-400 text-xs animate-pulse" />
          <span className="text-gray-200 font-bold">{persona.traits.warmth}%</span>
        </div>
      </div>

      {/* ── COMPANION NAME BADGE ───────────────────────────────────────────── */}
      <div className="absolute top-16 left-4 sm:left-6 z-30 text-white pointer-events-none">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-base sm:text-lg font-bold tracking-tight drop-shadow-md">
            {persona.name}, {persona.age}
          </h3>
          <span className="px-2 py-0.5 rounded-full bg-purple-500/80 text-[10px] font-bold backdrop-blur-sm shadow-sm">
            AI Date
          </span>
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/80 text-[10px] font-bold backdrop-blur-sm shadow-sm flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
            {idleVideoLoaded ? 'HD Video Loop' : 'Live Stream'}
          </span>
        </div>
        <p className="text-[11px] sm:text-xs text-purple-200/90 font-medium mt-0.5 drop-shadow-sm max-w-xs truncate">
          {persona.tagline || `${persona.title} · ${persona.location}`}
        </p>
      </div>
    </div>
  );
}
