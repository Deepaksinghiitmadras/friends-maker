import { NextRequest, NextResponse } from 'next/server';
import { getMessageThread } from '@/app/actions/messageActions';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const recipientId = searchParams.get('recipientId');

    if (!recipientId) {
      return NextResponse.json({ error: 'recipientId is required' }, { status: 400 });
    }

    const data = await getMessageThread(recipientId);
    return NextResponse.json({ success: true, ...data });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to get messages' }, { status: 500 });
  }
}
