'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Button,
  Card,
  Avatar,
  Chip,
} from '@nextui-org/react';
import {
  FaVideo,
  FaVideoSlash,
  FaMicrophone,
  FaMicrophoneSlash,
  FaPhoneSlash,
  FaUsers,
  FaVolumeUp,
} from 'react-icons/fa';

interface Participant {
  id: string;
  name: string;
  image?: string | null;
  isMuted: boolean;
  isVideoOff: boolean;
  isSpeaking: boolean;
  avatarColor: string;
}

export default function GroupVideoCallPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.groupId as string;

  const [groupName, setGroupName] = useState<string>('Group Call');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [participants, setParticipants] = useState<Participant[]>([]);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  // 1. Fetch Group details and populate participants
  useEffect(() => {
    async function loadGroup() {
      try {
        const res = await fetch(`/api/groups/${groupId}`);
        const data = await res.json();
        if (data.success && data.group) {
          setGroupName(data.group.name);
          const colors = ['from-pink-500 to-rose-600', 'from-purple-600 to-indigo-600', 'from-blue-500 to-cyan-600', 'from-amber-500 to-orange-600'];
          const parts: Participant[] = (data.group.members || []).slice(0, 5).map((m: any, idx: number) => ({
            id: m.userId,
            name: m.userName || `Member ${idx + 1}`,
            image: m.userImage || null,
            isMuted: idx % 2 === 1,
            isVideoOff: false,
            isSpeaking: idx === 0,
            avatarColor: colors[idx % colors.length],
          }));
          setParticipants(parts);
        }
      } catch (_) {}
    }
    loadGroup();
  }, [groupId]);

  // 2. Setup Local Camera & Microphone
  useEffect(() => {
    let stream: MediaStream | null = null;

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: true,
        });
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.warn('Could not access camera/mic for group call:', err);
      }
    }

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // 3. Call Duration Timer
  useEffect(() => {
    const timer = setInterval(() => setCallDuration((d) => d + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // 4. Toggle Microphone
  const toggleMic = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMicMuted(!isMicMuted);
    }
  };

  // 5. Toggle Camera
  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  // 6. Leave Call
  const handleLeaveCall = () => {
    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
    }
    router.push(`/groups/${groupId}`);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-3 sm:p-6 pb-20 sm:pb-6">
      {/* ── TOP CALL HEADER ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between z-10 bg-slate-900/80 backdrop-blur-md px-4 py-3 rounded-2xl border border-slate-800 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
          <div>
            <h1 className="font-extrabold text-sm sm:text-base text-white flex items-center gap-2">
              <span>{groupName}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/30">
                LIVE GROUP CALL
              </span>
            </h1>
            <p className="text-xs text-slate-400 font-mono">{formatTime(callDuration)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Chip size="sm" variant="flat" color="secondary" className="font-bold text-xs">
            <FaUsers className="inline mr-1" /> {participants.length + 1} in Room
          </Chip>
        </div>
      </div>

      {/* ── RESPONSIVE VIDEO GRID (WHATSAPP/GOOGLE MEET STYLE) ───────────────── */}
      <div className="flex-1 my-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 items-center justify-center">
        {/* Local User Tile */}
        <Card className="h-60 sm:h-72 w-full rounded-3xl overflow-hidden relative bg-slate-900 border border-purple-500/40 shadow-xl">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover -scale-x-100 ${isVideoOff ? 'hidden' : 'block'}`}
          />

          {isVideoOff && (
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-slate-400 space-y-2">
              <Avatar name="You" className="w-16 h-16 bg-gradient-to-tr from-pink-500 to-purple-600 text-white font-bold" />
              <p className="text-xs">Camera is Off</p>
            </div>
          )}

          <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 border border-white/10">
            <span>You</span>
            {isMicMuted && <FaMicrophoneSlash className="text-red-400 text-xs" />}
          </div>
        </Card>

        {/* Remote Group Participants Tiles */}
        {participants.map((p, idx) => (
          <Card
            key={p.id || idx}
            className={`h-60 sm:h-72 w-full rounded-3xl overflow-hidden relative bg-slate-900 border transition-all ${
              p.isSpeaking ? 'border-emerald-500 shadow-emerald-500/20 shadow-xl ring-2 ring-emerald-500/40' : 'border-slate-800'
            }`}
          >
            <div className={`w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-slate-900 to-slate-950 p-6 space-y-3`}>
              <Avatar
                src={p.image || undefined}
                name={p.name}
                className={`w-20 h-20 text-xl font-bold bg-gradient-to-tr ${p.avatarColor} text-white shadow-lg ${
                  p.isSpeaking ? 'scale-105 ring-4 ring-emerald-400 animate-pulse' : ''
                }`}
              />
              <div className="text-center">
                <div className="font-bold text-sm text-white">{p.name}</div>
                {p.isSpeaking && (
                  <div className="text-[10px] text-emerald-400 font-semibold flex items-center justify-center gap-1 mt-0.5">
                    <FaVolumeUp className="animate-bounce" /> Speaking...
                  </div>
                )}
              </div>
            </div>

            <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 border border-white/10">
              <span>{p.name}</span>
              {p.isMuted && <FaMicrophoneSlash className="text-red-400 text-xs" />}
            </div>
          </Card>
        ))}
      </div>

      {/* ── FLOATING CALL CONTROLS BAR ───────────────────────────────────────── */}
      <div className="z-10 flex items-center justify-center gap-4 bg-slate-900/90 backdrop-blur-xl p-3 sm:p-4 rounded-3xl border border-slate-800/80 shadow-2xl max-w-md mx-auto">
        <Button
          isIconOnly
          onClick={toggleMic}
          className={`w-12 h-12 rounded-2xl font-bold text-base transition-all ${
            isMicMuted ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-slate-800 text-white hover:bg-slate-700'
          }`}
          title={isMicMuted ? 'Unmute Mic' : 'Mute Mic'}
        >
          {isMicMuted ? <FaMicrophoneSlash /> : <FaMicrophone />}
        </Button>

        <Button
          isIconOnly
          onClick={toggleVideo}
          className={`w-12 h-12 rounded-2xl font-bold text-base transition-all ${
            isVideoOff ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-slate-800 text-white hover:bg-slate-700'
          }`}
          title={isVideoOff ? 'Turn Video On' : 'Turn Video Off'}
        >
          {isVideoOff ? <FaVideoSlash /> : <FaVideo />}
        </Button>

        <Button
          isIconOnly
          onClick={handleLeaveCall}
          className="w-14 h-12 rounded-2xl font-bold text-lg bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/30 transition-all hover:scale-105"
          title="Leave Call"
        >
          <FaPhoneSlash />
        </Button>
      </div>
    </div>
  );
}
