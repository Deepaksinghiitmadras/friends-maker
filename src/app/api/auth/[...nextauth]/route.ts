import { handlers } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

export const GET = handlers.GET;

// @auth/core returns a Response with a ReadableStream body. In Vercel serverless,
// piping this stream through Next.js causes FUNCTION_INVOCATION_FAILED even when
// the function itself succeeds (status 200). Fix: materialize the body to a concrete
// string, then return a fresh NextResponse so Next.js has no streaming to manage.
export async function POST(req: NextRequest) {
  try {
    console.log('[AUTH] POST /api/auth/callback/credentials called');

    const authResponse = await handlers.POST(req);

    // Materialize body — avoids streaming failures on Vercel serverless
    const body = await authResponse.text();
    const status = authResponse.status;

    // Log details so we can see what NextAuth is actually returning
    console.log('[AUTH] status:', status);
    console.log('[AUTH] content-type:', authResponse.headers.get('content-type'));
    console.log('[AUTH] body-preview:', body.slice(0, 200));

    // Rebuild headers, forwarding set-cookie and other important headers
    const headers = new Headers();
    authResponse.headers.forEach((value, key) => {
      // skip transfer-encoding — Next.js manages this itself
      if (key.toLowerCase() !== 'transfer-encoding') {
        headers.set(key, value);
      }
    });

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