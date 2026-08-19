'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Textarea,
  Chip,
  Tabs,
  Tab,
} from '@nextui-org/react';
import {
  FaSun,
  FaMoon,
  FaCamera,
  FaEnvelope,
  FaWhatsapp,
  FaCheck,
  FaVolumeUp,
  FaHeart,
} from 'react-icons/fa';
import { VirtualPersona } from '@/lib/virtualPersonas';

interface DailyNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  persona: VirtualPersona;
  userEmail?: string;
  userName?: string;
}

export default function DailyNoteModal({
  isOpen,
  onClose,
  persona,
  userEmail,
  userName = 'Friend',
}: DailyNoteModalProps) {
  const [noteType, setNoteType] = useState<'morning' | 'night' | 'surprise'>('morning');
  const [customMsg, setCustomMsg] = useState('');
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [emailSentSuccess, setEmailSentSuccess] = useState(false);

  const isMan = persona.gender === 'man';

  const defaultMessages = {
    morning: isMan
      ? `Good morning ${userName}! ☀️ Aaj ki taaza chai ke saath aapki yaad aayi. Hope aapka din bohot energetic aur mast rahe. Khud ka khayal rakhna!`
      : `Good morning ${userName}! ☀️ Aaj subah subah aapse baat karne ka mann hua. Ek pyari si smile ke saath din shuru karo, sab bohot accha hoga ✨`,
    night: isMan
      ? `Good night ${userName}! 🌙 Aaj poore din ki saari thakan bhool ke mast araam se sona. Kal milte hain ek nayi energy ke saath. Shubh raatri!`
      : `Good night ${userName}! 🌙 Pura din chahe kaisa bhi raha ho, ab sukoon se aakhein band karo aur meethay sapne dekho. Take care! ✨`,
    surprise: isMan
      ? `Hey ${userName}! 📸 Bas aise hi aapka haal-chaal lene ke liye ye chhota sa photo bheja. Aap batao, kya chal raha hai?`
      : `Hey ${userName}! 📸 Aaj mausam bohot pyara tha to aapki yaad aa gayi. Socha ek pyari si selfie bhej ke aapka haal pooch loon! 💕`,
  };

  const currentMessage = customMsg || defaultMessages[noteType];

  const selfieUrl =
    persona.referencePhotos && persona.referencePhotos.length > 0
      ? persona.referencePhotos[Math.floor(Math.random() * persona.referencePhotos.length)]
      : persona.avatarImage;

  const handleSendEmail = async () => {
    setLoadingEmail(true);
    setEmailSentSuccess(false);
    try {
      const res = await fetch('/api/virtual/send-daily-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personaId: persona.id,
          noteType,
          customMessage: currentMessage,
          targetEmail: userEmail,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setEmailSentSuccess(true);
        setTimeout(() => setEmailSentSuccess(false), 4000);
      } else {
        alert(data.error || 'Failed to send email note');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to send email note');
    } finally {
      setLoadingEmail(false);
    }
  };

  const handleOpenWhatsApp = () => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://truefriends.app';
    const whatsappText = encodeURIComponent(
      `*${persona.name} (${persona.title}) sent you a ${noteType} note:* \n\n"${currentMessage}"\n\n🎥 Video call ${persona.name} here: ${baseUrl}/virtual/call/${persona.id}`
    );
    window.open(`https://api.whatsapp.com/send?text=${whatsappText}`, '_blank');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      classNames={{
        base: 'bg-slate-950 text-slate-100 border border-purple-500/30 rounded-3xl shadow-2xl',
        header: 'border-b border-slate-800 pb-3',
        footer: 'border-t border-slate-800 pt-3',
      }}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 text-white text-sm">
              <FaCamera />
            </span>
            <div>
              <h2 className="text-base font-bold text-white">
                Daily Selfie &amp; Voice Note from {persona.name}
              </h2>
              <p className="text-xs text-purple-300 font-normal">
                Receive spontaneous morning/night updates via Email &amp; WhatsApp
              </p>
            </div>
          </div>
        </ModalHeader>

        <ModalBody className="py-4 space-y-4">
          {/* Note Type Selector */}
          <Tabs
            selectedKey={noteType}
            onSelectionChange={(k) => {
              setNoteType(k as any);
              setCustomMsg('');
            }}
            size="sm"
            color="secondary"
            className="w-full justify-center"
            classNames={{
              tabList: 'bg-slate-900 border border-slate-800 p-1',
              tab: 'text-xs font-bold',
            }}
          >
            <Tab
              key="morning"
              title={
                <div className="flex items-center gap-1.5">
                  <FaSun className="text-amber-400" />
                  <span>☀️ Morning Note</span>
                </div>
              }
            />
            <Tab
              key="night"
              title={
                <div className="flex items-center gap-1.5">
                  <FaMoon className="text-indigo-400" />
                  <span>🌙 Night Note</span>
                </div>
              }
            />
            <Tab
              key="surprise"
              title={
                <div className="flex items-center gap-1.5">
                  <FaHeart className="text-pink-400" />
                  <span>✨ Surprise Selfie</span>
                </div>
              }
            />
          </Tabs>

          {/* Live Preview Card */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex gap-3.5 items-start">
              <div className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-purple-500/40 shrink-0 shadow-md">
                <Image
                  src={selfieUrl}
                  alt={persona.name}
                  fill
                  className="object-cover"
                />
              </div>

              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-200">{persona.name}</span>
                  <Chip size="sm" variant="flat" color="secondary" className="text-[10px] uppercase font-bold">
                    {noteType} note
                  </Chip>
                </div>
                <p className="text-xs text-slate-300 italic bg-slate-950 p-2 rounded-lg border border-slate-800/80 leading-relaxed">
                  &ldquo;{currentMessage}&rdquo;
                </p>
              </div>
            </div>
          </div>

          {/* Edit Message */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-300">
              Customize Companion&apos;s Message (Optional):
            </label>
            <Textarea
              value={customMsg}
              placeholder={defaultMessages[noteType]}
              onChange={(e) => setCustomMsg(e.target.value)}
              minRows={2}
              size="sm"
              variant="bordered"
              classNames={{
                input: '!text-white text-xs font-medium placeholder:!text-slate-500',
                inputWrapper: '!bg-slate-900 !border-slate-700 hover:!border-purple-400',
              }}
            />
          </div>

          {/* Success Banner */}
          {emailSentSuccess && (
            <div className="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2">
              <FaCheck className="text-emerald-400" />
              <span>Selfie &amp; voice note sent to your email successfully! Check your inbox.</span>
            </div>
          )}
        </ModalBody>

        <ModalFooter className="flex flex-col sm:flex-row gap-2 justify-between">
          <Button
            size="sm"
            variant="flat"
            color="default"
            className="text-xs font-bold text-slate-300"
            onClick={onClose}
          >
            Cancel
          </Button>

          <div className="flex gap-2">
            <Button
              size="sm"
              color="success"
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/30"
              startContent={<FaWhatsapp className="text-sm" />}
              onClick={handleOpenWhatsApp}
            >
              Share via WhatsApp
            </Button>

            <Button
              size="sm"
              color="secondary"
              className="bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold text-xs shadow-md shadow-purple-600/30"
              startContent={<FaEnvelope className="text-xs" />}
              isLoading={loadingEmail}
              onClick={handleSendEmail}
            >
              Send to My Email
            </Button>
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
