import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// POST /api/presence/heartbeat — mark current user as active
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (userId) {
      // Update Member updated timestamp
      await prisma.member.updateMany({
        where: { userId },
        data: { updated: new Date() },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}

// GET /api/presence/online — fetch list of active member userIds (active in last 3 minutes)
export async function GET(req: NextRequest) {
  try {
    const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);

    const activeMembers = await prisma.member.findMany({
      where: {
        updated: { gte: threeMinutesAgo },
      },
      select: {
        userId: true,
        name: true,
      },
    });

    const onlineUserIds = activeMembers.map((m) => m.userId);

    return NextResponse.json({ success: true, onlineUserIds });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}
