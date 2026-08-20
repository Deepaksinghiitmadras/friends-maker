import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Force dynamic rendering — prevents Next.js from statically prerendering
// this route at build time (which would freeze analytics data at 0).
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [
      totalUsers,
      totalMembers,
      totalCompanions,
      totalActivities,
      recentActivities,
      callActivities,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.member.count(),
      prisma.customPersona.count(),
      prisma.userActivity.count(),
      prisma.userActivity.findMany({
        take: 100,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.userActivity.findMany({
        where: {
          action: { in: ['virtual_call_end', 'virtual_call_start', 'real_call_end'] },
        },
        select: {
          durationSec: true,
          category: true,
          targetName: true,
          userEmail: true,
          userName: true,
          createdAt: true,
        },
      }),
    ]);

    // Compute total call durations
    let totalVirtualCallSeconds = 0;
    let totalRealCallSeconds = 0;
    const personaCallMap: Record<string, number> = {};
    const userCallMap: Record<string, number> = {};

    for (const ca of callActivities) {
      const dur = ca.durationSec || 0;
      if (ca.category === 'virtual_dating') {
        totalVirtualCallSeconds += dur;
        if (ca.targetName) {
          personaCallMap[ca.targetName] = (personaCallMap[ca.targetName] || 0) + dur;
        }
        const uIdentifier = ca.userEmail || ca.userName || 'Anonymous';
        userCallMap[uIdentifier] = (userCallMap[uIdentifier] || 0) + dur;
      } else if (ca.category === 'real_dating') {
        totalRealCallSeconds += dur;
      }
    }

    const totalVirtualCallMinutes = Math.round(totalVirtualCallSeconds / 60);
    const totalRealCallMinutes = Math.round(totalRealCallSeconds / 60);

    return NextResponse.json({
      success: true,
      stats: {
        totalUsers,
        totalMembers,
        totalCompanions,
        totalActivities,
        totalVirtualCallMinutes,
        totalRealCallMinutes,
        totalVirtualCalls: callActivities.filter((c) => c.category === 'virtual_dating').length,
        totalRealCalls: callActivities.filter((c) => c.category === 'real_dating').length,
        topPersonasByMinutes: Object.entries(personaCallMap)
          .map(([name, sec]) => ({ name, minutes: Math.round(sec / 60) }))
          .sort((a, b) => b.minutes - a.minutes)
          .slice(0, 10),
        topUsersByMinutes: Object.entries(userCallMap)
          .map(([user, sec]) => ({ user, minutes: Math.round(sec / 60) }))
          .sort((a, b) => b.minutes - a.minutes)
          .slice(0, 10),
      },
      recentActivities,
    });
  } catch (error: any) {
    console.error('[📊 ADMIN ANALYTICS ERROR]', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch analytics' }, { status: 500 });
  }
}
