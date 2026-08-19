'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Textarea,
  Select,
  SelectItem,
  Chip,
  Tabs,
  Tab,
} from '@nextui-org/react';
import { HiSparkles, HiPhoto, HiOutlineClock, HiMicrophone, HiTrash, HiCheckCircle } from 'react-icons/hi2';
import { FaUserPlus, FaVideo, FaCheckCircle, FaClock, FaHeart, FaVolumeUp, FaPlus, FaTrash } from 'react-icons/fa';

interface CreateCompanionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (persona: any) => void;
}

interface PhotoItem {
  id: string;
  dataUrl: string;
  label: 'Front Face (Main)' | 'Close-Up Face' | 'Side Angle' | 'Additional';
}

export default function CreateCompanionModal({
  isOpen,
  onClose,
  onCreated,
}: CreateCompanionModalProps) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'woman' | 'man'>('man');
  const [age, setAge] = useState('27');
  const [title, setTitle] = useState('Casual Friend & Empathetic Listener');
  const [personality, setPersonality] = useState(
    'Friendly, casual, warm listener, speaks naturally in Hindi and English, cares about your feelings and day-to-day life.'
  );
  const [languageChoice, setLanguageChoice] = useState('Hindi · English · Hinglish');

  // Photo Gallery State
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [uploadError, setUploadError] = useState('');

  // Audio / Voice Sample State
  const [voiceFile, setVoiceFile] = useState<File | null>(null);
  const [voiceAudioUrl, setVoiceAudioUrl] = useState<string>('');
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Submission State
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [createdPersona, setCreatedPersona] = useState<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const voiceInputRef = useRef<HTMLInputElement>(null);

  // Handle Photo Upload (Supports multiple)
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, labelType?: PhotoItem['label']) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadError('');
    Array.from(files).forEach((file, index) => {
      if (file.size > 10 * 1024 * 1024) {
        setUploadError('Image too large. Max 10MB each.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          const defaultLabel: PhotoItem['label'] =
            photos.length === 0 && index === 0
              ? 'Front Face (Main)'
              : photos.length === 1 || (photos.length === 0 && index === 1)
              ? 'Close-Up Face'
              : 'Additional';

          const newPhoto: PhotoItem = {
            id: `photo_${Date.now()}_${index}`,
            dataUrl: reader.result,
            label: labelType || defaultLabel,
          };
          setPhotos((prev) => [...prev, newPhoto]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  // Handle Voice Sample Upload
  const handleVoiceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVoiceFile(file);
    const url = URL.createObjectURL(file);
    setVoiceAudioUrl(url);
  };

  // Handle Voice Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], `voice_sample_${Date.now()}.webm`, { type: 'audio/webm' });
        setVoiceFile(audioFile);
        const url = URL.createObjectURL(audioBlob);
        setVoiceAudioUrl(url);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err: any) {
      setUploadError(`Could not access microphone: ${err.message}`);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const removeVoice = () => {
    setVoiceFile(null);
    setVoiceAudioUrl('');
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    if (photos.length === 0) {
      setUploadError('Please upload at least one front face photo for your companion.');
      return;
    }

    setIsGenerating(true);
    setUploadError('');

    try {
      const personaId = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

      // 1. Upload All Photos to Cloudinary / DB
      console.log(`[📸 MODAL] Uploading ${photos.length} photos for companion "${name}"...`);
      const uploadedPhotoUrls: string[] = [];

      for (let i = 0; i < photos.length; i++) {
        const p = photos[i];
        try {
          const uploadRes = await fetch('/api/virtual/upload-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageBase64: p.dataUrl,
              personaId: `${personaId}_${i === 0 ? 'main' : `ref_${i}`}`,
            }),
          });
          const uploadData = await uploadRes.json();
          if (uploadData.success && uploadData.publicPath) {
            uploadedPhotoUrls.push(uploadData.publicPath);
          } else {
            uploadedPhotoUrls.push(p.dataUrl);
          }
        } catch (_) {
          uploadedPhotoUrls.push(p.dataUrl);
        }
      }

      const primaryAvatar = uploadedPhotoUrls[0] || photos[0].dataUrl;

      // 2. Upload Voice Sample if provided
      let uploadedVoiceUrl: string | undefined = undefined;
      if (voiceFile) {
        try {
          console.log(`[🎙️ MODAL] Uploading voice sample...`);
          const voiceFormData = new FormData();
          voiceFormData.append('file', voiceFile);
          voiceFormData.append('personaId', personaId);

          const voiceRes = await fetch('/api/virtual/upload-voice', {
            method: 'POST',
            body: voiceFormData,
          });
          const voiceData = await voiceRes.json();
          if (voiceData.success && voiceData.audioUrl) {
            uploadedVoiceUrl = voiceData.audioUrl;
          }
        } catch (vErr) {
          console.warn('[🎙️ MODAL] Voice sample upload warning:', vErr);
        }
      }

      // 3. Create the Persona in PostgreSQL Database
      const res = await fetch('/api/virtual/custom-persona', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          gender,
          age: parseInt(age) || 26,
          title: title.trim(),
          personality: personality.trim(),
          languages: ['Hindi', 'English', 'Hinglish'],
          avatarImage: primaryAvatar,
          serverImagePath: primaryAvatar,
          referencePhotos: uploadedPhotoUrls,
          voiceSampleUrl: uploadedVoiceUrl,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to create companion');
      }

      // 4. Trigger video engine background task
      fetch('/api/virtual/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personaId,
          imagePath: primaryAvatar,
          gender,
          characterDescription: personality,
        }),
      }).catch((e) => console.warn('Background trigger note:', e));

      setCreatedPersona(data.persona);
      setIsSubmitted(true);

      if (onCreated) {
        onCreated(data.persona);
      }
    } catch (err: any) {
      console.error('[📸 MODAL ERROR]', err);
      setUploadError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReset = () => {
    setName('');
    setGender('man');
    setAge('27');
    setTitle('Casual Friend & Empathetic Listener');
    setPersonality(
      'Friendly, casual, warm listener, speaks naturally in Hindi and English, cares about your feelings and day-to-day life.'
    );
    setPhotos([]);
    setVoiceFile(null);
    setVoiceAudioUrl('');
    setIsSubmitted(false);
    setCreatedPersona(null);
    setUploadError('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={isSubmitted ? handleReset : onClose}
      size="2xl"
      scrollBehavior="inside"
      classNames={{
        base: 'bg-gray-950 border border-purple-500/30 text-white shadow-2xl max-h-[90vh]',
        header: 'border-b border-white/10 pb-4',
        footer: 'border-t border-white/10 pt-4',
      }}
    >
      <ModalContent>
        {isSubmitted ? (
          // ── SUCCESS / IN-PROGRESS VIEW ──────────────────────────────────────
          <>
            <ModalHeader className="flex flex-col gap-1 items-center text-center pt-8">
              <div className="w-16 h-16 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-3xl mb-2 animate-pulse">
                <FaClock />
              </div>
              <h2 className="text-2xl font-bold text-white">
                Companion Creation In Progress!
              </h2>
              <p className="text-xs text-amber-300/80 font-medium">
                Your request has been submitted to TrueFriends Studio
              </p>
            </ModalHeader>

            <ModalBody className="py-6 space-y-5 text-center">
              <div className="p-5 rounded-2xl bg-white/5 border border-white/10 max-w-md mx-auto space-y-4">
                <div className="relative w-24 h-24 mx-auto rounded-2xl overflow-hidden shadow-lg border-2 border-amber-400/50">
                  <Image
                    src={createdPersona?.avatarImage || photos[0]?.dataUrl || '/images/custom_user_companion.jpeg'}
                    alt={createdPersona?.name || name}
                    fill
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                    <span className="text-xs font-bold bg-amber-500/90 text-black px-2 py-0.5 rounded-full">
                      ⏳ Pending
                    </span>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-white">
                    {createdPersona?.name || name}, {createdPersona?.age || age}
                  </h3>
                  <p className="text-xs text-purple-300 font-medium">
                    {createdPersona?.title || title}
                  </p>
                </div>

                <div className="text-left space-y-2 bg-black/40 p-3 rounded-xl border border-white/5 text-xs text-gray-300">
                  <p className="flex items-center gap-2">
                    <span className="text-emerald-400">✓</span>
                    <span>{photos.length} high-resolution reference photo(s) received</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <span className={voiceFile ? "text-emerald-400" : "text-gray-500"}>
                      {voiceFile ? "✓" : "○"}
                    </span>
                    <span>{voiceFile ? "Voice sample submitted for voice cloning" : "Standard native Indian voice assigned"}</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="text-amber-400">⏳</span>
                    <span>Admin is generating ultra-realistic idle &amp; speaking video clips</span>
                  </p>
                </div>
              </div>

              <p className="text-xs text-gray-400 max-w-sm mx-auto leading-relaxed">
                You will receive an automatic email at your registered address as soon as your companion is approved and ready for live video calls!
              </p>
            </ModalBody>

            <ModalFooter className="flex justify-center pb-6">
              <Button
                color="secondary"
                size="lg"
                className="bg-gradient-to-r from-pink-500 to-purple-600 font-bold px-8"
                onClick={handleReset}
              >
                Done &amp; View in Virtual Studio
              </Button>
            </ModalFooter>
          </>
        ) : (
          // ── CREATION FORM VIEW ──────────────────────────────────────────────
          <>
            <ModalHeader className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-pink-400 text-xs font-bold uppercase tracking-wider">
                <HiSparkles />
                <span>AI Companion Studio</span>
              </div>
              <h2 className="text-xl font-bold text-white">
                Create Your Custom Virtual Companion
              </h2>
              <p className="text-xs text-gray-400">
                Upload photos &amp; optional voice sample to generate an ultra-realistic interactive companion.
              </p>
            </ModalHeader>

            <ModalBody className="space-y-6 py-4">
              {/* ── SECTION 1: PHOTO GALLERY UPLOAD ────────────────────────── */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <HiPhoto className="text-pink-400 text-base" />
                      <span>1. Reference Photos ({photos.length}/5)</span>
                    </h4>
                    <p className="text-[11px] text-gray-400">
                      Upload front-face and close-up portraits for ultra-accurate facial generation.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    color="secondary"
                    variant="flat"
                    className="text-xs font-bold"
                    startContent={<FaPlus className="text-xs" />}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Add Photos
                  </Button>
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handlePhotoUpload}
                  accept="image/*"
                  multiple
                  className="hidden"
                />

                {/* Photos Grid */}
                {photos.length === 0 ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-purple-500/40 hover:border-pink-500/80 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-purple-950/20 hover:bg-purple-950/40 space-y-2"
                  >
                    <HiPhoto className="mx-auto text-3xl text-purple-400" />
                    <p className="text-xs font-semibold text-white">
                      Click to upload photos of the person
                    </p>
                    <p className="text-[10px] text-gray-400">
                      Include clear Front-Face, Close-Up, and Smiling photos for best quality (JPEG / PNG)
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 pt-1">
                    {photos.map((p, idx) => (
                      <div key={p.id} className="relative group rounded-xl overflow-hidden border border-purple-500/40 aspect-square bg-black">
                        <Image src={p.dataUrl} alt={`Photo ${idx + 1}`} fill className="object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-1.5">
                          <span className="text-[9px] font-bold bg-pink-600 text-white px-1.5 py-0.5 rounded-full self-start">
                            {idx === 0 ? 'Main Face' : idx === 1 ? 'Close-Up' : `Angle ${idx + 1}`}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removePhoto(p.id);
                            }}
                            className="self-end bg-red-600/90 text-white p-1 rounded-full text-xs hover:bg-red-700"
                          >
                            <FaTrash className="text-[10px]" />
                          </button>
                        </div>
                        {idx === 0 && (
                          <span className="absolute bottom-1 left-1 text-[9px] font-bold bg-black/70 text-pink-300 px-1.5 py-0.2 rounded">
                            Primary
                          </span>
                        )}
                      </div>
                    ))}
                    {photos.length < 5 && (
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border border-dashed border-white/20 hover:border-pink-500 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:text-white cursor-pointer aspect-square bg-white/5 transition-colors"
                      >
                        <FaPlus className="text-sm mb-1" />
                        <span className="text-[10px] font-medium">+ Add More</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── SECTION 2: OPTIONAL VOICE SAMPLE UPLOAD / RECORD ─────────── */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <HiMicrophone className="text-purple-400 text-base" />
                      <span>2. Voice Sample for Voice Cloning <span className="text-xs text-purple-300 font-normal">(Optional)</span></span>
                    </h4>
                    <p className="text-[11px] text-gray-400">
                      Upload or record a 10-30s audio clip of the person speaking to clone their exact voice.
                    </p>
                  </div>
                </div>

                <input
                  type="file"
                  ref={voiceInputRef}
                  onChange={handleVoiceUpload}
                  accept="audio/*"
                  className="hidden"
                />

                {voiceAudioUrl ? (
                  <div className="flex items-center justify-between bg-purple-950/40 p-3 rounded-xl border border-purple-500/40">
                    <div className="flex items-center gap-3">
                      <FaVolumeUp className="text-pink-400 text-lg" />
                      <div>
                        <p className="text-xs font-bold text-white truncate max-w-[200px]">
                          {voiceFile?.name || 'Recorded Voice Sample'}
                        </p>
                        <audio src={voiceAudioUrl} controls className="h-7 w-48 mt-1" />
                      </div>
                    </div>
                    <Button
                      size="sm"
                      isIconOnly
                      color="danger"
                      variant="light"
                      onClick={removeVoice}
                    >
                      <HiTrash className="text-base" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="bordered"
                      color="secondary"
                      className="text-xs font-bold border-purple-400/60"
                      startContent={<HiMicrophone className="text-base" />}
                      onClick={() => voiceInputRef.current?.click()}
                    >
                      Upload Audio File (.mp3, .wav, .m4a)
                    </Button>

                    <Button
                      size="sm"
                      variant={isRecording ? "solid" : "bordered"}
                      color={isRecording ? "danger" : "secondary"}
                      className="text-xs font-bold"
                      startContent={<span className={`w-2 h-2 rounded-full ${isRecording ? 'bg-white animate-ping' : 'bg-red-500'}`} />}
                      onClick={isRecording ? stopRecording : startRecording}
                    >
                      {isRecording ? "Stop Recording" : "Record with Mic (15s)"}
                    </Button>
                  </div>
                )}
              </div>

              {/* ── SECTION 3: COMPANION DETAILS ─────────────────────────────── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Companion Name"
                  placeholder="e.g. Deepak, Rahul, Priya"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  isRequired
                  size="sm"
                  classNames={{
                    inputWrapper: 'bg-white/5 border border-white/10 hover:border-purple-400',
                  }}
                />

                <Select
                  label="Gender"
                  selectedKeys={[gender]}
                  onChange={(e) => setGender(e.target.value as 'woman' | 'man')}
                  size="sm"
                  classNames={{
                    trigger: 'bg-white/5 border border-white/10 hover:border-purple-400',
                  }}
                >
                  <SelectItem key="man" value="man">
                    👨 Man (Male Voice &amp; Persona)
                  </SelectItem>
                  <SelectItem key="woman" value="woman">
                    👩 Woman (Female Voice &amp; Persona)
                  </SelectItem>
                </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Age"
                  placeholder="27"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  size="sm"
                  classNames={{
                    inputWrapper: 'bg-white/5 border border-white/10 hover:border-purple-400',
                  }}
                />

                <Input
                  label="Languages Spoken"
                  value={languageChoice}
                  onChange={(e) => setLanguageChoice(e.target.value)}
                  size="sm"
                  classNames={{
                    inputWrapper: 'bg-white/5 border border-white/10 hover:border-purple-400',
                  }}
                />
              </div>

              <Input
                label="Role / Title"
                placeholder="e.g. Best Friend, Late-Night Listener, Chai Partner"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                size="sm"
                classNames={{
                  inputWrapper: 'bg-white/5 border border-white/10 hover:border-purple-400',
                }}
              />

              <Textarea
                label="Personality &amp; How They Should Talk"
                placeholder="Describe tone, humor, Hindi/English mix, favorite topics..."
                value={personality}
                onChange={(e) => setPersonality(e.target.value)}
                minRows={2}
                size="sm"
                classNames={{
                  inputWrapper: 'bg-white/5 border border-white/10 hover:border-purple-400',
                }}
              />

              {uploadError && (
                <p className="text-xs text-red-400 font-semibold bg-red-950/30 p-2.5 rounded-xl border border-red-500/30">
                  {uploadError}
                </p>
              )}
            </ModalBody>

            <ModalFooter className="flex justify-end gap-2">
              <Button variant="light" color="default" onClick={onClose} disabled={isGenerating}>
                Cancel
              </Button>
              <Button
                color="secondary"
                className="bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 text-white font-bold px-6 shadow-lg shadow-pink-500/25"
                onClick={handleSubmit}
                isLoading={isGenerating}
                startContent={!isGenerating && <HiSparkles className="text-amber-300" />}
              >
                {isGenerating ? 'Submitting Photos & Voice...' : 'Create Companion'}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
