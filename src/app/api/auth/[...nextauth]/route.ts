import { handlers } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

export const GET = handlers.GET;

// @auth/core returns a Response with a ReadableStream body — piping it through
// Next.js serverless on Vercel causes FUNCTION_INVOCATION_FAILED even when the
// handler itself succeeds. Fix: materialize the body to a string first, then
// rebuild a concrete NextResponse.
//
// CRITICAL: `set-cookie` is a multi-value header. Using headers.set() for it
// overwrites every cookie with the last one — dropping the session token.
// Must use headers.append() for `set-cookie` so all cookies are forwarded.
export async function POST(req: NextRequest) {
  try {
    console.log('[AUTH] POST /api/auth/callback/credentials called');

    const authResponse = await handlers.POST(req);

    // Materialize the body to avoid Vercel serverless streaming failures
    const body = await authResponse.text();
    const status = authResponse.status;

    console.log('[AUTH] status:', status);
    console.log('[AUTH] content-type:', authResponse.headers.get('content-type'));
    console.log('[AUTH] body-preview:', body.slice(0, 300));

    // Rebuild response headers.
    // IMPORTANT: set-cookie must be appended (not set) to preserve ALL cookies.
    // Using headers.set() for set-cookie causes subsequent cookies to overwrite
    // the session token, leaving the client without a valid auth cookie.
    const headers = new Headers();
    authResponse.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'transfer-encoding') return; // Next.js manages this
      if (key.toLowerCase() === 'set-cookie') {
        headers.append(key, value); // append so multiple cookies are all forwarded
      } else {
        headers.set(key, value);
      }
    });

    console.log('[AUTH] set-cookie headers forwarded:', headers.getSetCookie?.()?.length ?? 'N/A');

    return new NextResponse(body, { status, headers });
  } catch (error: any) {
    console.error('[AUTH CRASH]', {
      message: error?.message,
      stack: error?.stack?.slice(0, 500),
    });
    return NextResponse.json(
      { error: 'auth-handler-crash', detail: error?.message },
      { status: 500 }
    );
  }
}