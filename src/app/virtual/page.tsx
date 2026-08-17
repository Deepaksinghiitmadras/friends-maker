'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  VIRTUAL_PERSONAS,
  VirtualPersona,
} from '@/lib/virtualPersonas';
import {
  FaVideo,
  FaVolumeUp,
  FaHeart,
  FaMapMarkerAlt,
  FaBrain,
  FaSmile,
  FaBolt,
  FaFire,
  FaFilter,
} from 'react-icons/fa';
import { HiSparkles } from 'react-icons/hi2';
import { Button, Chip, Card, CardBody } from '@nextui-org/react';

export default function VirtualCompanionsPage() {
  const [selectedGender, setSelectedGender] = useState<'all' | 'woman' | 'man'>('all');
  const [selectedTrait, setSelectedTrait] = useState<string>('all');
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);

  const filteredPersonas = VIRTUAL_PERSONAS.filter((p) => {
    if (selectedGender !== 'all' && p.gender !== selectedGender) return false;
    if (selectedTrait !== 'all' && !p.interests.some((i) => i.toLowerCase().includes(selectedTrait.toLowerCase()))) {
      return false;
    }
    return true;
  });

  const handlePlayVoicePreview = (persona: VirtualPersona, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();

      if (playingVoiceId === persona.id) {
        setPlayingVoiceId(null);
        return;
      }

      const utterance = new SpeechSynthesisUtterance(persona.greeting);
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

      utterance.onend = () => setPlayingVoiceId(null);
      utterance.onerror = () => setPlayingVoiceId(null);

      setPlayingVoiceId(persona.id);
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* ── HERO BANNER ──────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-900 via-indigo-900 to-pink-900 text-white p-8 md:p-12 shadow-2xl mb-12 border border-purple-500/20"
      >
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-96 h-96 rounded-full bg-pink-500/20 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-96 h-96 rounded-full bg-purple-500/20 blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-pink-300 text-xs font-semibold uppercase tracking-wider mb-4">
            <HiSparkles className="text-amber-300 animate-spin" style={{ animationDuration: '3s' }} />
            Next-Gen Interactive AI Video Dating
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white mb-4 leading-tight">
            Meet & Talk with <span className="bg-gradient-to-r from-pink-400 via-purple-300 to-indigo-300 bg-clip-text text-transparent">AI Virtual Companions</span>
          </h1>

          <p className="text-base sm:text-lg text-purple-100/90 mb-8 leading-relaxed">
            Experience ultra-realistic 1-on-1 live video calls with intelligent virtual men and women. 
            Speak with your microphone, see responsive lip-synced video avatars, and explore deep emotional connection without judgment.
          </p>

          <div className="flex flex-wrap gap-4 text-xs sm:text-sm font-medium text-purple-200">
            <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full backdrop-blur-sm border border-white/10">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span>Real-Time WebRTC Voice</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full backdrop-blur-sm border border-white/10">
              <FaVideo className="text-pink-400" />
              <span>HD Live Video Streams</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full backdrop-blur-sm border border-white/10">
              <FaBrain className="text-indigo-400" />
              <span>Deep Memory & Emotional IQ</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── FILTER CONTROLS ─────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md p-4 rounded-2xl border border-gray-200/80 shadow-sm">
        {/* Gender Toggle */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mr-1 flex items-center gap-1">
            <FaFilter className="text-pink-500" /> Filter:
          </span>
          <div className="inline-flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
            <button
              onClick={() => setSelectedGender('all')}
              className={`px-4 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all ${
                selectedGender === 'all'
                  ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              All Personas ({VIRTUAL_PERSONAS.length})
            </button>
            <button
              onClick={() => setSelectedGender('woman')}
              className={`px-4 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all ${
                selectedGender === 'woman'
                  ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              👩 Virtual Women
            </button>
            <button
              onClick={() => setSelectedGender('man')}
              className={`px-4 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all ${
                selectedGender === 'man'
                  ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              👨 Virtual Men
            </button>
          </div>
        </div>

        {/* Interest Chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          {['all', 'Music', 'Photography', 'Architecture', 'Cooking', 'Travel', 'Surfing'].map((trait) => (
            <button
              key={trait}
              onClick={() => setSelectedTrait(trait)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                selectedTrait === trait
                  ? 'bg-pink-100 text-pink-700 border border-pink-300 dark:bg-pink-950 dark:text-pink-300'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
              }`}
            >
              {trait === 'all' ? '✨ All Interests' : `#${trait}`}
            </button>
          ))}
        </div>
      </div>

      {/* ── PERSONAS GRID ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
        <AnimatePresence mode="popLayout">
          {filteredPersonas.map((persona, index) => (
            <motion.div
              key={persona.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.35, delay: index * 0.05 }}
              className="h-full"
            >
              <Card className="h-full flex flex-col justify-between overflow-hidden border border-gray-200/80 dark:border-gray-800 shadow-md hover:shadow-2xl transition-all duration-300 group hover:-translate-y-1.5 rounded-2xl bg-white/95 dark:bg-gray-900/95 backdrop-blur-md">
                {/* Avatar Image Header */}
                <div className="relative h-72 w-full overflow-hidden bg-gray-100">
                  <Image
                    src={persona.avatarImage}
                    alt={persona.name}
                    fill
                    className="object-cover object-top group-hover:scale-105 transition-transform duration-700 ease-out"
                    sizes="(max-width: 768px) 100vw, 25vw"
                    priority={index < 4}
                  />

                  {/* Top Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                  {/* Online Live Status */}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/90 text-white text-xs font-semibold backdrop-blur-md shadow-md">
                    <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                    <span>Ready for Call</span>
                  </div>

                  {/* Gender Tag */}
                  <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-black/40 text-white text-xs backdrop-blur-md border border-white/20">
                    {persona.gender === 'woman' ? '👩 Woman' : '👨 Man'}
                  </div>

                  {/* Bottom Header Info */}
                  <div className="absolute bottom-3 left-3 right-3 text-white">
                    <div className="flex items-baseline justify-between">
                      <h2 className="text-xl font-bold tracking-tight text-white drop-shadow-md">
                        {persona.name}, {persona.age}
                      </h2>
                    </div>
                    <p className="text-xs text-pink-200 font-medium flex items-center gap-1 mt-0.5">
                      <FaMapMarkerAlt className="text-xs" /> {persona.location}
                    </p>
                  </div>
                </div>

                {/* Card Body */}
                <CardBody className="p-4 flex flex-col justify-between flex-grow">
                  <div>
                    <div className="text-xs font-semibold text-purple-600 dark:text-purple-400 mb-1.5">
                      {persona.title}
                    </div>

                    <p className="text-xs text-gray-600 dark:text-gray-300 italic line-clamp-2 mb-3">
                      &quot;{persona.tagline}&quot;
                    </p>

                    {/* Languages Spoken Badge */}
                    {persona.languages && persona.languages.length > 0 && (
                      <div className="flex items-center gap-1.5 mb-3 px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/40 border border-purple-200/60 dark:border-purple-800/40 text-[11px] text-purple-700 dark:text-purple-300">
                        <span className="font-semibold text-[10px] uppercase tracking-wider text-purple-500">Speaks:</span>
                        <div className="flex flex-wrap gap-1">
                          {persona.languages.map((lang) => (
                            <span key={lang} className="font-bold text-[10px] bg-white/80 dark:bg-gray-800 px-1.5 py-0.2 rounded text-purple-900 dark:text-purple-200 border border-purple-200/40">
                              {lang}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Interest Tags */}
                    <div className="flex flex-wrap gap-1 mb-4">
                      {persona.interests.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md font-medium"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    {/* Personality Traits Bars */}
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-500 bg-gray-50 dark:bg-gray-800/50 p-2 rounded-xl mb-4 border border-gray-100 dark:border-gray-800">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1"><FaHeart className="text-rose-500 text-[10px]" /> Warmth</span>
                        <span className="font-semibold text-gray-700 dark:text-gray-200">{persona.traits.warmth}%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1"><FaSmile className="text-amber-500 text-[10px]" /> Humor</span>
                        <span className="font-semibold text-gray-700 dark:text-gray-200">{persona.traits.humor}%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1"><FaBrain className="text-indigo-500 text-[10px]" /> Intellect</span>
                        <span className="font-semibold text-gray-700 dark:text-gray-200">{persona.traits.intellect}%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1"><FaBolt className="text-emerald-500 text-[10px]" /> Energy</span>
                        <span className="font-semibold text-gray-700 dark:text-gray-200">{persona.traits.energy}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Area */}
                  <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                    {/* Voice Sample Preview */}
                    <Button
                      size="sm"
                      variant="flat"
                      fullWidth
                      className="text-xs font-medium text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100"
                      startContent={<FaVolumeUp className={playingVoiceId === persona.id ? 'animate-bounce text-pink-500' : ''} />}
                      onClick={(e) => handlePlayVoicePreview(persona, e)}
                    >
                      {playingVoiceId === persona.id ? 'Playing Voice Sample...' : 'Hear Voice Greeting'}
                    </Button>

                    {/* Start Video Call Action */}
                    <Button
                      as={Link}
                      href={`/virtual/call/${persona.id}`}
                      size="md"
                      fullWidth
                      className="font-bold text-white bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 shadow-md hover:shadow-xl transition-all duration-200"
                      startContent={<FaVideo className="text-sm animate-pulse" />}
                    >
                      Start Video Call
                    </Button>
                  </div>
                </CardBody>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ── HOW IT WORKS SECTION ────────────────────────────────────────────── */}
      <div className="rounded-3xl bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl p-8 md:p-12 border border-gray-200/80 shadow-lg text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
          How Interactive AI Video Calls Work
        </h2>
        <p className="text-gray-500 max-w-2xl mx-auto mb-10 text-sm">
          A revolutionary blend of conversational intelligence and real-time audio-video synthesis.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
          <div className="p-6 rounded-2xl bg-gradient-to-br from-pink-50 to-white dark:from-gray-800 dark:to-gray-850 border border-pink-100 dark:border-gray-700 shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-pink-500 text-white flex items-center justify-center font-bold text-xl mb-4 shadow-md">
              1
            </div>
            <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">
              Select Your Companion
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Browse virtual men and women personas with customized hobbies, voice tones, and conversation styles.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-gradient-to-br from-purple-50 to-white dark:from-gray-800 dark:to-gray-850 border border-purple-100 dark:border-gray-700 shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold text-xl mb-4 shadow-md">
              2
            </div>
            <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">
              Live Face-to-Face Video
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Enable your camera and mic. Talk hands-free like a real FaceTime call with live voice transcription.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-50 to-white dark:from-gray-800 dark:to-gray-850 border border-indigo-100 dark:border-gray-700 shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xl mb-4 shadow-md">
              3
            </div>
            <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">
              Deep & Safe Connection
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Practice communication, share your feelings, or just enjoy friendly banter in a judgment-free, private environment.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
