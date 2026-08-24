'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Card,
  CardBody,
  Button,
  Avatar,
} from '@nextui-org/react';
import {
  FaVideo,
  FaPhoneSlash,
  FaPhoneAlt,
} from 'react-icons/fa';

interface ActiveIncomingCall {
  id: string;
  type: 'group' | 'direct';
  targetId: string;
  callerId: string;
  callerName: string;
  callerImage?: string | null;
  groupName?: string | null;
  startedAt: number;
}

export default function IncomingCallManager() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const userId = session?.user?.id;

  const [incomingCall, setIncomingCall] = useState<ActiveIncomingCall | null>(null);
  const [dismissedCallIds, setDismissedCallIds] = useState<string[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const ringIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Play Web Audio phone ringtone
  const startRingtone = () => {
    try {
      if (!audioCtxRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          audioCtxRef.current = new AudioCtx();
        }
      }

      const playRingChime = () => {
        if (!audioCtxRef.current) return;
        const ctx = audioCtxRef.current;
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }

        const now = ctx.currentTime;
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc1.frequency.setValueAtTime(440, now); // A4
        osc2.frequency.setValueAtTime(480, now); // B4

        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.2, now + 0.05);
        gainNode.gain.setValueAtTime(0.2, now + 1.2);
        gainNode.gain.linearRampToValueAtTime(0, now + 1.4);

        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 1.5);
        osc2.stop(now + 1.5);
      };

      playRingChime();
      ringIntervalRef.current = setInterval(playRingChime, 3000);
    } catch (_) {}
  };

  const stopRingtone = () => {
    if (ringIntervalRef.current) {
      clearInterval(ringIntervalRef.current);
      ringIntervalRef.current = null;
    }
  };

  // Only poll if user is logged in
  useEffect(() => {
    if (status !== 'authenticated' || !userId) {
      stopRingtone();
      return;
    }

    // Don't pop up if user is already inside a call
    if (pathname?.startsWith('/groups/call/') || pathname?.startsWith('/dating/call/') || pathname?.startsWith('/virtual/call/')) {
      stopRingtone();
      return;
    }

    const checkIncoming = async () => {
      try {
        const res = await fetch('/api/calls/ring');
        const data = await res.json();
        if (data.success && data.activeCall) {
          const call: ActiveIncomingCall = data.activeCall;
          if (!dismissedCallIds.includes(call.id)) {
            if (!incomingCall || incomingCall.id !== call.id) {
              setIncomingCall(call);
              startRingtone();
            }
            return;
          }
        }
        if (incomingCall) {
          setIncomingCall(null);
          stopRingtone();
        }
      } catch (_) {}
    };

    checkIncoming();
    const interval = setInterval(checkIncoming, 8000); // Poll every 8s to prevent database quota exhaustion

    return () => {
      clearInterval(interval);
      stopRingtone();
    };
  }, [pathname, dismissedCallIds, incomingCall, status, userId]);

  const handleAccept = () => {
    if (!incomingCall) return;
    stopRingtone();
    const callUrl =
      incomingCall.type === 'group'
        ? `/groups/call/${incomingCall.targetId}`
        : `/dating/call/${incomingCall.callerId}`;
    setIncomingCall(null);
    router.push(callUrl);
  };

  const handleDecline = () => {
    if (!incomingCall) return;
    stopRingtone();
    setDismissedCallIds((prev) => [...prev, incomingCall.id]);
    fetch(`/api/calls/ring?callId=${incomingCall.id}`, { method: 'DELETE' }).catch(() => {});
    setIncomingCall(null);
  };

  if (!incomingCall) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 50 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 50 }}
        className="fixed bottom-6 right-4 sm:right-6 z-[9999] max-w-sm w-full"
      >
        <Card className="rounded-3xl border-2 border-pink-500/80 shadow-2xl bg-slate-950/95 text-white backdrop-blur-2xl overflow-hidden p-1">
          <CardBody className="p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-3.5">
              <div className="relative">
                <Avatar
                  src={incomingCall.callerImage || undefined}
                  name={incomingCall.callerName}
                  className="w-14 h-14 ring-4 ring-pink-500 text-lg font-bold text-white bg-gradient-to-tr from-pink-500 to-purple-600 animate-pulse"
                />
                <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-emerald-500 ring-2 ring-slate-950 animate-ping" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="inline-flex items-center gap-1 text-[10px] uppercase font-extrabold text-pink-400 tracking-wider">
                  <FaPhoneAlt className="animate-bounce" />
                  <span>Incoming Call...</span>
                </div>
                <h2 className="font-extrabold text-base text-white truncate">
                  {incomingCall.callerName}
                </h2>
                <p className="text-xs text-slate-300 truncate">
                  {incomingCall.type === 'group'
                    ? `Group: ${incomingCall.groupName || 'Hangout'}`
                    : '1-on-1 Dating Call'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <Button
                onClick={handleDecline}
                className="bg-red-500/20 hover:bg-red-500/30 text-red-400 font-bold rounded-2xl text-xs border border-red-500/40"
                startContent={<FaPhoneSlash />}
              >
                Decline
              </Button>

              <Button
                onClick={handleAccept}
                className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-bold rounded-2xl text-xs shadow-lg shadow-emerald-500/30 animate-pulse"
                startContent={<FaVideo />}
              >
                Accept Call
              </Button>
            </div>
          </CardBody>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}
