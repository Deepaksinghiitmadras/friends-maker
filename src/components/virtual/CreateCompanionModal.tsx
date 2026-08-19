'use client';

import React, { useState } from 'react';
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
} from '@nextui-org/react';
import { HiSparkles, HiPhoto, HiOutlineClock } from 'react-icons/hi2';
import { FaUserPlus, FaVideo, FaCheckCircle, FaClock, FaHeart } from 'react-icons/fa';

interface CreateCompanionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (persona: any) => void;
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
  const [imageDataUrl, setImageDataUrl] = useState(''); // base64 data URL of the uploaded image
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [createdPersona, setCreatedPersona] = useState<any>(null);
  const [uploadError, setUploadError] = useState('');

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setUploadError('Image too large. Max 10MB.');
        return;
      }
      setUploadError('');
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setImageDataUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    if (!imageDataUrl) {
      setUploadError('Please upload a photo for your companion.');
      return;
    }

    setIsGenerating(true);
    setUploadError('');

    try {
      const personaId = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

      // Step 1: Upload image to server
      console.log('[📸 MODAL] Uploading image to server...');
      const uploadRes = await fetch('/api/virtual/upload-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: imageDataUrl,
          personaId,
        }),
      });

      const uploadData = await uploadRes.json();
      if (!uploadData.success) {
        throw new Error(uploadData.error || 'Image upload failed');
      }

      console.log(`[📸 MODAL] Image uploaded: ${uploadData.publicPath}`);

      // Step 2: Create the persona (which triggers video generation)
      const res = await fetch('/api/virtual/custom-persona', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          gender,
          age: Number(age) || 27,
          title,
          personality,
          languages: languageChoice.split('·').map((s) => s.trim()),
          avatarImage: uploadData.publicPath, // Use the server path for display
          serverImagePath: uploadData.publicPath, // Pass server path for video generation
        }),
      });

      const data = await res.json();
      if (data.success && data.persona) {
        setCreatedPersona(data.persona);
        setIsSubmitted(true);
        if (onCreated) onCreated(data.persona);
      } else {
        throw new Error(data.error || 'Failed to create companion');
      }
    } catch (err: any) {
      console.error('Failed to create companion:', err);
      setUploadError(err.message || 'Failed to create companion. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDone = () => {
    setIsSubmitted(false);
    setName('');
    setImageDataUrl('');
    setUploadError('');
    onClose();
    if (onCreated && createdPersona) {
      onCreated(createdPersona);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      scrollBehavior="inside"
      className="bg-gray-950 border border-purple-500/30 text-white shadow-2xl rounded-3xl"
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1 border-b border-white/10 pb-4">
          <div className="flex items-center gap-2 text-pink-400 text-sm font-semibold uppercase tracking-wider">
            <HiSparkles className="text-amber-300 animate-spin" style={{ animationDuration: '4s' }} />
            AI Companion Studio
          </div>
          <h2 className="text-2xl font-bold text-white">
            {isSubmitted ? 'Companion Submitted Successfully!' : 'Create Your Custom Virtual Companion'}
          </h2>
          <p className="text-xs text-gray-400">
            {isSubmitted
              ? 'Awaiting Admin Approval. Please wait...'
              : 'Upload a photo of who you want to talk to. We generate unique video clips from your photo using AI.'}
          </p>
        </ModalHeader>

        <ModalBody className="py-6 space-y-6">
          {!isSubmitted ? (
            <>
              {/* Photo Upload & Preview */}
              <div className="flex flex-col sm:flex-row items-center gap-6 p-4 rounded-2xl bg-white/5 border border-white/10">
                <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-2xl overflow-hidden bg-gray-900 border-2 border-dashed border-purple-500/40 flex items-center justify-center flex-shrink-0 group">
                  {imageDataUrl ? (
                    <Image src={imageDataUrl} alt="Preview" fill className="object-cover" />
                  ) : (
                    <div className="text-center p-2">
                      <HiPhoto className="text-3xl text-purple-400 mx-auto mb-1" />
                      <span className="text-[11px] text-gray-400">Upload Photo</span>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    title="Upload photo"
                  />
                </div>

                <div className="flex-grow space-y-2 text-center sm:text-left">
                  <h4 className="text-sm font-semibold text-white">Upload Companion Face / Portrait</h4>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Upload a clear portrait photo. AI will generate unique idle & speaking video clips from this photo.
                  </p>
                  {uploadError && (
                    <p className="text-xs text-red-400 font-semibold">{uploadError}</p>
                  )}
                  <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white cursor-pointer transition-all">
                    <HiPhoto className="text-sm" />
                    <span>{imageDataUrl ? 'Change Photo' : 'Choose Photo File'}</span>
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                  {imageDataUrl && (
                    <span className="inline-flex items-center gap-1 ml-2 text-xs text-emerald-400">
                      <FaCheckCircle /> Photo ready
                    </span>
                  )}
                </div>
              </div>

              {/* Identity Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Companion Name"
                  placeholder="e.g., Kabir, Rahul, Meera"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  variant="bordered"
                  isRequired
                  classNames={{
                    input: 'text-white font-medium',
                    label: 'text-gray-300 font-semibold',
                  }}
                />

                <Select
                  label="Gender"
                  selectedKeys={[gender]}
                  onChange={(e) => setGender(e.target.value as 'woman' | 'man')}
                  variant="bordered"
                  classNames={{
                    label: 'text-gray-300 font-semibold',
                    value: 'text-white',
                  }}
                >
                  <SelectItem key="man" value="man">
                    👨 Man (Male Voice & Persona)
                  </SelectItem>
                  <SelectItem key="woman" value="woman">
                    👩 Woman (Female Voice & Persona)
                  </SelectItem>
                </Select>

                <Input
                  label="Age"
                  placeholder="e.g., 27"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  variant="bordered"
                  classNames={{
                    input: 'text-white',
                    label: 'text-gray-300 font-semibold',
                  }}
                />

                <Input
                  label="Languages Spoken"
                  value={languageChoice}
                  onChange={(e) => setLanguageChoice(e.target.value)}
                  variant="bordered"
                  classNames={{
                    input: 'text-white',
                    label: 'text-gray-300 font-semibold',
                  }}
                />
              </div>

              <Input
                label="Role / Title"
                placeholder="e.g., Casual Friend & Musician"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                variant="bordered"
                classNames={{
                  input: 'text-white',
                  label: 'text-gray-300 font-semibold',
                }}
              />

              <Textarea
                label="Personality & Emotional Vibe"
                placeholder="How do they talk? What is their vibe? (e.g. friendly, casual, loves deep chai conversations, empathetic listener)"
                value={personality}
                onChange={(e) => setPersonality(e.target.value)}
                rows={3}
                variant="bordered"
                classNames={{
                  input: 'text-white text-sm',
                  label: 'text-gray-300 font-semibold',
                }}
              />
            </>
          ) : (
            /* 10-Minute Waiting State Banner */
            <div className="text-center py-6 px-4 space-y-6">
              <div className="relative w-24 h-24 mx-auto rounded-full overflow-hidden border-4 border-purple-500 shadow-xl shadow-purple-500/30">
                <Image
                  src={createdPersona?.avatarImage || imageDataUrl || '/images/custom_user_companion.jpeg'}
                  alt={createdPersona?.name || 'Companion'}
                  fill
                  className="object-cover"
                />
              </div>

              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold uppercase tracking-wider">
                  <FaClock className="text-amber-400 animate-pulse" />
                  Processing...
                </div>
                <h3 className="text-xl font-extrabold text-white">
                  {createdPersona?.name} is Being Created!
                </h3>

              </div>

              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 max-w-md mx-auto text-left space-y-2.5">
                <div className="flex items-center gap-3 text-xs text-gray-300">
                  <FaCheckCircle className="text-emerald-400 text-sm flex-shrink-0" />
                  <span>Photo uploaded to server</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-300">
                  <FaCheckCircle className="text-emerald-400 text-sm flex-shrink-0" />
                  <span>AI Brain & Personality Configured</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-300">
                  <FaCheckCircle className="text-emerald-400 text-sm flex-shrink-0" />
                  <span>
                    {createdPersona?.gender === 'man' ? 'Friendly Male Voice' : 'Warm Female Voice'} Setup
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-300">
                  <HiOutlineClock className="text-amber-400 text-base flex-shrink-0 animate-spin" style={{ animationDuration: '6s' }} />
                  <span className="text-amber-200 font-medium">
                    Admin Approval Pending. Please come back after ~10 minutes!
                  </span>
                </div>
              </div>
            </div>
          )}
        </ModalBody>

        <ModalFooter className="border-t border-white/10 pt-4">
          {!isSubmitted ? (
            <>
              <Button variant="light" color="default" onClick={onClose}>
                Cancel
              </Button>
              <Button
                color="primary"
                className="bg-gradient-to-r from-pink-600 to-purple-600 font-bold shadow-lg shadow-pink-500/30"
                isLoading={isGenerating}
                onClick={handleSubmit}
                isDisabled={!name.trim() || !imageDataUrl}
                startContent={!isGenerating && <HiSparkles />}
              >
                {isGenerating ? 'Uploading & Creating...' : 'Create Companion'}
              </Button>
            </>
          ) : (
            <Button
              color="primary"
              className="bg-gradient-to-r from-pink-600 to-purple-600 font-bold px-8"
              onClick={handleDone}
            >
              Got It, I'll Check Back in 10 Min
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
