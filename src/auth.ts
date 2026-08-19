import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import authConfig from "./auth.config"
import Credentials from "next-auth/providers/credentials"
import { loginSchema } from './lib/schemas/LoginSchema'
import { getUserByEmail } from './app/actions/userQueries'
import { compare, hash } from 'bcryptjs'

export const { auth, handlers, signIn, signOut } = NextAuth({
    ...authConfig,
    adapter: PrismaAdapter(prisma),
    session: { strategy: "jwt" },
    secret: process.env.AUTH_SECRET,
    providers: [
        ...authConfig.providers,
        Credentials({
            name: 'credentials',
            async authorize(creds) {
                const validated = loginSchema.safeParse(creds);

                if (validated.success) {
                    const { email, password } = validated.data;
                    const normalizedEmail = email.toLowerCase().trim();

                    // Check if credentials match dynamic ADMIN environment variables
                    const envAdminEmail = (process.env.ADMIN_EMAIL || 'admin@test.com').toLowerCase().trim();
                    const envAdminPassword = process.env.ADMIN_PASSWORD || 'password';

                    if (normalizedEmail === envAdminEmail && password === envAdminPassword) {
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
                        return adminUser;
                    }

                    // Standard user credentials check
                    const user = await getUserByEmail(email);

                    if (!user || !user.passwordHash || !(await compare(password, user.passwordHash))) return null;

                    return user;
                }

                return null;
            }
        })
    ]
})