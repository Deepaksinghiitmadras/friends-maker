import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { updateCustomPersona, loadCustomPersonasAsync } from '@/lib/customPersonasStore';
import { sendUserCompanionReadyEmail } from '@/lib/mail';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const personaId = formData.get('personaId') as string;
    const videoType = formData.get('videoType') as string; // 'idle' | 'speaking'
    const file = formData.get('file') as File | null;
    const markReady = formData.get('markReady') === 'true';

    if (!personaId || !videoType || !file) {
      return NextResponse.json(
        { error: 'personaId, videoType, and file are required' },
        { status: 400 }
      );
    }

    if (videoType !== 'idle' && videoType !== 'speaking') {
      return NextResponse.json(
        { error: 'videoType must be either "idle" or "speaking"' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const videoDataUrl = `data:video/mp4;base64,${buffer.toString('base64')}`;
    let videoUrl = videoDataUrl;

    // 1. Try local filesystem if writable (local dev)
    try {
      const videoDir = path.join(process.cwd(), 'public', 'videos', personaId);
      if (!fs.existsSync(videoDir)) {
        fs.mkdirSync(videoDir, { recursive: true });
      }
      const targetFile = path.join(videoDir, `${videoType}.mp4`);
      fs.writeFileSync(targetFile, buffer);
      videoUrl = `/videos/${personaId}/${videoType}.mp4?t=${Date.now()}`;
      console.log(`[🎬 ADMIN VIDEO UPLOAD] Saved ${videoType}.mp4 (${buffer.length} bytes) to local disk for "${personaId}"`);
    } catch (fsErr: any) {
      console.log(`[🎬 ADMIN VIDEO UPLOAD] Local disk read-only (Vercel). Storing video in database directly.`);
    }

    // 2. Fetch existing persona from database
    const existingPersona = await prisma.customPersona.findUnique({
      where: { id: personaId },
    });

    const currentClips: any = existingPersona?.videoClips || {
      idle: `/videos/${personaId}/idle.mp4`,
      speaking: `/videos/${personaId}/speaking.mp4`,
    };

    currentClips[videoType] = videoUrl;

    const hasIdle = currentClips.idle && (currentClips.idle.startsWith('data:') || currentClips.idle.includes('/videos/'));
    const hasSpeaking = currentClips.speaking && (currentClips.speaking.startsWith('data:') || currentClips.speaking.includes('/videos/'));
    const isNowReady = markReady || (hasIdle && hasSpeaking);

    await updateCustomPersona(personaId, {
      videoClips: currentClips,
      status: isNowReady ? 'ready' : (existingPersona?.status as any) || 'generating',
    });

    console.log(`[🎬 ADMIN VIDEO UPLOAD] Updated videoClips for "${personaId}". Ready: ${isNowReady}`);

    if (isNowReady) {
      // 📧 Send User Notification Email that companion is ready for video call
      try {
        const personas = await loadCustomPersonasAsync();
        const persona = personas.find((p) => p.id === personaId);
        if (persona && persona.userEmail && !persona.userEmail.includes('anonymous')) {
          sendUserCompanionReadyEmail({
            userEmail: persona.userEmail,
            userName: persona.userName || 'Valued Member',
            companionName: persona.name,
            companionId: persona.id,
          }).catch((err) => console.error('[📧 USER READY EMAIL ERROR]', err));
        }
      } catch (mailErr) {
        console.error('[📧 MAIL ERROR]', mailErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully uploaded ${videoType}.mp4 (${Math.round(buffer.length / 1024)} KB)`,
      videoUrl: videoUrl.startsWith('data:') ? 'Saved in Database' : videoUrl,
      isReady: isNowReady,
    });
  } catch (error: any) {
    console.error('[🎬 ADMIN VIDEO UPLOAD ERROR]', error);
    return NextResponse.json({ error: error.message || 'Failed to upload video' }, { status: 500 });
  }
}
