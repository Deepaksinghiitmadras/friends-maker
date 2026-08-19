import { NextRequest, NextResponse } from 'next/server';
import { cloudinary } from '@/lib/cloudinary';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64Str = `data:${file.type || 'image/jpeg'};base64,${buffer.toString('base64')}`;

    let imageUrl = base64Str;
    let publicId: string | null = `photo_${Date.now()}`;

    // Try Cloudinary if available
    const hasCloudinary =
      process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME &&
      process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET;

    if (hasCloudinary) {
      try {
        const uploadResult = await cloudinary.v2.uploader.upload(base64Str, {
          folder: 'truefriends/members',
          transformation: [{ width: 800, height: 800, crop: 'limit', quality: 'auto' }],
        });

        if (uploadResult && uploadResult.secure_url) {
          imageUrl = uploadResult.secure_url;
          publicId = uploadResult.public_id;
        }
      } catch (cloudErr: any) {
        console.warn('[📸 CLOUDINARY UPLOAD WARNING] Cloudinary failed, falling back to direct DB storage:', cloudErr.message);
      }
    }

    // Save directly to PostgreSQL database via Prisma
    const member = await prisma.member.findUnique({
      where: { userId: session.user.id },
    });

    if (member) {
      const isFirstPhoto = !member.image;
      const newPhoto = await prisma.photo.create({
        data: {
          url: imageUrl,
          publicId: publicId,
          memberId: member.id,
          isApproved: true,
        },
      });

      if (isFirstPhoto) {
        await prisma.member.update({
          where: { id: member.id },
          data: { image: imageUrl },
        });
        await prisma.user.update({
          where: { id: session.user.id },
          data: { image: imageUrl },
        });
      }

      return NextResponse.json({
        success: true,
        photo: newPhoto,
        url: imageUrl,
      });
    }

    return NextResponse.json({
      success: true,
      url: imageUrl,
      publicId,
    });
  } catch (error: any) {
    console.error('[📸 MEMBER PHOTO UPLOAD ERROR]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to upload photo' },
      { status: 500 }
    );
  }
}
