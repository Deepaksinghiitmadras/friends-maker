'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { VirtualPersona } from '@/lib/virtualPersonas';
import { FaHeart, FaVolumeUp } from 'react-icons/fa';
import { AvatarActionType, OutfitStyle } from './ThreeAvatarScene';

interface Props {
  persona: VirtualPersona;
  isSpeaking: boolean;
  isListening: boolean;
  isProcessing: boolean;
  audioLevel: number;
  action?: AvatarActionType;
  outfit?: OutfitStyle;
}

// Outfit color overlays
const OUTFIT_COLORS: Record<OutfitStyle, string> = {
  casual: 'from-indigo-900/40',
  formal: 'from-rose-900/40',
  cozy: 'from-amber-900/40',
  sporty: 'from-cyan-900/40',
};

export default function VirtualAvatarCanvas({
  persona,
  isSpeaking,
  isListening,
  isProcessing,
  audioLevel,
  action = 'idle',
  outfit = 'casual',
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const frameRef = useRef(0);
  const stateRef = useRef({ isSpeaking, audioLevel, action });

  useEffect(() => {
    stateRef.current = { isSpeaking, audioLevel, action };
  }, [isSpeaking, audioLevel, action]);

  // ── Canvas-based REAL LIP SYNC on top of photo ─────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.src = persona.avatarImage.split('?')[0] + '?w=800&auto=format&fit=crop&q=85';
    imgRef.current = img;

    img.onload = () => {
      const draw = () => {
        animFrameRef.current = requestAnimationFrame(draw);
        frameRef.current++;
        const f = frameRef.current;
        const { isSpeaking: speaking, audioLevel: level } = stateRef.current;

        const W = canvas.width;
        const H = canvas.height;
        ctx.clearRect(0, 0, W, H);

        // ── Draw base photo with breathing zoom ──
        const breathScale = 1 + Math.sin(f * 0.025) * 0.004;
        const breathY = Math.sin(f * 0.025) * 1.5;
        const drawW = W * breathScale;
        const drawH = H * breathScale;
        const drawX = (W - drawW) / 2;
        const drawY = (H - drawH) / 2 + breathY;
        ctx.drawImage(img, drawX, drawY, drawW, drawH);

        // ── Cinematic vignette ──
        const vignette = ctx.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.85);
        vignette.addColorStop(0, 'rgba(0,0,0,0)');
        vignette.addColorStop(1, 'rgba(0,0,0,0.55)');
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, W, H);

        // ── REAL-TIME LIP SYNC OVERLAY ──
        // Estimate face/mouth position (center-bottom of upper half)
        // Mouth is roughly at 65% from top, horizontally centered
        const mouthX = W * 0.5;
        const mouthY = H * 0.63;
        const mouthW = W * 0.14;

        if (speaking) {
          // Phoneme-driven mouth shape
          const mouthOpen = Math.max(0.05, level * 1.6 + Math.sin(f * 0.55) * 0.3);
          const mouthH = mouthOpen * H * 0.035;
          const smileW = mouthW + Math.sin(f * 0.18) * 4;

          // Soft dark interior
          ctx.beginPath();
          ctx.ellipse(mouthX, mouthY + mouthH * 0.3, smileW * 0.7, Math.max(1, mouthH * 0.9), 0, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(20, 5, 5, 0.85)';
          ctx.fill();

          // Lower lip drop
          ctx.beginPath();
          ctx.ellipse(mouthX, mouthY + mouthH, smileW, mouthH * 0.3, 0, 0, Math.PI);
          ctx.fillStyle = persona.gender === 'woman' ? 'rgba(190, 60, 80, 0.7)' : 'rgba(150, 80, 80, 0.6)';
          ctx.fill();

          // Upper lip
          ctx.beginPath();
          ctx.ellipse(mouthX, mouthY, smileW, mouthH * 0.2, 0, Math.PI, Math.PI * 2);
          ctx.fillStyle = persona.gender === 'woman' ? 'rgba(200, 70, 90, 0.7)' : 'rgba(160, 85, 85, 0.55)';
          ctx.fill();
        }

        // ── Subtle eye blink overlay ──
        const blinkCycle = Math.floor(f / 160) % 6;
        const blinkFrame = f % 160;
        if (blinkCycle === 0 && blinkFrame < 6) {
          // Left eye
          const eyeLX = W * 0.39;
          const eyeRX = W * 0.61;
          const eyeY = H * 0.36;
          const eyeW = W * 0.08;
          const eyeH = (H * 0.015) * (blinkFrame < 3 ? blinkFrame / 3 : (6 - blinkFrame) / 3);
          ctx.beginPath();
          ctx.ellipse(eyeLX, eyeY, eyeW, eyeH, 0, 0, Math.PI * 2);
          ctx.fillStyle = persona.gender === 'woman' ? 'rgba(220, 180, 160, 0.92)' : 'rgba(180, 140, 120, 0.92)';
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(eyeRX, eyeY, eyeW, eyeH, 0, 0, Math.PI * 2);
          ctx.fill();
        }

        // ── Speaking: add subtle warm glow around face ──
        if (speaking) {
          const faceGlow = ctx.createRadialGradient(W * 0.5, H * 0.42, H * 0.05, W * 0.5, H * 0.42, H * 0.42);
          const glowAlpha = 0.05 + level * 0.12;
          faceGlow.addColorStop(0, `rgba(255, 200, 160, ${glowAlpha})`);
          faceGlow.addColorStop(1, 'rgba(255, 180, 120, 0)');
          ctx.fillStyle = faceGlow;
          ctx.fillRect(0, 0, W, H);
        }
      };
      draw();
    };

    img.onerror = () => {
      // fallback: just draw colored rect
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [persona]);

  // ── Activity-based scene backgrounds ───────────────────────────────────────
  const getSceneBg = () => {
    if (action === 'cooking') return 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=1200&auto=format&fit=crop&q=80';
    if (action === 'workout') return 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=1200&auto=format&fit=crop&q=80';
    return null;
  };

  const sceneBg = getSceneBg();

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden bg-gray-950 select-none shadow-2xl border border-purple-500/20">

      {/* ── Activity Scene Background Layer ──────────────────────────────────── */}
      <AnimatePresence>
        {sceneBg && (
          <motion.div
            key={sceneBg}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="absolute inset-0 z-0"
          >
            <Image src={sceneBg} alt="scene" fill className="object-cover object-center opacity-30 blur-sm" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MAIN PHOTO + CANVAS LIP-SYNC ENGINE ─────────────────────────────── */}
      <motion.div
        className="absolute inset-0 z-5"
        animate={
          action === 'kiss'
            ? { scale: 1.18, y: -20 }
            : action === 'wave'
            ? { x: [0, 6, -4, 6, -4, 0], transition: { repeat: Infinity, duration: 0.6 } }
            : action === 'workout'
            ? {
                y: [0, -12, 0, -8, 0],
                transition: { repeat: Infinity, duration: 0.75, ease: 'easeInOut' },
              }
            : action === 'standing'
            ? { scale: 0.82, y: 28 }
            : action === 'cooking'
            ? { x: -20, scale: 0.95 }
            : {
                y: [0, -1.5, 0],
                scale: [1, 1.003, 1],
                transition: { repeat: Infinity, duration: 3.8, ease: 'easeInOut' },
              }
        }
      >
        {/* Real photo fills full canvas area */}
        <div className="absolute inset-0 overflow-hidden">
          <Image
            src={persona.avatarImage}
            alt={persona.name}
            fill
            className="object-cover object-top"
            priority
            sizes="100vw"
            unoptimized={false}
          />
        </div>

        {/* Canvas overlay for lip-sync & blink effects */}
        <canvas
          ref={canvasRef}
          width={800}
          height={900}
          className="absolute inset-0 w-full h-full"
          style={{ mixBlendMode: 'normal', opacity: 0.92 }}
        />
      </motion.div>

      {/* ── Speaking aura glow ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {isSpeaking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.2, 0.55, 0.2] }}
            exit={{ opacity: 0 }}
            transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
            className="absolute inset-0 z-10 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at 50% 40%, rgba(255,140,100,0.18) 0%, transparent 70%)',
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Bottom cinematic gradient ────────────────────────────────────────── */}
      <div className="absolute inset-x-0 bottom-0 h-2/5 z-10 pointer-events-none bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
      <div className="absolute inset-x-0 top-0 h-1/6 z-10 pointer-events-none bg-gradient-to-b from-black/60 to-transparent" />

      {/* ── Outfit overlay tint ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {action === 'changing_clothes' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.6, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2 }}
            className="absolute inset-0 z-20 pointer-events-none bg-white/40 backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* ── Activity emoji prop overlay ──────────────────────────────────────── */}
      <AnimatePresence>
        {action !== 'idle' && action !== 'speaking' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: 20 }}
            className="absolute bottom-32 right-8 z-30 text-5xl drop-shadow-2xl pointer-events-none"
          >
            {action === 'cooking' && '☕'}
            {action === 'workout' && '🏋️'}
            {action === 'wave' && '👋'}
            {action === 'kiss' && '💋'}
            {action === 'changing_clothes' && '👗'}
            {action === 'standing' && '🧍'}
            {action === 'sitting' && '🪑'}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── TOP-LEFT: LIVE CALL STATUS BADGE ─────────────────────────────────── */}
      <div className="absolute top-4 left-4 z-40 flex items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/65 backdrop-blur-md border border-white/15 text-white text-xs font-semibold shadow-lg">
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
            {isSpeaking ? 'Speaking...' : isProcessing ? 'Thinking...' : isListening ? 'Listening to you...' : 'Connected'}
          </span>
        </div>

        {isSpeaking && (
          <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-pink-900/70 backdrop-blur-md border border-pink-500/30 text-pink-300 text-xs">
            <FaVolumeUp className="text-xs mr-1 animate-pulse" />
            {[0, 150, 300].map((d) => (
              <span
                key={d}
                className="w-1 rounded-full bg-pink-400 animate-bounce"
                style={{
                  height: `${8 + audioLevel * 10}px`,
                  animationDelay: `${d}ms`,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── TOP-RIGHT: WARMTH & ACTIVITY BADGE ─────────────────────────────── */}
      <div className="absolute top-4 right-4 z-40 flex items-center gap-2">
        <AnimatePresence>
          {action !== 'idle' && action !== 'speaking' && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-900/80 backdrop-blur-md border border-purple-400/40 text-purple-100 text-xs font-semibold shadow-xl"
            >
              {action === 'standing' && '🪑 Standing Up'}
              {action === 'sitting' && '🪑 Sitting Down'}
              {action === 'cooking' && '☕ Making Coffee...'}
              {action === 'changing_clothes' && `👗 Changing to ${outfit.toUpperCase()}`}
              {action === 'workout' && '💪 Working Out'}
              {action === 'wave' && '👋 Waving Hello'}
              {action === 'kiss' && '💋 Blowing a Kiss'}
            </motion.div>
          )}
        </AnimatePresence>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-white text-xs">
          <FaHeart className="text-rose-400 text-xs animate-pulse" />
          <span className="text-gray-300 font-medium">{persona.traits.warmth}%</span>
        </div>
      </div>

      {/* ── BOTTOM: COMPANION INFO OVERLAY ──────────────────────────────────── */}
      <div className="absolute bottom-6 left-6 z-40 text-white">
        <div className="flex items-center gap-2">
          <h3 className="text-2xl font-bold tracking-tight drop-shadow-lg">
            {persona.name}, {persona.age}
          </h3>
          <span className="px-2 py-0.5 rounded-full bg-purple-500/80 text-[11px] font-semibold tracking-wide backdrop-blur-sm">
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
