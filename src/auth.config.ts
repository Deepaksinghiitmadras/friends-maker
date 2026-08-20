import Google from "next-auth/providers/google"
import Github from "next-auth/providers/github"
import type { NextAuthConfig } from "next-auth"

export default {
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "t1oL8RX2YzU0ZjHhzZXZGw9obVyepmbHx1uPDj0xApqB",
    trustHost: true,
    callbacks: {
        async jwt({ user, token }) {
            if (user) {
                token.profileComplete = (user as any).profileComplete;
                token.role = (user as any).role;
            }
            return token;
        },
        async session({ session, token }) {
            if (token.sub && session.user) {
                session.user.id = token.sub;
                session.user.profileComplete = token.profileComplete as boolean;
                session.user.role = token.role as any;
            }
            return session;
        }
    },
    providers: [
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET
        }),
        Github({
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET
        }),
    ],
} satisfies NextAuthConfig