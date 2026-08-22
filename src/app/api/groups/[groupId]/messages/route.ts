import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/groups/[groupId]/messages — fetch group messages
export async function GET(
  req: NextRequest,
  { params }: { params: { groupId: string } }
) {
  try {
    const { groupId } = params;

    const messages = await prisma.groupMessage.findMany({
      where: { groupId },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });

    return NextResponse.json({ success: true, messages });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch messages' }, { status: 500 });
  }
}

// POST /api/groups/[groupId]/messages — send message to group
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
    const { text, mediaUrl } = await req.json();

    if (!text || !text.trim()) {
      return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 });
    }

    let member = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId: session.user.id,
        },
      },
    });

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { member: true },
    });

    const senderName = user?.member?.name || user?.name || session.user.name || 'Member';
    const senderImage = user?.member?.image || user?.image || session.user.image || null;

    if (!member) {
      member = await prisma.groupMember.create({
        data: {
          groupId,
          userId: session.user.id,
          userName: senderName,
          userImage: senderImage,
          role: 'MEMBER',
        },
      });
    }

    const message = await prisma.groupMessage.create({
      data: {
        groupId,
        senderId: session.user.id,
        senderName,
        senderImage,
        text: text.trim(),
        mediaUrl: mediaUrl || null,
      },
    });

    await prisma.chatGroup.update({
      where: { id: groupId },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({ success: true, message });
  } catch (error: any) {
    console.error('[SEND GROUP MESSAGE ERROR]', error);
    return NextResponse.json({ error: error.message || 'Failed to send message' }, { status: 500 });
  }
}
