import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getAllPersonasAsync } from '@/lib/customPersonasStore';
import { getPersonaById } from '@/lib/virtualPersonas';
import { sendCompanionDailySelfieNoteEmail } from '@/lib/mail';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const { personaId, noteType = 'morning', customMessage, targetEmail } = await req.json();

    const userEmail = targetEmail || session?.user?.email;
    const userName = session?.user?.name || 'Friend';
    const userId = session?.user?.id || 'guest_user';

    const allPersonas = await getAllPersonasAsync();
    const persona = allPersonas.find((p) => p.id === personaId) || getPersonaById(personaId);

    if (!persona) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
    }

    const isMan = persona.gender === 'man';
    const personaName = persona.name;

    // 1. Generate Personalized Warm Message based on type
    let defaultMsg = '';
    if (noteType === 'morning') {
      defaultMsg = isMan
        ? `Good morning ${userName}! ☀️ Aaj ki taaza chai ke saath aapki yaad aayi. Hope aapka din bohot energetic aur mast rahe. Khud ka khayal rakhna!`
        : `Good morning ${userName}! ☀️ Aaj subah subah aapse baat karne ka mann hua. Ek pyari si smile ke saath din shuru karo, sab bohot accha hoga ✨`;
    } else if (noteType === 'night') {
      defaultMsg = isMan
        ? `Good night ${userName}! 🌙 Aaj poore din ki saari thakan bhool ke mast araam se sona. Kal milte hain ek nayi energy ke saath. Shubh raatri!`
        : `Good night ${userName}! 🌙 Pura din chahe kaisa bhi raha ho, ab sukoon se aakhein band karo aur meethay sapne dekho. Take care! ✨`;
    } else {
      defaultMsg = `Hey ${userName}! 📸 Bas aise hi aapka haal-chaal lene ke liye ye chhota sa photo bheja. Aap batao, kya chal raha hai?`;
    }

    const message = customMessage || defaultMsg;

    // 2. Select Selfie URL
    const selfieUrl =
      persona.referencePhotos && persona.referencePhotos.length > 0
        ? persona.referencePhotos[Math.floor(Math.random() * persona.referencePhotos.length)]
        : persona.avatarImage;

    // 3. Save to Database
    const savedNote = await prisma.dailyCompanionNote.create({
      data: {
        userId,
        userEmail: userEmail || null,
        personaId: persona.id,
        personaName: persona.name,
        noteType,
        message,
        selfieUrl,
        sentEmail: !!userEmail,
        sentWhatsapp: false,
      },
    });

    // 4. Send Email if user email is available
    if (userEmail) {
      sendCompanionDailySelfieNoteEmail({
        userEmail,
        userName,
        companionName: persona.name,
        companionId: persona.id,
        noteType: noteType as 'morning' | 'night' | 'surprise',
        message,
        selfieUrl,
      }).catch((e) => console.warn('Email trigger warning:', e));
    }

    // 5. Generate WhatsApp Direct Share Link
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://truefriends.app';
    const whatsappText = encodeURIComponent(
      `*${persona.name} (${persona.title}) sent you a ${noteType} note:* \n\n"${message}"\n\n🎥 Video call ${persona.name} here: ${baseUrl}/virtual/call/${persona.id}`
    );
    const whatsappUrl = `https://api.whatsapp.com/send?text=${whatsappText}`;

    return NextResponse.json({
      success: true,
      note: savedNote,
      whatsappUrl,
      emailSent: !!userEmail,
      message,
    });
  } catch (error: any) {
    console.error('[💌 DAILY NOTE ERROR]', error);
    return NextResponse.json({ error: error.message || 'Failed to send daily note' }, { status: 500 });
  }
}
