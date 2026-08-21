import { handlers } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

export const GET = handlers.GET;

// Wrap POST to capture the actual crash reason from Vercel function logs
export async function POST(req: NextRequest) {
  try {
    console.log('[AUTH] POST /api/auth/callback/credentials called');
    console.log('[AUTH] AUTH_URL:', process.env.AUTH_URL);
    console.log('[AUTH] AUTH_SECRET set:', !!process.env.AUTH_SECRET);
    console.log('[AUTH] DATABASE_URL set:', !!process.env.DATABASE_URL);
    const response = await handlers.POST(req);
    console.log('[AUTH] Response status:', response.status);
    return response;
  } catch (error: any) {
    console.error('[AUTH CRASH]', {
      message: error?.message,
      type: error?.type,
      cause: error?.cause?.message,
      stack: error?.stack?.slice(0, 800),
    });
    return NextResponse.json(
      { error: 'Auth handler crashed', detail: error?.message },
      { status: 500 }
    );
  }
}