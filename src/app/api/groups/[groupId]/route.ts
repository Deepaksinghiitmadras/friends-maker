import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/groups/[groupId] — get group details
export async function GET(
  req: NextRequest,
  { params }: { params: { groupId: string } }
) {
  try {
    const session = await auth();
    const currentUserId = session?.user?.id;
    const { groupId } = params;

    const group = await prisma.chatGroup.findUnique({
      where: { id: groupId },
      include: {
        members: {
          orderBy: { joinedAt: 'asc' },
        },
      },
    });

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    const isMember = currentUserId ? group.members.some((m) => m.userId === currentUserId) : false;
    const isAdmin = currentUserId ? group.members.some((m) => m.userId === currentUserId && m.role === 'ADMIN') : false;

    return NextResponse.json({
      success: true,
      group: {
        ...group,
        isMember,
        isAdmin,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch group' }, { status: 500 });
  }
}
