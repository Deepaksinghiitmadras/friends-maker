import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const body = await req.json();
    const { category, action, targetId, targetName, durationSec, details } = body;

    const userEmail = session?.user?.email || body.userEmail || null;
    const userName = session?.user?.name || body.userName || 'Guest User';
    const userId = session?.user?.id || body.userId || null;
    const userAgent = req.headers.get('user-agent') || 'Unknown Device';

    const activity = await prisma.userActivity.create({
      data: {
        userId,
        userEmail,
        userName,
        category: category || 'virtual_dating',
        action: action || 'page_view',
        targetId: targetId ? String(targetId) : null,
        targetName: targetName ? String(targetName) : null,
        durationSec: durationSec ? Number(durationSec) : null,
        details: details || {},
        deviceInfo: userAgent.slice(0, 150),
      },
    });

    return NextResponse.json({ success: true, activity });
  } catch (error: any) {
    console.error('[📊 ACTIVITY LOG ERROR]', error);
    return NextResponse.json({ error: error.message || 'Failed to log activity' }, { status: 500 });
  }
}
