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
    const base64Str = `data:${file.type};base64,${buffer.toString('base64')}`;

    const uploadResult = await cloudinary.v2.uploader.upload(base64Str, {
      folder: 'truefriends/members',
      transformation: [{ width: 800, height: 800, crop: 'limit', quality: 'auto' }],
    });

    if (!uploadResult || !uploadResult.secure_url) {
      throw new Error('Cloudinary upload failed');
    }

    // Add photo to member in database
    const member = await prisma.member.findUnique({
      where: { userId: session.user.id },
    });

    if (member) {
      const isFirstPhoto = !member.image;
      const newPhoto = await prisma.photo.create({
        data: {
          url: uploadResult.secure_url,
          publicId: uploadResult.public_id,
          memberId: member.id,
          isApproved: true, // auto approve user uploaded member photo
        },
      });

      if (isFirstPhoto) {
        await prisma.member.update({
          where: { id: member.id },
          data: { image: uploadResult.secure_url },
        });
        await prisma.user.update({
          where: { id: session.user.id },
          data: { image: uploadResult.secure_url },
        });
      }

      return NextResponse.json({
        success: true,
        photo: newPhoto,
        url: uploadResult.secure_url,
      });
    }

    return NextResponse.json({
      success: true,
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
    });
  } catch (error: any) {
    console.error('[📸 MEMBER PHOTO UPLOAD ERROR]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to upload photo' },
      { status: 500 }
    );
  }
}
