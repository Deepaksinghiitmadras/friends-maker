'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Card,
  CardBody,
  Button,
  Chip,
  Input,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Switch,
  Accordion,
  AccordionItem,
  Select,
  SelectItem,
} from '@nextui-org/react';
import {
  FaVideo,
  FaDownload,
  FaCopy,
  FaCheck,
  FaUpload,
  FaTrash,
  FaClock,
  FaCheckCircle,
  FaExclamationCircle,
  FaPlay,
  FaUserSecret,
  FaSync,
  FaExternalLinkAlt,
  FaArrowLeft,
  FaSearch,
  FaLock,
  FaGlobe,
  FaUser,
  FaEnvelope,
  FaEyeSlash,
  FaTimes,
  FaVolumeUp,
  FaMicrophone,
  FaMagic,
} from 'react-icons/fa';
import { HiSparkles, HiPhoto } from 'react-icons/hi2';

interface CustomCompanionAdminItem {
  id: string;
  name: string;
  age: number;
  gender: 'man' | 'woman';
  title: string;
  location: string;
  avatarImage: string;
  personality: string;
  languages: string[];
  greeting: string;
  status: 'generating' | 'ready';
  isCustom?: boolean;
  userId?: string;
  userEmail?: string;
  userName?: string;
  isGlobal?: boolean;
  isActive?: boolean;
  createdAt?: string;
  referencePhotos?: string[];
  voiceSampleUrl?: string;
  voiceId?: string;
  videoClips?: Record<string, string>;
  hasIdleVideo: boolean;
  hasSpeakingVideo: boolean;
  idleVideoSize: number;
  speakingVideoSize: number;
  prompts: {
    idle: string;
    speaking: string;
    coffee?: string;
    kiss?: string;
    laugh?: string;
    blush?: string;
    wave?: string;
    standing?: string;
    lean_in?: string;
    [key: string]: string | undefined;
  };
}

const VOICE_PRESETS = [
  { id: 'chariot_darshan', name: '🇮🇳 Darshan (Native Indian Male - Chariot.in)', voiceId: '9fbf5ed7-5e81-40e0-b0f9-9ab0345661a3' },
  { id: 'chariot_meera', name: '🇮🇳 Meera (Native Indian Female - Chariot.in)', voiceId: '3c763516-1d51-4d0a-b328-57b5507fb20b' },
  { id: 'chariot_neha', name: '🇮🇳 Neha (Calm Indian Female - Chariot.in)', voiceId: '09ecd7b6-3e92-4435-b673-50e8659fc015' },
  { id: 'eleven_roger', name: '🎙️ Roger (Casual & Resonant Male - ElevenLabs)', voiceId: 'CwhRBWXzGAHq8TQ4Fs17' },
  { id: 'eleven_sarah', name: '🎙️ Sarah (Warm & Confident Female - ElevenLabs)', voiceId: 'EXAVITQu4vr4xnSDxMaL' },
  { id: 'eleven_george', name: '🎙️ George (Warm Storyteller Male - ElevenLabs)', voiceId: 'JBFqnCBsd6RMkjVDRZzb' },
  { id: 'eleven_jessica', name: '🎙️ Jessica (Playful & Bright Female - ElevenLabs)', voiceId: 'cgSgspJ2msm6clMCkdW9' },
  { id: 'eleven_charlie', name: '🎙️ Charlie (Deep Energetic Male - ElevenLabs)', voiceId: 'IKne3meq5aSn9XLyUdCD' },
  { id: 'eleven_brian', name: '🎙️ Brian (Comforting Male - ElevenLabs)', voiceId: 'nPczCjzI2devNBz1zQrb' },
  { id: 'eleven_bella', name: '🎙️ Bella (Professional Female - ElevenLabs)', voiceId: 'hpp4J3VqNfWAUOO0d1Us' },
  { id: 'eleven_adam', name: '🎙️ Adam (Dominant Firm Male - ElevenLabs)', voiceId: 'pNInz6obpgDQGcFmaJgB' },
];

const OPTIONAL_ACTIONS = [
  { key: 'coffee', label: '☕ Chai / Coffee Date', desc: 'Holding chai/coffee cup, sipping, warm smile' },
  { key: 'kiss', label: '💋 Flying Kiss', desc: 'Blowing a cute flying kiss with sweet blushing smile' },
  { key: 'laugh', label: '😂 Hearty Laugh', desc: 'Laughing warmly and genuinely at jokes' },
  { key: 'blush', label: '🥰 Shy Blush', desc: 'Sweetly blushing and tucking hair behind ear' },
  { key: 'wave', label: '👋 Waving Hello/Bye', desc: 'Waving hand warmly to greet or say goodbye' },
  { key: 'standing', label: '💃 Full Body / Outfit', desc: 'Standing up, stepping back slightly to showcase outfit' },
  { key: 'lean_in', label: '👂 Attentive Listening', desc: 'Leaning closer to camera, listening intently' },
];

export default function AdminVirtualCompanionsPage() {
  const [companions, setCompanions] = useState<CustomCompanionAdminItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activePreviewVideo, setActivePreviewVideo] = useState<{ title: string; url: string } | null>(null);
  const [cloningVoiceId, setCloningVoiceId] = useState<string | null>(null);
  const [customVoiceInputs, setCustomVoiceInputs] = useState<Record<string, string>>({});

  const fetchCompanions = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/virtual-companions');
      const data = await res.json();
      if (data.success && Array.isArray(data.personas)) {
        setCompanions(data.personas);
      }
    } catch (err) {
      console.error('Failed to load companions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanions();
  }, []);

  const handleCopyPrompt = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleDownloadPhoto = (imageUrl: string, name: string) => {
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = `${name.toLowerCase().replace(/\s+/g, '_')}_reference_photo.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleVideoUpload = async (
    personaId: string,
    videoType: string,
    file: File
  ) => {
    setUploadingId(personaId);
    setUploadingType(videoType);

    const formData = new FormData();
    formData.append('personaId', personaId);
    formData.append('videoType', videoType);
    formData.append('file', file);

    try {
      const res = await fetch('/api/admin/virtual-companions/upload-video', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        await fetchCompanions();
      } else {
        alert(data.error || 'Upload failed');
      }
    } catch (err: any) {
      alert(`Upload error: ${err.message}`);
    } finally {
      setUploadingId(null);
      setUploadingType(null);
    }
  };

  const handleAutoCloneVoice = async (personaId: string) => {
    setCloningVoiceId(personaId);
    try {
      const res = await fetch('/api/admin/virtual-companions/clone-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personaId }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`🎉 Success! Voice cloned with ID: ${data.voiceId}`);
        await fetchCompanions();
      } else {
        alert(data.error || 'Voice cloning failed');
      }
    } catch (err: any) {
      alert(err.message || 'Voice cloning failed');
    } finally {
      setCloningVoiceId(null);
    }
  };

  const handleSaveCustomVoiceId = async (personaId: string, voiceIdToSave?: string) => {
    const voiceId = voiceIdToSave || customVoiceInputs[personaId];
    if (!voiceId || !voiceId.trim()) return;
    try {
      const res = await fetch('/api/admin/virtual-companions/clone-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personaId, customVoiceId: voiceId.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        alert('Voice assigned successfully!');
        await fetchCompanions();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to save Voice');
    }
  };

  const handleToggleStatus = async (personaId: string, currentStatus: 'generating' | 'ready') => {
    const newStatus = currentStatus === 'ready' ? 'generating' : 'ready';
    setCompanions((prev) =>
      prev.map((c) => (c.id === personaId ? { ...c, status: newStatus } : c))
    );
    try {
      const res = await fetch('/api/admin/virtual-companions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personaId, status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchCompanions();
      }
    } catch (err) {
      console.error('Failed to update status:', err);
      fetchCompanions();
    }
  };

  const handleToggleActive = async (personaId: string, currentActive: boolean) => {
    const nextActive = !currentActive;
    setCompanions((prev) =>
      prev.map((c) => (c.id === personaId ? { ...c, isActive: nextActive } : c))
    );
    try {
      await fetch('/api/admin/virtual-companions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personaId, isActive: nextActive }),
      });
    } catch (err) {
      console.error('Failed to update active state:', err);
      fetchCompanions();
    }
  };

  const handleToggleGlobal = async (personaId: string, currentGlobal: boolean) => {
    const nextGlobal = !currentGlobal;
    setCompanions((prev) =>
      prev.map((c) => (c.id === personaId ? { ...c, isGlobal: nextGlobal } : c))
    );
    try {
      await fetch('/api/admin/virtual-companions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personaId, isGlobal: nextGlobal }),
      });
    } catch (err) {
      console.error('Failed to update global state:', err);
      fetchCompanions();
    }
  };

  const handleDelete = async (personaId: string, personaName: string) => {
    if (!confirm(`Are you sure you want to permanently delete "${personaName}"? This action cannot be undone.`)) {
      return;
    }
    setDeletingId(personaId);
    try {
      const res = await fetch(`/api/admin/virtual-companions?id=${personaId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setCompanions((prev) => prev.filter((c) => c.id !== personaId));
      } else {
        alert(data.error || 'Failed to delete companion');
      }
    } catch (err: any) {
      alert(`Delete error: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = companions.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.userName && c.userName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (c.userEmail && c.userEmail.toLowerCase().includes(searchQuery.toLowerCase()));

    if (filterCategory === 'pending') {
      return matchesSearch && c.status === 'generating';
    }
    if (filterCategory === 'ready') {
      return matchesSearch && c.status === 'ready';
    }
    if (filterCategory === 'custom') {
      return matchesSearch && c.isCustom;
    }
    if (filterCategory === 'global') {
      return matchesSearch && c.isGlobal;
    }
    return matchesSearch;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 space-y-6">
      {/* ── TOP NAV / HEADER ───────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 transition-all shadow-sm"
            >
              <FaArrowLeft />
            </Link>
            <h1 className="text-2xl md:text-3xl font-black bg-gradient-to-r from-pink-400 via-purple-300 to-indigo-300 bg-clip-text text-transparent">
              Companion Studio &amp; Video Actions
            </h1>
          </div>
          <p className="text-xs md:text-sm text-slate-300 mt-1">
            Manage user requests, assign high-fidelity native Indian &amp; ElevenLabs voices, and upload multi-action video clips.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="bordered"
            color="secondary"
            startContent={<FaSync className={loading ? 'animate-spin' : ''} />}
            onClick={fetchCompanions}
            className="font-bold text-xs border-purple-400/50 text-purple-300 bg-purple-950/40"
          >
            Refresh
          </Button>
          <Button
            size="sm"
            as={Link}
            href="/virtual"
            target="_blank"
            className="bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold text-xs shadow-md shadow-purple-600/30"
            startContent={<FaExternalLinkAlt className="text-xs" />}
          >
            View User Studio
          </Button>
        </div>
      </div>

      {/* ── FILTER & SEARCH BAR ────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'all', label: `All (${companions.length})` },
            { id: 'pending', label: `⏳ In Progress (${companions.filter((c) => c.status === 'generating').length})` },
            { id: 'ready', label: `✅ Ready / Live (${companions.filter((c) => c.status === 'ready').length})` },
            { id: 'custom', label: `👤 User Custom (${companions.filter((c) => c.isCustom).length})` },
            { id: 'global', label: `🌐 Global Personas (${companions.filter((c) => c.isGlobal).length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterCategory(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                filterCategory === tab.id
                  ? 'bg-purple-600 text-white border-purple-400 shadow-lg shadow-purple-600/30'
                  : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="w-full md:w-80">
          <Input
            placeholder="Search by name, role, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            startContent={<FaSearch className="text-slate-400 text-xs" />}
            size="sm"
            variant="bordered"
            classNames={{
              input: '!text-white text-xs font-medium placeholder:!text-slate-400',
              inputWrapper: '!bg-slate-900 !border-slate-700 hover:!border-purple-400 focus-within:!border-purple-400',
            }}
          />
        </div>
      </div>

      {/* ── COMPANION CARDS LIST ───────────────────────────────────────────── */}
      {loading ? (
        <div className="py-20 text-center text-slate-400 space-y-3">
          <FaSync className="animate-spin text-3xl mx-auto text-purple-400" />
          <p className="text-sm font-medium">Loading companion cards...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center text-slate-400 bg-slate-900/50 rounded-3xl border border-slate-800">
          <p className="text-base font-bold">No companions matched your filter</p>
        </div>
      ) : (
        <div className="space-y-6">
          {filtered.map((item) => {
            const isReady = item.status === 'ready';
            const idleClipUrl = item.videoClips?.idle || `/videos/${item.id}/idle.mp4`;
            const speakingClipUrl = item.videoClips?.speaking || `/videos/${item.id}/speaking.mp4`;

            return (
              <Card
                key={item.id}
                className="bg-slate-900/90 border border-slate-700/80 shadow-xl rounded-3xl overflow-hidden"
              >
                <CardBody className="p-5 md:p-6 space-y-5">
                  {/* Top Bar: User Owner & Visibility Toggles */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      {item.userName && (
                        <span className="flex items-center gap-1.5 font-bold text-purple-200 bg-purple-950/70 px-3 py-1 rounded-full border border-purple-500/30">
                          <FaUser className="text-pink-400 text-[10px]" />
                          <span>Creator: {item.userName}</span>
                          {item.userEmail && <span className="text-slate-300">({item.userEmail})</span>}
                        </span>
                      )}
                      <span className="flex items-center gap-1.5 font-semibold text-slate-200 bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
                        {item.isGlobal ? <FaGlobe className="text-emerald-400" /> : <FaLock className="text-amber-400" />}
                        <span>{item.isGlobal ? 'Global Persona' : 'Private (Creator Only)'}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-300 font-medium">Global:</span>
                        <Switch
                          size="sm"
                          color="secondary"
                          isSelected={item.isGlobal ?? false}
                          onValueChange={() => handleToggleGlobal(item.id, item.isGlobal ?? false)}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={item.isActive !== false ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                          Active (Live):
                        </span>
                        <Switch
                          size="sm"
                          color="success"
                          isSelected={item.isActive !== false}
                          onValueChange={() => handleToggleActive(item.id, item.isActive !== false)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Main 3-Column Layout */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Column 1: Avatar & Reference Photos Gallery (3 cols) */}
                    <div className="lg:col-span-3 space-y-4">
                      <div className="relative w-full aspect-square max-w-[220px] mx-auto rounded-2xl overflow-hidden border-2 border-purple-500/40 shadow-lg">
                        <Image
                          src={item.avatarImage || '/images/custom_user_companion.jpeg'}
                          alt={item.name}
                          fill
                          className="object-cover"
                        />
                        <div className="absolute top-2 right-2">
                          <Chip
                            size="sm"
                            className={
                              isReady
                                ? 'bg-emerald-500 text-white font-bold text-[10px] shadow'
                                : 'bg-amber-400 text-slate-950 font-bold text-[10px] shadow'
                            }
                          >
                            {isReady ? '✓ Video Ready' : '⏳ In Progress'}
                          </Chip>
                        </div>
                      </div>

                      <div className="text-center">
                        <h2 className="text-lg font-bold text-white flex items-center justify-center gap-2">
                          <span>{item.name}, {item.age}</span>
                          <Chip size="sm" variant="flat" color="secondary" className="text-[10px] uppercase font-bold bg-purple-900/60 text-purple-200">
                            {item.gender}
                          </Chip>
                        </h2>
                        <p className="text-xs text-purple-300 font-semibold">{item.title}</p>
                        <p className="text-[11px] text-slate-400">{item.location}</p>
                      </div>

                      {/* Reference Photos Grid */}
                      {item.referencePhotos && item.referencePhotos.length > 0 && (
                        <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                          <span className="text-[11px] font-bold text-purple-300 flex items-center gap-1.5">
                            <HiPhoto className="text-pink-400" />
                            <span>Reference Photos ({item.referencePhotos.length})</span>
                          </span>
                          <div className="grid grid-cols-3 gap-1.5">
                            {item.referencePhotos.map((photoUrl, idx) => (
                              <div
                                key={idx}
                                onClick={() => handleDownloadPhoto(photoUrl, `${item.name}_ref_${idx + 1}`)}
                                className="relative aspect-square rounded-lg overflow-hidden border border-slate-700 hover:border-pink-400 cursor-pointer group"
                                title="Click to Download"
                              >
                                <Image src={photoUrl} alt="Ref" fill className="object-cover" />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                                  <FaDownload className="text-white text-xs" />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Column 2: Personality, Prompts & Voice Selection (5 cols) */}
                    <div className="lg:col-span-5 space-y-4">
                      {/* Personality */}
                      <div className="space-y-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          Personality &amp; Speaking Vibe
                        </span>
                        <p className="text-xs text-slate-200 p-3 rounded-xl bg-slate-950 border border-slate-800 leading-relaxed font-medium">
                          {item.personality}
                        </p>
                      </div>

                      {/* Voice Settings & Selection Card */}
                      <div className="p-3.5 rounded-2xl bg-purple-950/40 border border-purple-500/40 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-purple-200 flex items-center gap-1.5">
                            <FaVolumeUp className="text-pink-400" />
                            <span>Companion Voice Model</span>
                          </span>
                          {item.voiceSampleUrl && (
                            <a
                              href={item.voiceSampleUrl}
                              download={`${item.name}-voice-sample.webm`}
                              className="text-[11px] font-bold text-pink-400 hover:underline flex items-center gap-1"
                            >
                              <FaDownload className="text-[9px]" /> Download Sample
                            </a>
                          )}
                        </div>

                        {item.voiceSampleUrl && (
                          <audio src={item.voiceSampleUrl} controls className="w-full h-8" />
                        )}

                        {/* Quick Voice Preset Picker */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-300">
                            Select Voice Model (Chariot.in Indian or ElevenLabs):
                          </label>
                          <Select
                            placeholder="Choose Voice Preset..."
                            size="sm"
                            variant="bordered"
                            selectedKeys={item.voiceId ? [item.voiceId] : []}
                            onChange={(e) => {
                              const chosen = e.target.value;
                              if (chosen) handleSaveCustomVoiceId(item.id, chosen);
                            }}
                            classNames={{
                              trigger: '!bg-slate-900 !border-slate-700 hover:!border-purple-400 text-xs font-medium',
                              value: '!text-white text-xs font-medium',
                              popoverContent: '!bg-slate-950 !text-white border border-slate-700',
                            }}
                          >
                            {VOICE_PRESETS.map((vp) => (
                              <SelectItem key={vp.voiceId} value={vp.voiceId} className="text-xs text-white hover:bg-purple-600/30">
                                {vp.name}
                              </SelectItem>
                            ))}
                          </Select>
                        </div>

                        {/* Custom Voice ID Input */}
                        <div className="flex items-center gap-2 pt-1">
                          <Input
                            placeholder="Or enter custom ElevenLabs Voice ID..."
                            size="sm"
                            value={customVoiceInputs[item.id] ?? item.voiceId ?? ''}
                            onChange={(e) =>
                              setCustomVoiceInputs((prev) => ({ ...prev, [item.id]: e.target.value }))
                            }
                            classNames={{
                              input: '!text-white text-xs font-mono placeholder:!text-slate-400',
                              inputWrapper: '!bg-slate-900 !border-slate-700 hover:!border-purple-400 h-8',
                            }}
                          />
                          <Button
                            size="sm"
                            variant="solid"
                            color="secondary"
                            className="text-xs font-bold h-8 bg-purple-600 text-white"
                            onClick={() => handleSaveCustomVoiceId(item.id)}
                          >
                            Save
                          </Button>
                        </div>
                      </div>

                      {/* Prompt 1: Idle Video */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-pink-400 flex items-center gap-1">
                            <HiSparkles /> 1. Idle Video Prompt (Loop, Smiling, Breathing)
                          </span>
                          <Button
                            size="sm"
                            variant="light"
                            className="h-6 px-2 text-[11px] font-bold text-pink-400"
                            startContent={copiedKey === `${item.id}-idle` ? <FaCheck /> : <FaCopy />}
                            onClick={() => handleCopyPrompt(item.prompts?.idle || '', `${item.id}-idle`)}
                          >
                            {copiedKey === `${item.id}-idle` ? 'Copied!' : 'Copy Prompt'}
                          </Button>
                        </div>
                        <div className="text-[11px] font-mono text-slate-200 p-2.5 rounded-xl bg-slate-950 border border-slate-800 select-all leading-relaxed">
                          {item.prompts?.idle}
                        </div>
                      </div>

                      {/* Prompt 2: Speaking Video */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-purple-300 flex items-center gap-1">
                            <HiSparkles /> 2. Speaking Video Prompt (Talking, Lip Sync)
                          </span>
                          <Button
                            size="sm"
                            variant="light"
                            className="h-6 px-2 text-[11px] font-bold text-purple-300"
                            startContent={copiedKey === `${item.id}-speaking` ? <FaCheck /> : <FaCopy />}
                            onClick={() => handleCopyPrompt(item.prompts?.speaking || '', `${item.id}-speaking`)}
                          >
                            {copiedKey === `${item.id}-speaking` ? 'Copied!' : 'Copy Prompt'}
                          </Button>
                        </div>
                        <div className="text-[11px] font-mono text-slate-200 p-2.5 rounded-xl bg-slate-950 border border-slate-800 select-all leading-relaxed">
                          {item.prompts?.speaking}
                        </div>
                      </div>
                    </div>

                    {/* Column 3: Video Uploads (Primary + Optional Library) (4 cols) */}
                    <div className="lg:col-span-4 space-y-4">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Upload Video Actions
                      </span>

                      {/* 1. Primary Idle Video */}
                      <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold flex items-center gap-1.5 text-white">
                            {item.hasIdleVideo ? <FaCheckCircle className="text-emerald-400" /> : <FaExclamationCircle className="text-amber-400" />}
                            <span>idle.mp4 (Required)</span>
                          </span>
                          {item.hasIdleVideo && (
                            <button
                              onClick={() => setActivePreviewVideo({ title: `${item.name} - Idle Action`, url: idleClipUrl })}
                              className="text-[11px] font-bold text-pink-400 hover:underline flex items-center gap-1"
                            >
                              <FaPlay className="text-[9px]" /> Preview
                            </button>
                          )}
                        </div>
                        <label className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold bg-slate-900 border border-dashed border-slate-700 hover:border-purple-400 text-slate-200 hover:text-white cursor-pointer transition-all shadow-sm">
                          <FaUpload className="text-purple-400 text-xs" />
                          <span>{uploadingId === item.id && uploadingType === 'idle' ? 'Uploading...' : 'Upload / Replace idle.mp4'}</span>
                          <input
                            type="file"
                            accept="video/mp4,video/*"
                            disabled={uploadingId === item.id}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleVideoUpload(item.id, 'idle', file);
                            }}
                            className="hidden"
                          />
                        </label>
                      </div>

                      {/* 2. Primary Speaking Video */}
                      <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold flex items-center gap-1.5 text-white">
                            {item.hasSpeakingVideo ? <FaCheckCircle className="text-emerald-400" /> : <FaExclamationCircle className="text-amber-400" />}
                            <span>speaking.mp4 (Required)</span>
                          </span>
                          {item.hasSpeakingVideo && (
                            <button
                              onClick={() => setActivePreviewVideo({ title: `${item.name} - Speaking Action`, url: speakingClipUrl })}
                              className="text-[11px] font-bold text-pink-400 hover:underline flex items-center gap-1"
                            >
                              <FaPlay className="text-[9px]" /> Preview
                            </button>
                          )}
                        </div>
                        <label className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold bg-slate-900 border border-dashed border-slate-700 hover:border-purple-400 text-slate-200 hover:text-white cursor-pointer transition-all shadow-sm">
                          <FaUpload className="text-purple-400 text-xs" />
                          <span>{uploadingId === item.id && uploadingType === 'speaking' ? 'Uploading...' : 'Upload / Replace speaking.mp4'}</span>
                          <input
                            type="file"
                            accept="video/mp4,video/*"
                            disabled={uploadingId === item.id}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleVideoUpload(item.id, 'speaking', file);
                            }}
                            className="hidden"
                          />
                        </label>
                      </div>

                      {/* 3. Optional Video Action Library (Collapsible) */}
                      <Accordion variant="bordered" className="border-slate-800 bg-slate-950/60 rounded-2xl">
                        <AccordionItem
                          key="optional"
                          aria-label="Optional Video Actions"
                          title={
                            <span className="text-xs font-bold text-purple-300">
                              + Optional Action Videos ({OPTIONAL_ACTIONS.length})
                            </span>
                          }
                          subtitle={<span className="text-[10px] text-slate-400">Chai, Kiss, Laugh, Blush, Wave, Outfit...</span>}
                        >
                          <div className="space-y-3 pt-2">
                            {OPTIONAL_ACTIONS.map((action) => {
                              const existingUrl = item.videoClips?.[action.key];
                              const promptText = `Close-up interactive video of ${item.name} (${action.desc}), smiling naturally at camera in cozy room, high realism 4k video loop.`;

                              return (
                                <div key={action.key} className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5 text-xs">
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-slate-200">{action.label}</span>
                                    <div className="flex items-center gap-2">
                                      {existingUrl && (
                                        <button
                                          onClick={() => setActivePreviewVideo({ title: `${item.name} - ${action.label}`, url: existingUrl })}
                                          className="text-[10px] font-bold text-pink-400 hover:underline flex items-center gap-1"
                                        >
                                          <FaPlay className="text-[8px]" /> Play
                                        </button>
                                      )}
                                      <button
                                        onClick={() => handleCopyPrompt(promptText, `${item.id}-${action.key}`)}
                                        className="text-[10px] text-purple-300 hover:underline flex items-center gap-1 font-semibold"
                                      >
                                        {copiedKey === `${item.id}-${action.key}` ? 'Copied!' : 'Copy Prompt'}
                                      </button>
                                    </div>
                                  </div>

                                  <label className="flex items-center justify-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-950 border border-dashed border-slate-700 hover:border-purple-400 text-slate-300 hover:text-white cursor-pointer transition-all">
                                    <FaUpload className="text-purple-400 text-[10px]" />
                                    <span>
                                      {uploadingId === item.id && uploadingType === action.key
                                        ? 'Uploading...'
                                        : existingUrl
                                        ? `Replace ${action.key}.mp4`
                                        : `Upload ${action.key}.mp4`}
                                    </span>
                                    <input
                                      type="file"
                                      accept="video/mp4,video/*"
                                      disabled={uploadingId === item.id}
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleVideoUpload(item.id, action.key, file);
                                      }}
                                      className="hidden"
                                    />
                                  </label>
                                </div>
                              );
                            })}
                          </div>
                        </AccordionItem>
                      </Accordion>

                      {/* Publishing / Status Actions */}
                      <div className="pt-2 border-t border-slate-800 space-y-2">
                        {isReady ? (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              fullWidth
                              variant="flat"
                              color="warning"
                              className="text-xs font-bold bg-amber-950/60 text-amber-300 border border-amber-500/30"
                              onClick={() => handleToggleStatus(item.id, item.status)}
                            >
                              Set to &quot;In Progress&quot;
                            </Button>
                            <Button
                              size="sm"
                              as={Link}
                              href={`/virtual/call/${item.id}`}
                              target="_blank"
                              className="bg-gradient-to-r from-pink-600 to-purple-600 text-white font-bold text-xs shadow-md shadow-purple-600/30"
                              startContent={<FaVideo className="text-xs" />}
                            >
                              Test Call
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="md"
                            fullWidth
                            className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-xs shadow-lg shadow-emerald-600/30"
                            startContent={<FaCheckCircle />}
                            onClick={() => handleToggleStatus(item.id, item.status)}
                          >
                            Publish &amp; Make Live
                          </Button>
                        )}

                        {item.isCustom && (
                          <Button
                            size="sm"
                            fullWidth
                            variant="light"
                            color="danger"
                            isLoading={deletingId === item.id}
                            className="text-xs font-bold text-red-400 hover:bg-red-950/30"
                            startContent={deletingId !== item.id && <FaTrash className="text-xs" />}
                            onClick={() => handleDelete(item.id, item.name)}
                          >
                            {deletingId === item.id ? 'Deleting Request...' : 'Reject & Delete Request'}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── VIDEO PREVIEW MODAL ─────────────────────────────────────────────── */}
      <Modal
        isOpen={!!activePreviewVideo}
        onClose={() => setActivePreviewVideo(null)}
        size="2xl"
        classNames={{
          base: 'bg-slate-950 text-white border border-slate-700 rounded-3xl',
          header: 'border-b border-slate-800',
          footer: 'border-t border-slate-800',
        }}
      >
        <ModalContent>
          <ModalHeader>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <FaVideo className="text-pink-400" />
              <span>{activePreviewVideo?.title}</span>
            </h3>
          </ModalHeader>
          <ModalBody className="p-4 flex items-center justify-center">
            {activePreviewVideo && (
              <video
                src={activePreviewVideo.url}
                autoPlay
                loop
                controls
                className="w-full max-h-[480px] rounded-2xl object-cover bg-black shadow-2xl"
              />
            )}
          </ModalBody>
          <ModalFooter>
            <Button
              size="sm"
              color="primary"
              className="bg-purple-600 font-bold text-white"
              onClick={() => setActivePreviewVideo(null)}
            >
              Close Preview
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
