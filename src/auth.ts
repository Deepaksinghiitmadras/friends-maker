import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import authConfig from "./auth.config"
import Credentials from "next-auth/providers/credentials"
import { loginSchema } from './lib/schemas/LoginSchema'
import { getUserByEmail } from './app/actions/userQueries'
import { compare } from 'bcryptjs'

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

                    const user = await getUserByEmail(email);

                    if (!user || !user.passwordHash || !(await compare(password, user.passwordHash))) return null;

                    return user;
                }

                return null;
            }
        })
    ]
})