'use client';

/**
 * VirtualAvatarCanvas — Primary avatar display for the virtual call.
 *
 * Priority order:
 * 1. ReadyPlayerMe 3D WebGL Avatar (Three.js + morph targets) — Microsoft Teams style
 * 2. Fallback to realistic photo + canvas lip-sync if RPM avatar fails to load
 */

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { VirtualPersona } from '@/lib/virtualPersonas';
import { AvatarActionType, OutfitStyle } from './ThreeAvatarScene';
import { FaHeart, FaVolumeUp } from 'react-icons/fa';

// Lazy-load the heavy Three.js scene to avoid SSR issues
import dynamic from 'next/dynamic';

const RealisticAvatarScene = dynamic(
  () => import('./RealisticAvatarScene'),
  { ssr: false, loading: () => null },
);

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
  const [avatarLoaded, setAvatarLoaded] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);

  // Photo fallback: canvas-based lip sync
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const frameRef = useRef(0);
  const stateRef = useRef({ isSpeaking, audioLevel });
  useEffect(() => { stateRef.current = { isSpeaking, audioLevel }; }, [isSpeaking, audioLevel]);

  // Photo fallback canvas rendering
  useEffect(() => {
    if (!avatarFailed) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.src = persona.avatarImage;
    imgRef.current = img;

    img.onload = () => {
      const draw = () => {
        animFrameRef.current = requestAnimationFrame(draw);
        frameRef.current++;
        const f = frameRef.current;
        const { isSpeaking: speaking, audioLevel: level } = stateRef.current;
        const W = canvas.width; const H = canvas.height;
        ctx.clearRect(0, 0, W, H);

        // breathing zoom
        const breathScale = 1 + Math.sin(f * 0.025) * 0.004;
        const drawW = W * breathScale; const drawH = H * breathScale;
        ctx.drawImage(img, (W - drawW) / 2, (H - drawH) / 2 + Math.sin(f * 0.025) * 1.5, drawW, drawH);

        // vignette
        const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.85);
        vig.addColorStop(0, 'rgba(0,0,0,0)');
        vig.addColorStop(1, 'rgba(0,0,0,0.55)');
        ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);

        // lip sync
        if (speaking) {
          const mouthOpen = Math.max(0.05, level * 1.6 + Math.sin(f * 0.55) * 0.3);
          const mH = mouthOpen * H * 0.035;
          const mX = W * 0.5; const mY = H * 0.63; const mW = W * 0.14;
          ctx.beginPath(); ctx.ellipse(mX, mY + mH * 0.3, mW * 0.7, Math.max(1, mH * 0.9), 0, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(20,5,5,0.85)'; ctx.fill();
          ctx.beginPath(); ctx.ellipse(mX, mY + mH, mW, mH * 0.3, 0, 0, Math.PI);
          ctx.fillStyle = persona.gender === 'woman' ? 'rgba(190,60,80,0.7)' : 'rgba(150,80,80,0.6)'; ctx.fill();
        }

        // blink
        const bf = f % 160;
        if (Math.floor(f / 160) % 6 === 0 && bf < 6) {
          const eyeH = (H * 0.015) * (bf < 3 ? bf / 3 : (6 - bf) / 3);
          [[W * 0.39, H * 0.36], [W * 0.61, H * 0.36]].forEach(([ex, ey]) => {
            ctx.beginPath(); ctx.ellipse(ex, ey, W * 0.08, eyeH, 0, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(200,160,140,0.92)'; ctx.fill();
          });
        }

        if (speaking) {
          const glow = ctx.createRadialGradient(W * 0.5, H * 0.42, H * 0.05, W * 0.5, H * 0.42, H * 0.42);
          glow.addColorStop(0, `rgba(255,200,160,${0.05 + level * 0.12})`);
          glow.addColorStop(1, 'rgba(255,180,120,0)');
          ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
        }
      };
      draw();
    };

    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, [avatarFailed, persona]);

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden select-none shadow-2xl border border-purple-500/20"
         style={{ background: 'radial-gradient(ellipse at 50% 40%, #0f0a1e 0%, #060610 100%)' }}>

      {/* ── 3D RPM Avatar (primary) ─────────────────────────────────────────── */}
      {!avatarFailed && (
        <RealisticAvatarScene
          personaId={persona.id}
          gender={persona.gender}
          isSpeaking={isSpeaking}
          isListening={isListening}
          audioLevel={audioLevel}
          action={action}
          outfit={outfit}
          onLoaded={() => setAvatarLoaded(true)}
          onError={() => setAvatarFailed(true)}
        />
      )}

      {/* ── Photo fallback (if RPM fails) ──────────────────────────────────── */}
      {avatarFailed && (
        <motion.div
          className="absolute inset-0 z-5"
          animate={
            action === 'kiss' ? { scale: 1.18, y: -20 } :
            action === 'wave' ? { x: [0, 6, -4, 6, -4, 0], transition: { repeat: Infinity, duration: 0.6 } } :
            action === 'workout' ? { y: [0, -12, 0, -8, 0], transition: { repeat: Infinity, duration: 0.75 } } :
            action === 'standing' ? { scale: 0.82, y: 28 } :
            { y: [0, -1.5, 0], scale: [1, 1.003, 1], transition: { repeat: Infinity, duration: 3.8 } }
          }
        >
          <Image src={persona.avatarImage} alt={persona.name} fill className="object-cover object-top" priority />
          <canvas ref={canvasRef} width={800} height={900} className="absolute inset-0 w-full h-full" style={{ opacity: 0.92 }} />
        </motion.div>
      )}

      {/* ── Speaking aura ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isSpeaking && (
          <motion.div
            key="aura"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.15, 0.4, 0.15] }}
            exit={{ opacity: 0 }}
            transition={{ repeat: Infinity, duration: 1.4 }}
            className="absolute inset-0 z-20 pointer-events-none rounded-2xl"
            style={{ background: 'radial-gradient(ellipse at 50% 35%, rgba(180,80,255,0.12) 0%, transparent 65%)' }}
          />
        )}
      </AnimatePresence>

      {/* ── Cinematic bottom gradient overlay ──────────────────────────────── */}
      <div className="absolute inset-x-0 bottom-0 h-2/5 z-30 pointer-events-none bg-gradient-to-t from-black/90 via-black/30 to-transparent rounded-b-2xl" />
      <div className="absolute inset-x-0 top-0 h-1/5 z-30 pointer-events-none bg-gradient-to-b from-black/50 to-transparent rounded-t-2xl" />

      {/* ── Action badge (top-right) ────────────────────────────────────────── */}
      <div className="absolute top-3 right-3 z-40 flex items-center gap-2">
        <AnimatePresence>
          {action !== 'idle' && action !== 'speaking' && (
            <motion.div
              key={action}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-900/85 backdrop-blur-md border border-purple-400/40 text-purple-100 text-xs font-semibold shadow-xl"
            >
              {action === 'standing' && '🧍 Standing Up'}
              {action === 'sitting' && '🪑 Sitting Down'}
              {action === 'cooking' && '☕ Making Coffee'}
              {action === 'changing_clothes' && `👗 ${outfit.toUpperCase()}`}
              {action === 'workout' && '💪 Working Out'}
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

      {/* ── Status badge (top-left) ─────────────────────────────────────────── */}
      <div className="absolute top-3 left-3 z-40 flex items-center gap-2">
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full backdrop-blur-md border text-xs font-semibold shadow-lg text-white ${
          isSpeaking ? 'bg-pink-900/80 border-pink-500/40' :
          isListening ? 'bg-emerald-900/80 border-emerald-500/40' :
          isProcessing ? 'bg-amber-900/80 border-amber-500/40' :
          'bg-black/60 border-white/15'
        }`}>
          <span className={`w-2 h-2 rounded-full ${
            isSpeaking ? 'bg-pink-400 animate-ping' :
            isListening ? 'bg-emerald-400 animate-pulse' :
            isProcessing ? 'bg-amber-400 animate-bounce' :
            'bg-indigo-400'
          }`} />
          {isSpeaking ? 'Speaking...' : isProcessing ? 'Thinking...' : isListening ? 'Listening...' : 'Connected'}
        </div>

        {isSpeaking && (
          <div className="flex items-center gap-0.5 px-2 py-1 rounded-full bg-pink-900/70 border border-pink-500/30 text-pink-300">
            <FaVolumeUp className="text-[10px] mr-1 animate-pulse" />
            {[0, 150, 300].map((d) => (
              <span key={d} className="w-0.5 rounded-full bg-pink-400 animate-bounce"
                style={{ height: `${8 + audioLevel * 10}px`, animationDelay: `${d}ms` }} />
            ))}
          </div>
        )}
      </div>

      {/* ── Avatar label (bottom-left) ──────────────────────────────────────── */}
      <div className="absolute bottom-5 left-5 z-40 text-white">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-xl font-bold tracking-tight drop-shadow-lg">
            {persona.name}, {persona.age}
          </h3>
          <span className="px-2 py-0.5 rounded-full bg-purple-500/80 text-[10px] font-semibold backdrop-blur-sm">
            AI Companion
          </span>
          {avatarFailed ? (
            <span className="px-1.5 py-0.5 rounded-full bg-orange-500/60 text-[9px] font-semibold text-orange-100">
              Photo Mode
            </span>
          ) : (
            <span className="px-1.5 py-0.5 rounded-full bg-blue-500/60 text-[9px] font-semibold text-blue-100">
              3D · RPM
            </span>
          )}
        </div>
        <p className="text-[11px] text-purple-200 font-medium mt-0.5 drop-shadow-sm">
          {persona.title} · {persona.location}
        </p>
      </div>
    </div>
  );
}
