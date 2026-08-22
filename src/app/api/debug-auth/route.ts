export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const results: Record<string, any> = {};

  // 1. Env vars
  results.envVars = {
    AUTH_SECRET: !!process.env.AUTH_SECRET ? `set (length=${process.env.AUTH_SECRET.length})` : 'MISSING',
    AUTH_URL: process.env.AUTH_URL || 'MISSING',
    DATABASE_URL: !!process.env.DATABASE_URL ? `set (starts=${process.env.DATABASE_URL.slice(0, 30)}...)` : 'MISSING',
    ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'NOT SET',
    ADMIN_PASSWORD: !!process.env.ADMIN_PASSWORD ? `set (length=${process.env.ADMIN_PASSWORD.length})` : 'NOT SET (admin fast path disabled)',
    NODEMAILER_EMAIL: process.env.NODEMAILER_EMAIL || 'NOT SET',
    NODE_ENV: process.env.NODE_ENV,
  };

  // 2. DB connection
  try {
    const count = await prisma.user.count();
    results.db = { connected: true, userCount: count };
  } catch (err: any) {
    results.db = { connected: false, error: err?.message };
  }

  // 3. Check a specific user by email (pass ?email=... in query string)
  const checkEmail = req.nextUrl.searchParams.get('email');
  if (checkEmail) {
    try {
      const user = await prisma.user.findFirst({
        where: { email: { equals: checkEmail.toLowerCase().trim(), mode: 'insensitive' } },
        select: {
          id: true,
          email: true,
          emailVerified: true,
          role: true,
          profileComplete: true,
          passwordHash: true,
        }
      });
      results.userCheck = user ? {
        found: true,
        email: user.email,
        emailVerified: !!user.emailVerified,
        role: user.role,
        profileComplete: user.profileComplete,
        hasPasswordHash: !!user.passwordHash,
        // Show first 7 chars of hash so we can verify it's bcrypt ($2b$...)
        passwordHashPrefix: user.passwordHash ? user.passwordHash.slice(0, 7) : null,
      } : { found: false };
    } catch (err: any) {
      results.userCheck = { error: err?.message };
    }
  } else {
    results.hint = 'Add ?email=your@email.com to check a specific user\'s auth state';
  }

  return NextResponse.json(results, { status: 200 });
}
