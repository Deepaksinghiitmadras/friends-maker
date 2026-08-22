import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import authConfig from "./auth.config"
import Credentials from "next-auth/providers/credentials"
import { loginSchema } from './lib/schemas/LoginSchema'
import { compare, hash } from 'bcryptjs'

export const { auth, handlers, signIn, signOut } = NextAuth({
    ...authConfig,
    adapter: PrismaAdapter(prisma),
    session: { strategy: "jwt" },
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "t1oL8RX2YzU0ZjHhzZXZGw9obVyepmbHx1uPDj0xApqB",
    trustHost: true,
    providers: [
        ...authConfig.providers,
        Credentials({
            name: 'credentials',
            async authorize(creds) {
                try {
                    const validated = loginSchema.safeParse(creds);

                    if (!validated.success) {
                        console.log('[AUTHORIZE] Validation failed:', JSON.stringify(validated.error.flatten()));
                        return null;
                    }

                    const { email, password } = validated.data;
                    const normalizedEmail = email.toLowerCase().trim();

                    console.log('[AUTHORIZE] Login attempt for:', normalizedEmail);

                    // --- Admin fast path ---
                    const envAdminEmail = (process.env.ADMIN_EMAIL || process.env.NODEMAILER_EMAIL || 'admin@test.com').toLowerCase().trim();
                    const envAdminPassword = process.env.ADMIN_PASSWORD || '';

                    console.log('[AUTHORIZE] Admin email configured:', envAdminEmail);
                    console.log('[AUTHORIZE] ADMIN_PASSWORD set:', !!process.env.ADMIN_PASSWORD);

                    if (envAdminPassword && normalizedEmail === envAdminEmail && password === envAdminPassword) {
                        console.log('[AUTHORIZE] Admin path: matched, upserting admin user');
                        const passwordHash = await hash(password, 10);
                        const adminUser = await prisma.user.upsert({
                            where: { email: envAdminEmail },
                            update: {
                                role: 'ADMIN',
                                passwordHash,
                                profileComplete: true,
                                emailVerified: new Date(),
                            },
                            create: {
                                email: envAdminEmail,
                                name: 'Admin',
                                role: 'ADMIN',
                                passwordHash,
                                profileComplete: true,
                                emailVerified: new Date(),
                            },
                        });
                        console.log('[AUTHORIZE] Admin login success, id:', adminUser.id);
                        return adminUser;
                    } else if (normalizedEmail === envAdminEmail) {
                        console.log('[AUTHORIZE] Admin email matched but ADMIN_PASSWORD not set or wrong password — falling through to DB check');
                    }

                    // --- Standard user check (case-insensitive email) ---
                    const user = await prisma.user.findFirst({
                        where: {
                            email: {
                                equals: normalizedEmail,
                                mode: 'insensitive'
                            }
                        }
                    });

                    console.log('[AUTHORIZE] DB user found:', !!user);
                    if (!user) {
                        console.log('[AUTHORIZE] FAIL — no user in DB with email:', normalizedEmail);
                        return null;
                    }

                    console.log('[AUTHORIZE] User has passwordHash:', !!user.passwordHash);
                    if (!user.passwordHash) {
                        console.log('[AUTHORIZE] FAIL — user has no passwordHash (registered via OAuth only)');
                        return null;
                    }

                    const passwordMatch = await compare(password, user.passwordHash);
                    console.log('[AUTHORIZE] Password match:', passwordMatch);
                    if (!passwordMatch) {
                        console.log('[AUTHORIZE] FAIL — password mismatch');
                        return null;
                    }

                    console.log('[AUTHORIZE] SUCCESS for:', normalizedEmail, 'role:', user.role);
                    return user;

                } catch (error: any) {
                    console.error('[AUTHORIZE] Unexpected error:', error?.message);
                    return null;
                }
            }
        })
    ]
})