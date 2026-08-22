import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/admin/users — list all users (admin only)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        role: true,
        profileComplete: true,
        isBlocked: true,
        member: {
          select: {
            city: true,
            country: true,
            gender: true,
            dateOfBirth: true,
          }
        }
      },
      orderBy: { email: 'asc' },
    });

    return NextResponse.json({ users });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}

// PATCH /api/admin/users — block or unblock a user
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { userId, isBlocked } = await req.json();
    if (!userId || typeof isBlocked !== 'boolean') {
      return NextResponse.json({ error: 'Missing userId or isBlocked' }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { isBlocked },
      select: { id: true, email: true, isBlocked: true }
    });

    // Log admin action
    void prisma.userActivity.create({
      data: {
        userId: (session.user as any).id,
        userEmail: session.user.email,
        userName: session.user.name || 'Admin',
        category: 'admin',
        action: isBlocked ? 'user_blocked' : 'user_unblocked',
        targetId: userId,
        targetName: updated.email || undefined,
      }
    }).catch(() => { });

    return NextResponse.json({ success: true, user: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}

// DELETE /api/admin/users — permanently delete a user account
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { userId } = await req.json();
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });

    // Cascade: delete member, accounts, tokens, activities linked to this user
    await prisma.user.delete({ where: { id: userId } });

    // Log admin action
    void prisma.userActivity.create({
      data: {
        userId: (session.user as any).id,
        userEmail: session.user.email,
        userName: session.user.name || 'Admin',
        category: 'admin',
        action: 'user_deleted',
        targetId: userId,
        targetName: user?.email || undefined,
      }
    }).catch(() => { });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
