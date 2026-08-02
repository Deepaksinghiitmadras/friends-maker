'use server';

import { prisma } from '@/lib/prisma';

// Isolated database-only helpers that are safe to import from auth.config.ts
// (no nodemailer or other Node.js-only imports)
export async function getUserByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
}

export async function getUserById(id: string) {
    return prisma.user.findUnique({ where: { id } });
}
