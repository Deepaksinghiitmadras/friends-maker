import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/groups — fetch groups
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const currentUserId = session?.user?.id;

    const groups = await prisma.chatGroup.findMany({
      where: currentUserId
        ? {
            OR: [
              { isPublic: true },
              { members: { some: { userId: currentUserId } } },
            ],
          }
        : { isPublic: true },
      include: {
        members: {
          select: {
            userId: true,
            userName: true,
            userImage: true,
            role: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const enrichedGroups = groups.map((g) => {
      const isMember = currentUserId ? g.members.some((m) => m.userId === currentUserId) : false;
      const lastMessage = g.messages[0] || null;
      return {
        id: g.id,
        name: g.name,
        description: g.description,
        image: g.image,
        createdById: g.createdById,
        isPublic: g.isPublic,
        memberCount: g.members.length,
        isMember,
        lastMessage: lastMessage
          ? {
              text: lastMessage.text,
              senderName: lastMessage.senderName,
              createdAt: lastMessage.createdAt,
            }
          : null,
        members: g.members,
      };
    });

    return NextResponse.json({ success: true, groups: enrichedGroups });
  } catch (error: any) {
    console.error('[GROUPS GET ERROR]', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch groups' }, { status: 500 });
  }
}

// POST /api/groups — create a new group
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'You must be logged in to create a group' }, { status: 401 });
    }

    const { name, description, image, isPublic = true } = await req.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Group name is required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { member: true },
    });

    const userName = user?.member?.name || user?.name || session.user.name || 'Member';
    const userImage = user?.member?.image || user?.image || session.user.image || null;

    const newGroup = await prisma.chatGroup.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        image: image?.trim() || null,
        createdById: session.user.id,
        isPublic,
        members: {
          create: {
            userId: session.user.id,
            userName,
            userImage,
            role: 'ADMIN',
          },
        },
      },
      include: {
        members: true,
      },
    });

    await prisma.groupMessage.create({
      data: {
        groupId: newGroup.id,
        senderId: session.user.id,
        senderName: userName,
        senderImage: userImage,
        text: `🎉 Welcome to ${newGroup.name}! Start chatting or tap Video Call to hang out together.`,
      },
    });

    return NextResponse.json({ success: true, group: newGroup });
  } catch (error: any) {
    console.error('[GROUPS CREATE ERROR]', error);
    return NextResponse.json({ error: error.message || 'Failed to create group' }, { status: 500 });
  }
}
