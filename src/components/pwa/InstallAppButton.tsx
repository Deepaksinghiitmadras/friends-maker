'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@nextui-org/react';
import { FaDownload, FaMobileAlt, FaDesktop, FaCheckCircle } from 'react-icons/fa';

interface InstallAppButtonProps {
  variant?: 'solid' | 'flat' | 'bordered' | 'light';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function InstallAppButton({
  variant = 'solid',
  size = 'md',
  className = '',
}: InstallAppButtonProps) {
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already in standalone mode (installed)
    if (
      typeof window !== 'undefined' &&
      (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true)
    ) {
      setIsInstalled(true);
    }

    if (typeof window !== 'undefined' && window.__PWA_INSTALL_PROMPT__) {
      setIsInstallable(true);
    }

    const onPromptAvailable = () => setIsInstallable(true);
    window.addEventListener('pwa-prompt-available', onPromptAvailable);

    const onAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
    };
    window.addEventListener('appinstalled', onAppInstalled);

    return () => {
      window.removeEventListener('pwa-prompt-available', onPromptAvailable);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    const promptEvent = window.__PWA_INSTALL_PROMPT__;
    if (promptEvent) {
      promptEvent.prompt();
      const choiceResult = await promptEvent.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setIsInstalled(true);
      }
      window.__PWA_INSTALL_PROMPT__ = null;
      setIsInstallable(false);
    } else {
      // Fallback guide if browser does not support promptEvent (e.g. iOS Safari)
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        alert("To install TrueFriends on iOS:\n1. Tap the Share button (square with arrow up)\n2. Select 'Add to Home Screen' 📲");
      } else {
        alert("To install TrueFriends:\nOpen your browser menu (⋮ or ...) and select 'Install app' or 'Add to Home Screen' 📲");
      }
    }
  };

  if (isInstalled) {
    return (
      <div className={`inline-flex items-center gap-2 text-xs text-emerald-400 font-semibold px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 ${className}`}>
        <FaCheckCircle className="text-sm" />
        <span>TrueFriends App Installed</span>
      </div>
    );
  }

  return (
    <Button
      size={size}
      variant={variant}
      onClick={handleInstallClick}
      className={`font-bold transition-all duration-300 shadow-md hover:scale-105 active:scale-95 bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 text-white rounded-full ${className}`}
      startContent={<FaDownload className="text-xs animate-bounce" />}
    >
      <span>Install TrueFriends App</span>
    </Button>
  );
}
