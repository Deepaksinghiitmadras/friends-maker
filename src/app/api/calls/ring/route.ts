import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// In-memory active calls registry (fast real-time lookup with timestamp expiry)
interface ActiveCall {
  id: string;
  type: 'group' | 'direct';
  targetId: string; // groupId or recipientUserId
  callerId: string;
  callerName: string;
  callerImage?: string | null;
  groupName?: string | null;
  startedAt: number;
}

declare global {
  var __activeCalls: Map<string, ActiveCall> | undefined;
}

if (!global.__activeCalls) {
  global.__activeCalls = new Map<string, ActiveCall>();
}

const activeCalls = global.__activeCalls;

// Cleanup calls older than 60 seconds
function cleanupExpiredCalls() {
  const now = Date.now();
  Array.from(activeCalls.entries()).forEach(([key, call]) => {
    if (now - call.startedAt > 60000) {
      activeCalls.delete(key);
    }
  });
}

// POST /api/calls/ring — initiate a call ring
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { type, targetId, groupName } = await req.json();

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { member: true },
    });

    const callerName = user?.member?.name || user?.name || session.user.name || 'Friend';
    const callerImage = user?.member?.image || user?.image || session.user.image || null;

    const callId = `call_${Date.now()}_${session.user.id}`;
    const callData: ActiveCall = {
      id: callId,
      type,
      targetId,
      callerId: session.user.id,
      callerName,
      callerImage,
      groupName: groupName || null,
      startedAt: Date.now(),
    };

    activeCalls.set(callId, callData);
    cleanupExpiredCalls();

    console.log(`[📞 CALL RING INITIATED] CallID: ${callId} | Type: ${type} | Target: ${targetId} | Caller: ${callerName}`);

    return NextResponse.json({ success: true, callId, call: callData });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET /api/calls/ring — check if there are any incoming calls for current user
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const currentUserId = session?.user?.id;

    if (!currentUserId) {
      return NextResponse.json({ success: true, activeCall: null });
    }

    cleanupExpiredCalls();

    // 1. Fetch user's joined group IDs
    const userGroups = await prisma.groupMember.findMany({
      where: { userId: currentUserId },
      select: { groupId: true },
    });
    const joinedGroupIds = userGroups.map((g) => g.groupId);

    // 2. Find any active call targeting user directly OR targeting user's joined groups
    const callsList = Array.from(activeCalls.values());
    for (let i = 0; i < callsList.length; i++) {
      const call = callsList[i];
      if (call.callerId === currentUserId) continue; // Don't ring caller's own phone

      if (call.type === 'direct' && call.targetId === currentUserId) {
        return NextResponse.json({ success: true, activeCall: call });
      }

      if (call.type === 'group' && joinedGroupIds.includes(call.targetId)) {
        return NextResponse.json({ success: true, activeCall: call });
      }
    }

    return NextResponse.json({ success: true, activeCall: null });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/calls/ring — dismiss / end call ring
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const callId = searchParams.get('callId');

    if (callId && activeCalls.has(callId)) {
      activeCalls.delete(callId);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
