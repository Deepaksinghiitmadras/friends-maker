import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, personaId } = await req.json();

    if (!imageBase64 || !personaId) {
      return NextResponse.json(
        { error: 'imageBase64 and personaId are required' },
        { status: 400 }
      );
    }

    // Strip data URL prefix if present (e.g., "data:image/jpeg;base64,...")
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Save to public/images/custom/{personaId}.jpg
    const customImagesDir = path.join(process.cwd(), 'public', 'images', 'custom');
    if (!fs.existsSync(customImagesDir)) {
      fs.mkdirSync(customImagesDir, { recursive: true });
    }

    const fileName = `${personaId}.jpg`;
    const filePath = path.join(customImagesDir, fileName);
    fs.writeFileSync(filePath, buffer);

    const publicPath = `/images/custom/${fileName}`;
    const absolutePath = filePath;

    console.log(`[📸 IMAGE UPLOAD] Saved "${fileName}" (${buffer.length} bytes) → ${absolutePath}`);

    return NextResponse.json({
      success: true,
      publicPath,
      absolutePath,
      sizeBytes: buffer.length,
    });
  } catch (error: any) {
    console.error('[📸 IMAGE UPLOAD ERROR]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to upload image' },
      { status: 500 }
    );
  }
}
