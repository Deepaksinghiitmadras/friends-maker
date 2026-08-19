import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { cloudinary } from '@/lib/cloudinary';

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, personaId } = await req.json();

    if (!imageBase64 || !personaId) {
      return NextResponse.json(
        { error: 'imageBase64 and personaId are required' },
        { status: 400 }
      );
    }

    let publicPath = '';
    let sizeBytes = 0;

    // 1. First priority: Upload to Cloudinary (Works globally and on Vercel serverless without filesystem restrictions)
    const hasCloudinary =
      process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME &&
      process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET;

    if (hasCloudinary) {
      try {
        console.log(`[📸 CLOUDINARY UPLOAD] Uploading portrait for companion "${personaId}"...`);
        const uploadResult = await cloudinary.v2.uploader.upload(imageBase64, {
          folder: 'truefriends/companions',
          public_id: `${personaId}_${Date.now()}`,
          transformation: [{ width: 800, height: 800, crop: 'limit', quality: 'auto' }],
        });

        if (uploadResult && uploadResult.secure_url) {
          publicPath = uploadResult.secure_url;
          sizeBytes = uploadResult.bytes || 0;
          console.log(`[📸 CLOUDINARY SUCCESS] Image uploaded: ${publicPath}`);

          return NextResponse.json({
            success: true,
            publicPath,
            sizeBytes,
          });
        }
      } catch (cloudErr: any) {
        console.warn(`[📸 CLOUDINARY WARNING] Cloudinary upload failed, checking local write:`, cloudErr.message);
      }
    }

    // 2. Local filesystem fallback (for local development)
    try {
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const customImagesDir = path.join(process.cwd(), 'public', 'images', 'custom');
      if (!fs.existsSync(customImagesDir)) {
        fs.mkdirSync(customImagesDir, { recursive: true });
      }

      const fileName = `${personaId}.jpg`;
      const filePath = path.join(customImagesDir, fileName);
      fs.writeFileSync(filePath, buffer);

      publicPath = `/images/custom/${fileName}`;
      sizeBytes = buffer.length;

      console.log(`[📸 LOCAL IMAGE UPLOAD] Saved "${fileName}" (${sizeBytes} bytes) → ${filePath}`);

      return NextResponse.json({
        success: true,
        publicPath,
        sizeBytes,
      });
    } catch (fsErr: any) {
      // If local filesystem is read-only (like Vercel) and Cloudinary wasn't configured, return the data URI directly as fallback
      console.warn(`[📸 LOCAL FS WARNING] Local FS write failed (${fsErr.message}). Using data URL.`);
      return NextResponse.json({
        success: true,
        publicPath: imageBase64,
        sizeBytes: imageBase64.length,
      });
    }
  } catch (error: any) {
    console.error('[📸 IMAGE UPLOAD ERROR]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to upload image' },
      { status: 500 }
    );
  }
}
