import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { cloudinary } from '@/lib/cloudinary';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const personaId = (formData.get('personaId') as string) || `voice_${Date.now()}`;

    if (!file) {
      return NextResponse.json({ error: 'Audio file is required' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || 'audio/mpeg';
    const audioDataUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;

    let audioUrl = audioDataUrl;

    // Try Cloudinary audio upload if available
    const hasCloudinary =
      process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME &&
      process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET;

    if (hasCloudinary) {
      try {
        const uploadResult = await cloudinary.v2.uploader.upload(audioDataUrl, {
          resource_type: 'video', // Cloudinary handles audio files under video resource_type
          folder: 'truefriends/voices',
          public_id: `${personaId}_${Date.now()}`,
        });

        if (uploadResult && uploadResult.secure_url) {
          audioUrl = uploadResult.secure_url;
          console.log(`[🎙️ VOICE UPLOAD] Uploaded voice sample to Cloudinary: ${audioUrl}`);
        }
      } catch (cloudErr: any) {
        console.warn(`[🎙️ VOICE UPLOAD WARNING] Cloudinary failed, using Data URL:`, cloudErr.message);
      }
    }

    return NextResponse.json({
      success: true,
      audioUrl,
      sizeBytes: buffer.length,
      fileName: file.name,
    });
  } catch (error: any) {
    console.error('[🎙️ VOICE UPLOAD ERROR]', error);
    return NextResponse.json({ error: error.message || 'Failed to upload voice sample' }, { status: 500 });
  }
}
