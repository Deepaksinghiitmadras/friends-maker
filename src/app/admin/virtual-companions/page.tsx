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
  hasIdleVideo: boolean;
  hasSpeakingVideo: boolean;
  idleVideoSize: number;
  speakingVideoSize: number;
  prompts: {
    idle: string;
    speaking: string;
    [key: string]: string;
  };
}

export default function AdminVirtualCompanionsPage() {
  const [companions, setCompanions] = useState<CustomCompanionAdminItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadingType, setUploadingType] = useState<'idle' | 'speaking' | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activePreviewVideo, setActivePreviewVideo] = useState<{ title: string; url: string } | null>(null);

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
    videoType: 'idle' | 'speaking',
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

  const handleDelete = async (personaId: string, name: string) => {
    if (!confirm(`Are you sure you want to reject and completely delete companion "${name}"? This cannot be undone.`)) {
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
      }
    } catch (err) {
      console.error('Failed to delete companion:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = companions.filter((c) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = c.name?.toLowerCase().includes(q);
      const matchEmail = c.userEmail?.toLowerCase().includes(q);
      const matchUser = c.userName?.toLowerCase().includes(q);
      const matchTitle = c.title?.toLowerCase().includes(q);
      if (!matchName && !matchEmail && !matchUser && !matchTitle) return false;
    }

    if (filterCategory === 'generating') return c.status === 'generating';
    if (filterCategory === 'ready') return c.status === 'ready' && c.isActive !== false;
    if (filterCategory === 'inactive') return c.isActive === false;
    if (filterCategory === 'global') return c.isGlobal === true;
    if (filterCategory === 'private') return c.isCustom && !c.isGlobal;

    return true;
  });

  const inProgressCount = companions.filter((c) => c.status === 'generating').length;
  const readyCount = companions.filter((c) => c.status === 'ready' && c.isActive !== false).length;
  const inactiveCount = companions.filter((c) => c.isActive === false).length;

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-gray-900 dark:text-gray-100">
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 bg-gradient-to-r from-purple-950 via-gray-900 to-indigo-950 text-white p-6 sm:p-8 rounded-3xl shadow-xl border border-purple-500/30">
        <div>
          <div className="flex items-center gap-2 text-pink-400 text-xs font-bold uppercase tracking-wider mb-2">
            <FaUserSecret className="text-base" />
            Admin Operations Portal
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <span>Virtual Companion Studio</span>
            <Chip size="sm" color="secondary" variant="flat" className="text-xs font-bold text-pink-300">
              User-Wise Management
            </Chip>
          </h1>
          <p className="text-xs sm:text-sm text-purple-200/80 mt-1 max-w-2xl">
            Review user-created companion requests, filter by creator email, download reference photos, copy AI prompts, toggle Active/Inactive and Global/Private visibility, and upload custom videos.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <Button
            as={Link}
            href="/virtual"
            variant="flat"
            className="bg-white/10 text-white hover:bg-white/20 text-xs font-semibold rounded-xl"
            startContent={<FaArrowLeft className="text-xs" />}
          >
            User Portal
          </Button>
          <Button
            onClick={fetchCompanions}
            isLoading={loading}
            className="bg-pink-600 hover:bg-pink-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-pink-600/30"
            startContent={!loading && <FaSync className="text-xs" />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* ── WORKFLOW GUIDE BANNER ────────────────────────────────────────────── */}
      <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 mb-8 space-y-2">
        <div className="flex items-center gap-2 text-amber-500 dark:text-amber-400 font-bold text-sm">
          <HiSparkles className="text-lg" />
          <span>Manual Video Generation Workflow (Gemini Chat / Veo Playground)</span>
        </div>
        <ol className="list-decimal list-inside text-xs sm:text-sm text-gray-700 dark:text-gray-300 space-y-1.5 pl-1 leading-relaxed">
          <li><strong>Download Reference Photo:</strong> Click the download button on any user request below.</li>
          <li><strong>Generate in Gemini / Google AI Studio:</strong> Open <a href="https://aistudio.google.com" target="_blank" rel="noreferrer" className="text-pink-500 underline font-semibold inline-flex items-center gap-1">AI Studio <FaExternalLinkAlt className="text-[10px]" /></a> or Gemini Chat, attach the photo, and paste the <strong>Idle Prompt</strong> or <strong>Speaking Prompt</strong>.</li>
          <li><strong>Upload Video Files:</strong> Once generated, upload <code className="text-pink-600 dark:text-pink-400 font-mono">idle.mp4</code> and <code className="text-pink-600 dark:text-pink-400 font-mono">speaking.mp4</code> below.</li>
          <li><strong>Publish:</strong> Click <strong>&quot;Publish &amp; Make Live&quot;</strong> — the companion instantly becomes active for the creator user, and an email notification is automatically sent!</li>
        </ol>
      </div>

      {/* ── SEARCH & USER-WISE FILTERS ────────────────────────────────────────── */}
      <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md p-4 rounded-2xl border border-gray-200/80 dark:border-gray-800 shadow-sm mb-6 flex flex-col md:flex-row gap-4 justify-between items-center">
        {/* Search Bar */}
        <div className="w-full md:w-80">
          <Input
            placeholder="Search user email, name, companion..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            startContent={<FaSearch className="text-gray-400 text-xs" />}
            size="sm"
            variant="bordered"
            isClearable
            onClear={() => setSearchQuery('')}
          />
        </div>

        {/* Filter Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap w-full md:w-auto">
          <button
            onClick={() => setFilterCategory('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filterCategory === 'all'
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
            }`}
          >
            All ({companions.length})
          </button>
          <button
            onClick={() => setFilterCategory('generating')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
              filterCategory === 'generating'
                ? 'bg-amber-500 text-white shadow-md'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'
            }`}
          >
            <FaClock className="text-xs" />
            In Progress ({inProgressCount})
          </button>
          <button
            onClick={() => setFilterCategory('ready')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
              filterCategory === 'ready'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
            }`}
          >
            <FaCheckCircle className="text-xs" />
            Live &amp; Ready ({readyCount})
          </button>
          <button
            onClick={() => setFilterCategory('private')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
              filterCategory === 'private'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20'
            }`}
          >
            <FaLock className="text-xs" />
            User-Private ({companions.filter(c => c.isCustom && !c.isGlobal).length})
          </button>
          <button
            onClick={() => setFilterCategory('global')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
              filterCategory === 'global'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20'
            }`}
          >
            <FaGlobe className="text-xs" />
            Global ({companions.filter(c => c.isGlobal).length})
          </button>
          <button
            onClick={() => setFilterCategory('inactive')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
              filterCategory === 'inactive'
                ? 'bg-red-600 text-white shadow-md'
                : 'bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20'
            }`}
          >
            <FaEyeSlash className="text-xs" />
            Inactive ({inactiveCount})
          </button>
        </div>
      </div>

      {/* ── COMPANIONS LIST ─────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 px-4 bg-gray-50 dark:bg-gray-900 rounded-3xl border border-dashed border-gray-300 dark:border-gray-800">
          <HiPhoto className="text-4xl text-gray-400 mx-auto mb-2" />
          <h3 className="text-base font-bold text-gray-700 dark:text-gray-200">No matching companion requests found</h3>
          <p className="text-xs text-gray-400 mt-1">
            Try adjusting your search query or filter category.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {filtered.map((item) => {
            const isReady = item.status === 'ready';
            const isActive = item.isActive !== false;
            const isGlobal = !!item.isGlobal;

            return (
              <Card
                key={item.id}
                className={`overflow-hidden border transition-all ${
                  !isActive
                    ? 'border-red-400/40 bg-red-50/20 dark:bg-red-950/10 opacity-80'
                    : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900'
                } shadow-lg rounded-3xl`}
              >
                <CardBody className="p-6">
                  {/* Top Bar on Card: Creator Info & Global/Active Badges */}
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200/60 dark:border-purple-800/60 text-xs font-semibold text-purple-800 dark:text-purple-300">
                        <FaUser className="text-purple-500 text-[11px]" />
                        <span>Creator: <strong>{item.userName || 'Anonymous'}</strong></span>
                        {item.userEmail && (
                          <span className="text-gray-500 text-[11px] flex items-center gap-1 ml-1">
                            <FaEnvelope className="text-[10px]" /> {item.userEmail}
                          </span>
                        )}
                      </div>

                      {/* Visibility Badge */}
                      {isGlobal ? (
                        <Chip size="sm" color="primary" variant="flat" className="text-[11px] font-bold" startContent={<FaGlobe className="text-xs" />}>
                          Global (Visible to All Users)
                        </Chip>
                      ) : (
                        <Chip size="sm" color="secondary" variant="flat" className="text-[11px] font-bold" startContent={<FaLock className="text-xs" />}>
                          Private (Creator User Only)
                        </Chip>
                      )}

                      {/* Active / Inactive Badge */}
                      {!isActive && (
                        <Chip size="sm" color="danger" variant="flat" className="text-[11px] font-bold" startContent={<FaEyeSlash className="text-xs" />}>
                          INACTIVE (Buttons disabled on user side)
                        </Chip>
                      )}
                    </div>

                    {/* Admin Toggle Controls */}
                    <div className="flex items-center gap-4">
                      {/* Global Toggle */}
                      {item.isCustom && (
                        <div className="flex items-center gap-2 text-xs font-semibold select-none">
                          <span className="text-gray-600 dark:text-gray-400">Global Visibility:</span>
                          <Switch
                            size="sm"
                            color="primary"
                            isSelected={isGlobal}
                            onValueChange={() => handleToggleGlobal(item.id, isGlobal)}
                          />
                        </div>
                      )}

                      {/* Active/Inactive Toggle */}
                      <div className="flex items-center gap-2 text-xs font-semibold select-none">
                        <span className={isActive ? "text-emerald-600 font-bold" : "text-red-500 font-bold"}>
                          {isActive ? "Active (Live)" : "Inactive"}
                        </span>
                        <Switch
                          size="sm"
                          color="success"
                          isSelected={isActive}
                          onValueChange={() => handleToggleActive(item.id, isActive)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Column 1: Reference Photo & Identity (3 cols) */}
                    <div className="lg:col-span-3 flex flex-col items-center sm:items-start text-center sm:text-left space-y-3">
                      <div className="relative w-36 h-36 rounded-2xl overflow-hidden shadow-lg border-2 border-purple-500/40 flex-shrink-0 bg-gray-100 dark:bg-gray-800">
                        <Image
                          src={item.avatarImage || '/images/custom_user_companion.jpeg'}
                          alt={item.name}
                          fill
                          className="object-cover"
                        />
                      </div>

                      <div className="space-y-1 w-full">
                        <div className="flex items-center justify-center sm:justify-start gap-2">
                          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                            {item.name}, {item.age}
                          </h3>
                          <Chip size="sm" variant="flat" color={item.gender === 'man' ? 'primary' : 'danger'} className="text-[10px] uppercase font-bold">
                            {item.gender}
                          </Chip>
                        </div>
                        <p className="text-xs text-purple-600 dark:text-purple-400 font-semibold">{item.title}</p>
                        <p className="text-[11px] text-gray-500">{item.location}</p>
                      </div>

                      {/* Status Badge */}
                      <div className="w-full">
                        {isReady ? (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-bold">
                            <FaCheckCircle />
                            <span>Video Ready</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-bold">
                            <FaClock className="animate-spin" style={{ animationDuration: '6s' }} />
                            <span>In Progress (Awaiting Videos)</span>
                          </div>
                        )}
                      </div>

                      {/* Download Reference Photos Gallery */}
                      {item.referencePhotos && item.referencePhotos.length > 0 ? (
                        <div className="w-full space-y-2">
                          <div className="flex items-center justify-between text-[11px] font-bold text-gray-500">
                            <span>Reference Photos ({item.referencePhotos.length})</span>
                          </div>
                          <div className="grid grid-cols-3 gap-1.5 w-full">
                            {item.referencePhotos.map((photoUrl, pIdx) => (
                              <div
                                key={pIdx}
                                className="group relative aspect-square rounded-lg overflow-hidden border border-purple-400/40 bg-black cursor-pointer"
                                onClick={() => handleDownloadPhoto(photoUrl, `${item.name}-ref-${pIdx + 1}`)}
                                title="Click to download photo"
                              >
                                <Image src={photoUrl} alt={`Ref ${pIdx + 1}`} fill className="object-cover" />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <FaDownload className="text-white text-xs" />
                                </div>
                                <span className="absolute bottom-0 inset-x-0 bg-black/75 text-[8px] font-bold text-white text-center py-0.5">
                                  {pIdx === 0 ? 'Main' : pIdx === 1 ? 'Close-Up' : `Angle ${pIdx + 1}`}
                                </span>
                              </div>
                            ))}
                          </div>
                          <Button
                            size="sm"
                            fullWidth
                            variant="flat"
                            color="secondary"
                            className="text-xs font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300"
                            startContent={<FaDownload className="text-xs" />}
                            onClick={() => handleDownloadPhoto(item.avatarImage, item.name)}
                          >
                            Download Main Portrait
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          fullWidth
                          variant="flat"
                          color="secondary"
                          className="text-xs font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300"
                          startContent={<FaDownload className="text-xs" />}
                          onClick={() => handleDownloadPhoto(item.avatarImage, item.name)}
                        >
                          Download Photo
                        </Button>
                      )}
                    </div>

                    {/* Column 2: Prompts & Details (5 cols) */}
                    <div className="lg:col-span-5 space-y-4">
                      {/* Personality */}
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                          Personality &amp; Speaking Vibe
                        </span>
                        <p className="text-xs text-gray-700 dark:text-gray-300 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800 leading-relaxed">
                          {item.personality}
                        </p>
                      </div>

                      {/* User Uploaded Voice Sample (if available) */}
                      {item.voiceSampleUrl && (
                        <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/30 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                              <FaVolumeUp className="text-pink-500" />
                              <span>User Voice Sample (For Voice Cloning)</span>
                            </span>
                            <a
                              href={item.voiceSampleUrl}
                              download={`${item.name}-voice-sample.webm`}
                              className="text-[11px] font-bold text-pink-600 dark:text-pink-400 hover:underline flex items-center gap-1"
                            >
                              <FaDownload className="text-[9px]" /> Download Audio
                            </a>
                          </div>
                          <audio src={item.voiceSampleUrl} controls className="w-full h-8" />
                          <p className="text-[10px] text-gray-400">
                            Tip: Upload this audio to ElevenLabs Instant Voice Cloning or PlayHT to generate a cloned voice ID.
                          </p>
                        </div>
                      )}

                      {/* Prompt 1: Idle Video */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-pink-600 dark:text-pink-400 flex items-center gap-1">
                            <HiSparkles /> 1. Idle Video Prompt (Webcam loop, smiling, no talking)
                          </span>
                          <Button
                            size="sm"
                            variant="light"
                            className="h-6 px-2 text-[11px] font-bold text-pink-600 dark:text-pink-400"
                            startContent={copiedKey === `${item.id}-idle` ? <FaCheck /> : <FaCopy />}
                            onClick={() => handleCopyPrompt(item.prompts?.idle || '', `${item.id}-idle`)}
                          >
                            {copiedKey === `${item.id}-idle` ? 'Copied!' : 'Copy Prompt'}
                          </Button>
                        </div>
                        <div className="text-[11px] font-mono text-gray-600 dark:text-gray-300 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700/80 select-all leading-relaxed">
                          {item.prompts?.idle}
                        </div>
                      </div>

                      {/* Prompt 2: Speaking Video */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1">
                            <HiSparkles /> 2. Speaking Video Prompt (Talking, expressive lip sync)
                          </span>
                          <Button
                            size="sm"
                            variant="light"
                            className="h-6 px-2 text-[11px] font-bold text-purple-600 dark:text-purple-400"
                            startContent={copiedKey === `${item.id}-speaking` ? <FaCheck /> : <FaCopy />}
                            onClick={() => handleCopyPrompt(item.prompts?.speaking || '', `${item.id}-speaking`)}
                          >
                            {copiedKey === `${item.id}-speaking` ? 'Copied!' : 'Copy Prompt'}
                          </Button>
                        </div>
                        <div className="text-[11px] font-mono text-gray-600 dark:text-gray-300 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700/80 select-all leading-relaxed">
                          {item.prompts?.speaking}
                        </div>
                      </div>
                    </div>

                    {/* Column 3: Video Upload & Publishing Controls (4 cols) */}
                    <div className="lg:col-span-4 space-y-4 flex flex-col justify-between">
                      <div className="space-y-3">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                          Upload Custom Video Actions
                        </span>

                        {/* Idle Video Uploader */}
                        <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/60 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold flex items-center gap-1.5">
                              {item.hasIdleVideo ? (
                                <FaCheckCircle className="text-emerald-500" />
                              ) : (
                                <FaExclamationCircle className="text-amber-500" />
                              )}
                              <span>idle.mp4</span>
                            </span>
                            {item.hasIdleVideo && (
                              <button
                                onClick={() => setActivePreviewVideo({ title: `${item.name} - Idle Action`, url: `/videos/${item.id}/idle.mp4?t=${Date.now()}` })}
                                className="text-[11px] font-bold text-pink-600 dark:text-pink-400 hover:underline flex items-center gap-1"
                              >
                                <FaPlay className="text-[9px]" /> Preview ({Math.round(item.idleVideoSize / 1024)} KB)
                              </button>
                            )}
                          </div>

                          <label className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-gray-700 border border-dashed border-gray-300 dark:border-gray-600 hover:border-purple-500 cursor-pointer transition-all">
                            <FaUpload className="text-purple-500 text-xs" />
                            <span>
                              {uploadingId === item.id && uploadingType === 'idle'
                                ? 'Uploading...'
                                : item.hasIdleVideo
                                ? 'Replace idle.mp4'
                                : 'Upload idle.mp4'}
                            </span>
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

                        {/* Speaking Video Uploader */}
                        <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/60 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold flex items-center gap-1.5">
                              {item.hasSpeakingVideo ? (
                                <FaCheckCircle className="text-emerald-500" />
                              ) : (
                                <FaExclamationCircle className="text-amber-500" />
                              )}
                              <span>speaking.mp4</span>
                            </span>
                            {item.hasSpeakingVideo && (
                              <button
                                onClick={() => setActivePreviewVideo({ title: `${item.name} - Speaking Action`, url: `/videos/${item.id}/speaking.mp4?t=${Date.now()}` })}
                                className="text-[11px] font-bold text-pink-600 dark:text-pink-400 hover:underline flex items-center gap-1"
                              >
                                <FaPlay className="text-[9px]" /> Preview ({Math.round(item.speakingVideoSize / 1024)} KB)
                              </button>
                            )}
                          </div>

                          <label className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-gray-700 border border-dashed border-gray-300 dark:border-gray-600 hover:border-purple-500 cursor-pointer transition-all">
                            <FaUpload className="text-purple-500 text-xs" />
                            <span>
                              {uploadingId === item.id && uploadingType === 'speaking'
                                ? 'Uploading...'
                                : item.hasSpeakingVideo
                                ? 'Replace speaking.mp4'
                                : 'Upload speaking.mp4'}
                            </span>
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
                      </div>

                      {/* Publishing / Status Actions */}
                      <div className="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-2">
                        {isReady ? (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              fullWidth
                              variant="flat"
                              color="warning"
                              className="text-xs font-bold"
                              onClick={() => handleToggleStatus(item.id, item.status)}
                            >
                              Set to &quot;In Progress&quot;
                            </Button>
                            <Button
                              size="sm"
                              as={Link}
                              href={`/virtual/call/${item.id}`}
                              target="_blank"
                              className="bg-gradient-to-r from-pink-600 to-purple-600 text-white font-bold text-xs"
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
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              fullWidth
                              variant="light"
                              color="danger"
                              isLoading={deletingId === item.id}
                              className="text-xs font-bold text-red-500"
                              startContent={deletingId !== item.id && <FaTrash className="text-xs" />}
                              onClick={() => handleDelete(item.id, item.name)}
                            >
                              {deletingId === item.id ? 'Deleting Request...' : 'Reject & Delete Request'}
                            </Button>
                          </div>
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
        className="bg-gray-950 text-white border border-purple-500/30 rounded-3xl"
      >
        <ModalContent>
          <ModalHeader className="border-b border-white/10">
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
                className="w-full max-h-[480px] rounded-2xl object-cover bg-black"
              />
            )}
          </ModalBody>
          <ModalFooter className="border-t border-white/10">
            <Button
              size="sm"
              color="primary"
              className="bg-purple-600 font-bold"
              onClick={() => setActivePreviewVideo(null)}
            >
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
