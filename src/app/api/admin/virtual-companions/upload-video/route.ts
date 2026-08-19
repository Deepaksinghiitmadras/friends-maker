import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { updateCustomPersona, loadCustomPersonasAsync } from '@/lib/customPersonasStore';
import { sendUserCompanionReadyEmail } from '@/lib/mail';
import { prisma } from '@/lib/prisma';
import { cloudinary } from '@/lib/cloudinary';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const personaId = formData.get('personaId') as string;
    const videoType = formData.get('videoType') as string; // 'idle' | 'speaking' | 'coffee' | 'kiss' | ...
    const file = formData.get('file') as File | null;
    const markReady = formData.get('markReady') === 'true';

    if (!personaId || !videoType || !file) {
      return NextResponse.json(
        { error: 'personaId, videoType, and file are required' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const videoDataUrl = `data:video/mp4;base64,${buffer.toString('base64')}`;
    let videoUrl = videoDataUrl;

    // 1. Try Cloudinary video upload for high-performance CDN streaming
    const hasCloudinary =
      process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME &&
      process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET;

    if (hasCloudinary) {
      try {
        console.log(`[🎬 VIDEO UPLOAD] Uploading ${videoType} video to Cloudinary for "${personaId}"...`);
        const uploadResult = await cloudinary.v2.uploader.upload(videoDataUrl, {
          resource_type: 'video',
          folder: `truefriends/videos/${personaId}`,
          public_id: `${videoType}_${Date.now()}`,
          overwrite: true,
        });

        if (uploadResult && uploadResult.secure_url) {
          videoUrl = uploadResult.secure_url;
          console.log(`[🎬 VIDEO UPLOAD SUCCESS] Cloudinary URL: ${videoUrl}`);
        }
      } catch (cloudErr: any) {
        console.warn(`[🎬 VIDEO UPLOAD WARNING] Cloudinary failed, falling back to local/DB:`, cloudErr.message);
      }
    }

    // 2. Try local disk write in development
    try {
      const videoDir = path.join(process.cwd(), 'public', 'videos', personaId);
      if (!fs.existsSync(videoDir)) {
        fs.mkdirSync(videoDir, { recursive: true });
      }
      const targetFile = path.join(videoDir, `${videoType}.mp4`);
      fs.writeFileSync(targetFile, buffer);
      if (!hasCloudinary) {
        videoUrl = `/videos/${personaId}/${videoType}.mp4?t=${Date.now()}`;
      }
      console.log(`[🎬 ADMIN VIDEO UPLOAD] Saved ${videoType}.mp4 (${buffer.length} bytes) on local disk for "${personaId}"`);
    } catch (_) {}

    // 3. Fetch existing persona from database
    const existingPersona = await prisma.customPersona.findUnique({
      where: { id: personaId },
    });

    const currentClips: any = (existingPersona?.videoClips as any) || {
      idle: `/videos/${personaId}/idle.mp4`,
      speaking: `/videos/${personaId}/speaking.mp4`,
    };

    currentClips[videoType] = videoUrl;

    const hasIdle = currentClips.idle && (currentClips.idle.startsWith('http') || currentClips.idle.startsWith('data:') || currentClips.idle.includes('/videos/'));
    const hasSpeaking = currentClips.speaking && (currentClips.speaking.startsWith('http') || currentClips.speaking.startsWith('data:') || currentClips.speaking.includes('/videos/'));
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
            companionId: personaId,
          }).catch((e) => console.warn('Ready email trigger note:', e));
        }
      } catch (mailErr) {
        console.warn('[🎬 ADMIN VIDEO UPLOAD] Mail trigger error:', mailErr);
      }
    }

    return NextResponse.json({
      success: true,
      videoType,
      videoUrl,
      isNowReady,
      message: `Successfully uploaded ${videoType}.mp4 for ${personaId}`,
    });
  } catch (error: any) {
    console.error('[🎬 ADMIN VIDEO UPLOAD ERROR]', error);
    return NextResponse.json(
      { error: error.message || 'Video upload failed' },
      { status: 500 }
    );
  }
}
