import { NextResponse } from 'next/server';
import NextAuth from 'next-auth';
import authConfig from './auth.config';
import { authRoutes, publicRoutes } from './routes';

const { auth } = NextAuth(authConfig);

export default auth((req) => {
    const { nextUrl } = req;
    const isLoggedIn = !!req.auth;

    const isPublic = publicRoutes.includes(nextUrl.pathname) || nextUrl.pathname.startsWith('/virtual');
    const isAuthRoute = authRoutes.includes(nextUrl.pathname);
    const isProfileComplete = (req.auth?.user as any)?.profileComplete;
    const isAdmin = (req.auth?.user as any)?.role === 'ADMIN';
    const isAdminRoute = nextUrl.pathname.startsWith('/admin');

    if (isAdminRoute) {
        if (!isLoggedIn) {
            return NextResponse.redirect(new URL(`/login?callbackUrl=${encodeURIComponent(nextUrl.pathname)}`, nextUrl));
        }
        if (!isAdmin) {
            return NextResponse.redirect(new URL('/', nextUrl));
        }
        return NextResponse.next();
    }

    if (isPublic || isAdmin) {
        return NextResponse.next();
    }

    if (isAuthRoute) {
        if (isLoggedIn) {
            if (isAdmin) {
                return NextResponse.redirect(new URL('/admin/virtual-companions', nextUrl));
            }
            return NextResponse.redirect(new URL('/members', nextUrl));
        }
        return NextResponse.next();
    }

    if (!isPublic && !isLoggedIn) {
        return NextResponse.redirect(new URL('/login', nextUrl))
    }

    if (isLoggedIn && !isProfileComplete && nextUrl.pathname !== '/complete-profile') {
        return NextResponse.redirect(new URL('/complete-profile', nextUrl));
    }

    return NextResponse.next();
})

/**
 * This is a regular expression that will match any URL path 
 * that does not start with /api, /_next/static, /_next/image, or favicon.ico.
 */
export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)']
}