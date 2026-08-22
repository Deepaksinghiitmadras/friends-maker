import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getAllPersonasAsync } from '@/lib/customPersonasStore';
import { getPersonaById, VIRTUAL_PERSONAS } from '@/lib/virtualPersonas';
import { sendCompanionDailySelfieNoteEmail } from '@/lib/mail';

export const dynamic = 'force-dynamic';

// POST /api/admin/daily-selfies — automated broadcast of daily selfies to all users
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    // Allow admin session or cron authorization header
    const authHeader = req.headers.get('authorization');
    const isCron = authHeader === `Bearer ${process.env.CRON_SECRET || 'daily-cron'}`;
    const isAdmin = (session?.user as any)?.role === 'ADMIN';

    if (!isCron && !isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { noteType = 'morning' } = (await req.json().catch(() => ({}))) as { noteType?: 'morning' | 'night' | 'surprise' };

    // 1. Fetch all registered users with verified emails (who are not blocked)
    const users = await prisma.user.findMany({
      where: {
        email: { not: null },
        emailVerified: { not: null },
        isBlocked: false,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    if (!users || users.length === 0) {
      return NextResponse.json({ success: true, count: 0, message: 'No verified users found' });
    }

    // 2. Fetch all custom personas
    const allCustomPersonas = await getAllPersonasAsync();

    let dispatchedCount = 0;
    const results: any[] = [];

    // 3. Process each user
    for (let index = 0; index < users.length; index++) {
      const user = users[index];
      if (!user.email) continue;

      // Check if user has created their own companion
      const userCustomCompanion = allCustomPersonas.find((p) => p.userId === user.id);

      let selectedPersona = userCustomCompanion;

      // If user has not created any companion, alternate between Ananya Sharma and Elena Rostova
      if (!selectedPersona) {
        const defaultId = index % 2 === 0 ? 'ananya-sharma' : 'elena-rostova';
        selectedPersona = getPersonaById(defaultId) || VIRTUAL_PERSONAS[0];
      }

      if (!selectedPersona) continue;

      const userName = user.name || 'Friend';
      const isMan = selectedPersona.gender === 'man';

      // 4. Select selfie photo arbitrarily from referencePhotos or avatarImage
      let selfieUrl = selectedPersona.avatarImage;
      if (selectedPersona.referencePhotos && selectedPersona.referencePhotos.length > 0) {
        // Pick arbitrarily from the admin-uploaded selfie gallery
        const randomIndex = Math.floor(Math.random() * selectedPersona.referencePhotos.length);
        selfieUrl = selectedPersona.referencePhotos[randomIndex];
      }

      // 5. Generate personalized message
      let message = '';
      if (noteType === 'morning') {
        message = isMan
          ? `Good morning ${userName}! ☀️ Aaj subah ki taaza chai ke saath aapki yaad aayi. Umeed hai aapka din bohot energetic aur mast rahega. Have a wonderful day!`
          : `Good morning ${userName}! ☀️ Aaj subah aapse connect karne ka mann hua. Ek pyari si smile ke saath din shuru karo, sab bohot accha hoga ✨`;
      } else if (noteType === 'night') {
        message = isMan
          ? `Good night ${userName}! 🌙 Din bhar ki saari thakan bhool ke aaraam se sona. Kal ek nayi shuruaat karenge. Sweet dreams!`
          : `Good night ${userName}! 🌙 Pura din kaisa bhi raha ho, ab sukoon se aankhein band karo aur pyare sapne dekho. Shubh raatri! ✨`;
      } else {
        message = `Hey ${userName}! 📸 Bas aise hi aapka haal-chaal poochne ke liye ye selfie bheji. Aaj ka din kaisa chal raha hai?`;
      }

      // 6. Send Email
      try {
        await sendCompanionDailySelfieNoteEmail({
          userEmail: user.email,
          userName,
          companionName: selectedPersona.name,
          companionId: selectedPersona.id,
          noteType,
          message,
          selfieUrl,
        });

        // 7. Save Note record
        await prisma.dailyCompanionNote.create({
          data: {
            userId: user.id,
            userEmail: user.email,
            personaId: selectedPersona.id,
            personaName: selectedPersona.name,
            noteType,
            message,
            selfieUrl,
            sentEmail: true,
            sentWhatsapp: false,
          },
        });

        dispatchedCount++;
        results.push({ email: user.email, companion: selectedPersona.name, status: 'sent' });
      } catch (err: any) {
        console.error(`[DAILY SELFIE] Failed for ${user.email}:`, err?.message);
        results.push({ email: user.email, error: err?.message, status: 'failed' });
      }
    }

    return NextResponse.json({
      success: true,
      dispatchedCount,
      totalUsers: users.length,
      noteType,
      results,
    });
  } catch (error: any) {
    console.error('[DAILY SELFIE BROADCAST ERROR]', error);
    return NextResponse.json({ error: error.message || 'Failed to dispatch daily selfies' }, { status: 500 });
  }
}
