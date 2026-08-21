import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// CRITICAL: Always reuse the singleton across ALL environments.
// The old code excluded production from the global cache, meaning every serverless
// request created a NEW PrismaClient with its own connection pool and query event
// emitters. Those emitters fired AFTER the response was returned, crashing the
// function with Vercel's FUNCTION_INVOCATION_FAILED error.
export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    // Only emit query logs in development. In production, query event emitters
    // fire post-response and cause FUNCTION_INVOCATION_FAILED crashes on Vercel.
    log: process.env.NODE_ENV === 'development' ? ['query'] : [],
  });

// Always cache globally (the original code only did this in non-production — the bug)
if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = prisma;
}