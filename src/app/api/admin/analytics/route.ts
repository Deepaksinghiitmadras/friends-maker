import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
      usersList,
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
          userId: true,
          durationSec: true,
          category: true,
          targetName: true,
          userEmail: true,
          userName: true,
          createdAt: true,
        },
      }),
      prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          emailVerified: true,
          role: true,
          profileComplete: true,
          isBlocked: true,
          image: true,
          member: {
            select: {
              city: true,
              country: true,
              gender: true,
              dateOfBirth: true,
              created: true,
            },
          },
        },
        orderBy: { email: 'asc' },
      }),
    ]);

    // Compute total call durations and per-user stats
    let totalVirtualCallSeconds = 0;
    let totalRealCallSeconds = 0;
    const personaCallMap: Record<string, number> = {};
    const userCallMinutesMap: Record<string, number> = {};
    const userCallCountMap: Record<string, number> = {};
    const userLastActiveMap: Record<string, string> = {};

    for (const ca of callActivities) {
      const dur = ca.durationSec || 0;
      const uIdentifier = ca.userEmail || ca.userId || ca.userName || 'Anonymous';
      
      if (ca.category === 'virtual_dating') {
        totalVirtualCallSeconds += dur;
        if (ca.targetName) {
          personaCallMap[ca.targetName] = (personaCallMap[ca.targetName] || 0) + dur;
        }
        userCallMinutesMap[uIdentifier] = (userCallMinutesMap[uIdentifier] || 0) + dur;
        userCallCountMap[uIdentifier] = (userCallCountMap[uIdentifier] || 0) + 1;
      } else if (ca.category === 'real_dating') {
        totalRealCallSeconds += dur;
        userCallMinutesMap[uIdentifier] = (userCallMinutesMap[uIdentifier] || 0) + dur;
        userCallCountMap[uIdentifier] = (userCallCountMap[uIdentifier] || 0) + 1;
      }
    }

    for (const act of recentActivities) {
      const uKey = act.userEmail || act.userId || '';
      if (uKey && !userLastActiveMap[uKey]) {
        userLastActiveMap[uKey] = act.createdAt.toISOString();
      }
    }

    const totalVirtualCallMinutes = Math.round(totalVirtualCallSeconds / 60);
    const totalRealCallMinutes = Math.round(totalRealCallSeconds / 60);

    // Format rich user rows with usage minutes and call counts
    const enrichedUsers = usersList.map((u) => {
      const uKey = u.email || u.id;
      const callSeconds = userCallMinutesMap[uKey] || userCallMinutesMap[u.email || ''] || 0;
      const callCount = userCallCountMap[uKey] || userCallCountMap[u.email || ''] || 0;
      const lastActive = userLastActiveMap[uKey] || userLastActiveMap[u.email || ''] || null;

      let age: number | null = null;
      if (u.member?.dateOfBirth) {
        const diff = Date.now() - new Date(u.member.dateOfBirth).getTime();
        age = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
      }

      return {
        id: u.id,
        name: u.name || '—',
        email: u.email || '—',
        emailVerified: !!u.emailVerified,
        role: u.role,
        profileComplete: u.profileComplete,
        isBlocked: u.isBlocked,
        image: u.image,
        city: u.member?.city || '—',
        country: u.member?.country || '—',
        gender: u.member?.gender || '—',
        age,
        totalCallMinutes: Math.round(callSeconds / 60),
        totalCallCount: callCount,
        lastActive,
      };
    });

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
        topUsersByMinutes: Object.entries(userCallMinutesMap)
          .map(([user, sec]) => ({ user, minutes: Math.round(sec / 60) }))
          .sort((a, b) => b.minutes - a.minutes)
          .slice(0, 10),
      },
      users: enrichedUsers,
      recentActivities,
    });
  } catch (error: any) {
    console.error('[📊 ADMIN ANALYTICS ERROR]', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch analytics' }, { status: 500 });
  }
}
