import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

interface SignalPayload {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  targetId?: string; // Optional specific target
  signal: any; // SDP offer/answer or ICE candidate
  createdAt: number;
}

declare global {
  var __signals: SignalPayload[] | undefined;
}

if (!global.__signals) {
  global.__signals = [];
}

const signals = global.__signals;

// Cleanup signals older than 30 seconds
function cleanupSignals() {
  const now = Date.now();
  const valid = signals.filter((s) => now - s.createdAt < 30000);
  signals.length = 0;
  signals.push(...valid);
}

// POST /api/calls/signal — send an SDP or ICE signal to room
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const senderId = session?.user?.id;
    if (!senderId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { roomId, targetId, signal, senderName } = await req.json();

    if (!roomId || !signal) {
      return NextResponse.json({ error: 'roomId and signal required' }, { status: 400 });
    }

    const signalData: SignalPayload = {
      id: `sig_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      roomId,
      senderId,
      senderName: senderName || session.user.name || 'Peer',
      targetId,
      signal,
      createdAt: Date.now(),
    };

    signals.push(signalData);
    cleanupSignals();

    return NextResponse.json({ success: true, signalId: signalData.id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET /api/calls/signal?roomId=...&since=... — poll for signals
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const currentUserId = session?.user?.id;
    const { searchParams } = new URL(req.url);
    const roomId = searchParams.get('roomId');
    const since = parseInt(searchParams.get('since') || '0', 10);

    if (!roomId) {
      return NextResponse.json({ error: 'roomId is required' }, { status: 400 });
    }

    cleanupSignals();

    const roomSignals = signals.filter((s) => {
      if (s.roomId !== roomId) return false;
      if (s.senderId === currentUserId) return false; // Ignore own signals
      if (s.targetId && s.targetId !== currentUserId) return false; // Ignore signals meant for another peer
      return s.createdAt > since;
    });

    return NextResponse.json({ success: true, signals: roomSignals });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
