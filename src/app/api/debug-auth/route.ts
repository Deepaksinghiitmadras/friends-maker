export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const results: Record<string, any> = {};

  // 1. Check critical env vars (values redacted, only presence)
  results.envVars = {
    AUTH_SECRET: !!process.env.AUTH_SECRET ? `set (length=${process.env.AUTH_SECRET.length})` : 'MISSING',
    AUTH_URL: process.env.AUTH_URL || 'MISSING',
    DATABASE_URL: !!process.env.DATABASE_URL ? `set (starts=${process.env.DATABASE_URL.slice(0, 30)}...)` : 'MISSING',
    NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET ? 'set' : 'not set',
    NODE_ENV: process.env.NODE_ENV,
  };

  // 2. Test Prisma DB connection
  try {
    const count = await prisma.user.count();
    results.db = { connected: true, userCount: count };
  } catch (err: any) {
    results.db = {
      connected: false,
      error: err?.message,
      code: err?.code,
    };
  } finally {
    try { await prisma.$disconnect(); } catch (_) {}
  }

  // 3. Test a sample user lookup
  try {
    const user = await prisma.user.findFirst({ select: { id: true, email: true, emailVerified: true } });
    results.sampleUser = user
      ? { found: true, emailVerified: !!user.emailVerified }
      : { found: false };
  } catch (err: any) {
    results.sampleUser = { error: err?.message };
  }

  return NextResponse.json(results, { status: 200 });
}
