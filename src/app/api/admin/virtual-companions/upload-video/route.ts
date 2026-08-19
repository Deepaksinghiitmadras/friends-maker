import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { updateCustomPersonaStatus, loadCustomPersonasFromFile } from '@/lib/customPersonasStore';
import { sendUserCompanionReadyEmail } from '@/lib/mail';

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

    const videoDir = path.join(process.cwd(), 'public', 'videos', personaId);
    if (!fs.existsSync(videoDir)) {
      fs.mkdirSync(videoDir, { recursive: true });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const targetFile = path.join(videoDir, `${videoType}.mp4`);

    fs.writeFileSync(targetFile, buffer);
    console.log(`[🎬 ADMIN VIDEO UPLOAD] Saved ${videoType}.mp4 (${buffer.length} bytes) for "${personaId}"`);

    // Check if both idle and speaking exist
    const idleExists = fs.existsSync(path.join(videoDir, 'idle.mp4'));
    const speakExists = fs.existsSync(path.join(videoDir, 'speaking.mp4'));
    const isNowReady = markReady || (idleExists && speakExists);

    if (isNowReady) {
      updateCustomPersonaStatus(personaId, 'ready');
      console.log(`[🎬 ADMIN VIDEO UPLOAD] Marked "${personaId}" status as READY!`);

      // 📧 Send User Notification Email that companion is ready for video call
      try {
        const personas = loadCustomPersonasFromFile();
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
      videoUrl: `/videos/${personaId}/${videoType}.mp4?t=${Date.now()}`,
      isReady: isNowReady,
    });
  } catch (error: any) {
    console.error('[🎬 ADMIN VIDEO UPLOAD ERROR]', error);
    return NextResponse.json({ error: error.message || 'Failed to upload video' }, { status: 500 });
  }
}
