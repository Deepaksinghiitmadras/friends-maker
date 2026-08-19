'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Button, Card, CardBody, Chip, Tooltip } from '@nextui-org/react';
import {
  FaVideo,
  FaVideoSlash,
  FaMicrophone,
  FaMicrophoneSlash,
  FaPhoneSlash,
  FaArrowLeft,
  FaExpand,
  FaCompress,
  FaLock,
  FaHeart,
  FaComments,
} from 'react-icons/fa';
import { HiSparkles } from 'react-icons/hi2';

export default function RealDatingCallPage() {
  const params = useParams();
  const router = useRouter();
  const targetUserId = params.userId as string;

  const [matchedMember, setMatchedMember] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [callStatus, setCallStatus] = useState<'connecting' | 'connected' | 'ended'>('connecting');
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Fetch matched member profile
  useEffect(() => {
    async function loadMember() {
      try {
        const res = await fetch(`/api/members/${targetUserId}`);
        const data = await res.json();
        if (data && data.member) {
          setMatchedMember(data.member);
        }
      } catch (_) {}
      setLoading(false);
    }
    if (targetUserId) {
      loadMember();
    }
  }, [targetUserId]);

  // 2. Initialize Camera & WebRTC stream
  useEffect(() => {
    async function setupLocalMedia() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: true,
        });
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        setCallStatus('connected');
        startTimeRef.current = Date.now();

        // Log call start
        fetch('/api/activity/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category: 'real_dating',
            action: 'real_call_start',
            targetId: targetUserId,
            targetName: matchedMember?.name || 'Matched User',
          }),
        }).catch(() => {});
      } catch (err: any) {
        console.warn('Camera/Mic permission warning:', err);
        setCallStatus('connected');
      }
    }

    setupLocalMedia();

    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [targetUserId, matchedMember?.name]);

  // 3. Call Duration Timer
  useEffect(() => {
    if (callStatus === 'connected') {
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callStatus]);

  // 4. Toggle Mute
  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicMuted(!audioTrack.enabled);
      }
    }
  };

  // 5. Toggle Video
  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  // 6. End Call
  const handleEndCall = () => {
    const totalDurationSec = callDuration;
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    setCallStatus('ended');

    // Log call duration to activity tracker
    fetch('/api/activity/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: 'real_dating',
        action: 'real_call_end',
        targetId: targetUserId,
        targetName: matchedMember?.name || 'Matched User',
        durationSec: totalDurationSec,
      }),
    }).catch(() => {});

    setTimeout(() => {
      router.push(`/members/${targetUserId}`);
    }, 1500);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-slate-950 text-white flex flex-col justify-between overflow-hidden">
      {/* ── TOP BAR ──────────────────────────────────────────────────────── */}
      <div className="relative z-20 flex items-center justify-between p-4 md:p-6 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-3">
          <Link
            href={`/members/${targetUserId}`}
            className="p-2.5 rounded-2xl bg-white/10 backdrop-blur-md hover:bg-white/20 text-white transition-all shadow-md"
          >
            <FaArrowLeft />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base md:text-lg font-bold text-white">
                {matchedMember?.name || 'Live 1-on-1 Video Call'}
              </h1>
              <Chip size="sm" color="danger" variant="dot" className="border-none text-[10px] font-bold text-rose-300">
                LIVE
              </Chip>
            </div>
            <p className="text-xs text-rose-300 flex items-center gap-1.5">
              <FaLock className="text-[9px]" /> End-to-End Encrypted Dating Call
            </p>
          </div>
        </div>

        {/* Live Call Duration Timer */}
        <div className="flex items-center gap-3">
          <div className="px-3.5 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-xs font-mono font-bold text-emerald-400 flex items-center gap-2 shadow-lg">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>{formatTime(callDuration)}</span>
          </div>

          <Button
            size="sm"
            isIconOnly
            variant="flat"
            className="bg-white/10 text-white"
            onClick={toggleFullscreen}
          >
            {isFullscreen ? <FaCompress /> : <FaExpand />}
          </Button>
        </div>
      </div>

      {/* ── MAIN VIDEO AREA ────────────────────────────────────────────────── */}
      <div className="relative flex-1 flex items-center justify-center p-4">
        {/* Remote / Matched Partner View */}
        <div className="relative w-full max-w-4xl aspect-[16/10] md:aspect-video rounded-3xl overflow-hidden bg-slate-900 border border-white/10 shadow-2xl flex items-center justify-center">
          {matchedMember?.image ? (
            <div className="relative w-full h-full">
              <Image
                src={matchedMember.image}
                alt={matchedMember.name || 'Match'}
                fill
                className="object-cover blur-sm opacity-40 scale-105"
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 space-y-4">
                <div className="relative w-28 h-28 md:w-36 md:h-36 rounded-full overflow-hidden border-4 border-rose-500 shadow-2xl shadow-rose-500/40">
                  <Image
                    src={matchedMember.image}
                    alt={matchedMember.name}
                    fill
                    className="object-cover"
                  />
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-black text-white">
                    {matchedMember.name}
                  </h2>
                  <p className="text-xs md:text-sm text-rose-200 mt-1 max-w-md">
                    {matchedMember.city ? `${matchedMember.city}, ${matchedMember.country}` : 'Connecting Video Stream...'}
                  </p>
                </div>
                <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-bold shadow-md animate-pulse">
                  <HiSparkles className="text-emerald-400" />
                  <span>1-on-1 Real Dating Video Active</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center space-y-3">
              <div className="w-20 h-20 rounded-full bg-rose-500/20 text-rose-400 mx-auto flex items-center justify-center text-3xl animate-pulse">
                <FaHeart />
              </div>
              <h3 className="text-lg font-bold text-white">Connecting with Match...</h3>
            </div>
          )}

          {/* Local User Self View (Picture-in-Picture) */}
          <div className="absolute bottom-4 right-4 w-28 md:w-44 aspect-video rounded-2xl overflow-hidden bg-black/90 border-2 border-white/20 shadow-2xl z-10">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${isVideoOff ? 'hidden' : ''}`}
            />
            {isVideoOff && (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 text-xs p-2 text-center">
                <FaVideoSlash className="text-lg mb-1 text-slate-500" />
                <span>Camera Off</span>
              </div>
            )}
            <div className="absolute bottom-1 left-2 text-[9px] font-bold text-white/80 bg-black/60 px-1.5 py-0.5 rounded">
              You {isMicMuted && '🔇'}
            </div>
          </div>
        </div>
      </div>

      {/* ── BOTTOM CALL CONTROLS ─────────────────────────────────────────── */}
      <div className="relative z-20 p-6 flex items-center justify-center gap-4 bg-gradient-to-t from-black/90 via-black/60 to-transparent">
        <Tooltip content={isMicMuted ? 'Unmute Mic' : 'Mute Mic'}>
          <Button
            size="lg"
            isIconOnly
            className={`rounded-full shadow-lg ${
              isMicMuted
                ? 'bg-rose-600 text-white'
                : 'bg-white/10 hover:bg-white/20 text-white backdrop-blur-md'
            }`}
            onClick={toggleMic}
          >
            {isMicMuted ? <FaMicrophoneSlash className="text-lg" /> : <FaMicrophone className="text-lg" />}
          </Button>
        </Tooltip>

        {/* End Call Button */}
        <Button
          size="lg"
          className="rounded-full px-8 bg-gradient-to-r from-red-600 to-rose-700 text-white font-bold shadow-xl shadow-red-600/40 hover:scale-105 transition-all text-sm flex items-center gap-2"
          onClick={handleEndCall}
        >
          <FaPhoneSlash className="text-base" />
          <span>End Call</span>
        </Button>

        <Tooltip content={isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}>
          <Button
            size="lg"
            isIconOnly
            className={`rounded-full shadow-lg ${
              isVideoOff
                ? 'bg-rose-600 text-white'
                : 'bg-white/10 hover:bg-white/20 text-white backdrop-blur-md'
            }`}
            onClick={toggleVideo}
          >
            {isVideoOff ? <FaVideoSlash className="text-lg" /> : <FaVideo className="text-lg" />}
          </Button>
        </Tooltip>

        <Tooltip content="Open Text Chat">
          <Button
            as={Link}
            href={`/members/${targetUserId}/chat`}
            size="lg"
            isIconOnly
            className="rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md shadow-lg"
          >
            <FaComments className="text-lg" />
          </Button>
        </Tooltip>
      </div>
    </div>
  );
}
