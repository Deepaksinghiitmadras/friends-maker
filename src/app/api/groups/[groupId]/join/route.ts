import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// POST /api/groups/[groupId]/join — join or leave group
export async function POST(
  req: NextRequest,
  { params }: { params: { groupId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { groupId } = params;
    const { action } = await req.json();

    const existingMember = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId: session.user.id,
        },
      },
    });

    if (action === 'leave') {
      if (existingMember) {
        await prisma.groupMember.delete({
          where: { id: existingMember.id },
        });
      }
      return NextResponse.json({ success: true, isMember: false });
    } else {
      if (!existingMember) {
        const user = await prisma.user.findUnique({
          where: { id: session.user.id },
          include: { member: true },
        });
        const userName = user?.member?.name || user?.name || session.user.name || 'Member';
        const userImage = user?.member?.image || user?.image || session.user.image || null;

        await prisma.groupMember.create({
          data: {
            groupId,
            userId: session.user.id,
            userName,
            userImage,
            role: 'MEMBER',
          },
        });
      }
      return NextResponse.json({ success: true, isMember: true });
    }
  } catch (error: any) {
    console.error('[JOIN GROUP ERROR]', error);
    return NextResponse.json({ error: error.message || 'Failed to update group membership' }, { status: 500 });
  }
}
