'use client';

import React from 'react';
import { VirtualPersona } from '@/lib/virtualPersonas';
import { AvatarActionType, OutfitStyle } from './ThreeAvatarScene';
import dynamic from 'next/dynamic';

// TalkingHead is a heavy WebGL library — lazy-load, never SSR
const TalkingHeadAvatar = dynamic(
  () => import('./TalkingHeadAvatar'),
  { ssr: false, loading: () => null },
);

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

export default function VirtualAvatarCanvas(props: Props) {
  return (
    <TalkingHeadAvatar {...props} />
  );
}
