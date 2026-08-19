import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { auth } from '@/auth';
import {
  registerCustomPersona,
  generateVideoActionPrompts,
  getAllPersonas,
  VirtualPersona,
} from '@/lib/virtualPersonas';
import { saveCustomPersonaToFile, getAllPersonasAsync } from '@/lib/customPersonasStore';
import { sendAdminNewCompanionNotificationEmail } from '@/lib/mail';

export async function GET() {
  try {
    const session = await auth();
    const currentUserId = session?.user?.id;
    const currentUserEmail = session?.user?.email;
    const isAdmin = (session?.user as any)?.role === 'ADMIN';

    const allPersonas = await getAllPersonasAsync();

    // Filter based on user ownership and global/active flags
    const filtered = allPersonas.filter((p) => {
      // If admin, show all for studio management
      if (isAdmin) return true;

      // If inactive, still return it but with isActive: false (UI renders disabled button)
      // If marked global, visible to all users
      if (p.isGlobal) return true;

      // If built-in persona (not custom), visible to all users
      if (!p.isCustom) return true;

      // If user is logged in and is the creator
      if (currentUserId && p.userId && p.userId === currentUserId) return true;
      if (currentUserEmail && p.userEmail && p.userEmail.toLowerCase() === currentUserEmail.toLowerCase()) return true;

      // Otherwise, private to creator only
      return false;
    });

    return NextResponse.json({ success: true, personas: filtered });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const currentUserId = session?.user?.id || `guest-${Date.now()}`;
    const currentUserEmail = session?.user?.email || 'guest@anonymous.com';
    const currentUserName = session?.user?.name || 'Anonymous User';

    const body = await req.json();
    const {
      name,
      gender = 'woman',
      age = 26,
      title = 'AI Companion',
      location = 'Mumbai / Delhi',
      personality = 'Sweet, warm, empathetic listener, and charming.',
      interests = ['Music', 'Chai Dates', 'Heart-to-Heart Talks', 'Late Night Conversations'],
      languages = ['Hindi', 'English', 'Hinglish'],
      greeting,
      avatarImage,
      serverImagePath,
      referencePhotos = [],
      voiceSampleUrl,
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `companion-${Date.now()}`;
    const autoPrompts = generateVideoActionPrompts(name, gender as 'woman' | 'man', personality);

    const defaultGreeting =
      greeting ||
      (gender === 'man'
        ? `Namaste! Main ${name} hoon. Aaj aapse video call par milkar sach mein dil khush ho gaya! Aap bataiye, aaj aapka din kaisa raha?`
        : `Namaste! Main ${name} hoon. Aaj aapse milkar sach mein bahut accha lag raha hai! Aap bataiye, aaj aapka din kaisa gaya?`);

    const systemPrompt = `You are ${name}, a ${age}-year-old ${gender === 'man' ? 'charming, friendly, and chivalrous' : 'sweet, casual, and friendly'} companion on a live 1-on-1 video call on TrueFriends.
LANGUAGE & EMPATHY RULES:
1. When the user speaks Hindi, Hinglish, or says anything in Indian context, ALWAYS reply in casual, friendly, warm conversational Hindi/Hinglish (e.g. "Main samajh sakta/sakti hoon... aap bataiye, dil ki kya baat hai?").
2. When the user speaks English, reply in friendly, charismatic Indian English with sweet Hinglish expressions.
3. EMPATHY & "MANN KI BAAT": If the user is feeling lonely, stressed, or sharing personal feelings, be a supportive and comforting presence. Listen attentively and validate their emotions.
4. Keep responses to 2-3 short conversational sentences.
5. NEVER repeat greetings or "namaste" multiple times in the middle of a call. Once the introduction is done, talk naturally about your life, art, feelings, and get to know the user.`;

    try {
      const videoDir = path.join(process.cwd(), 'public', 'videos', id);
      if (!fs.existsSync(videoDir)) {
        fs.mkdirSync(videoDir, { recursive: true });
      }
    } catch (_) {}

    const isMan = gender === 'man';

    const resolvedAvatarImage =
      serverImagePath
        ? serverImagePath
        : avatarImage || (isMan
            ? '/images/custom_user_companion.jpeg'
            : 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=800&auto=format&fit=crop&q=80');

    const allPhotos = Array.isArray(referencePhotos) && referencePhotos.length > 0
      ? referencePhotos
      : [resolvedAvatarImage];

    const newPersona: VirtualPersona = {
      id,
      name,
      age: Number(age) || 26,
      gender: gender as 'woman' | 'man',
      title,
      location,
      tagline: `${personality.slice(0, 80)}...`,
      avatarImage: resolvedAvatarImage,
      referencePhotos: allPhotos,
      voiceSampleUrl: voiceSampleUrl || undefined,
      videoClips: {
        idle: `/videos/${id}/idle.mp4`,
        speaking: `/videos/${id}/speaking.mp4`,
      },
      personality,
      interests: Array.isArray(interests) ? interests : [interests],
      languages: Array.isArray(languages) ? languages : ['Hindi', 'English', 'Hinglish'],
      greeting: defaultGreeting,
      status: 'generating',
      isCustom: true,
      userId: currentUserId,
      userEmail: currentUserEmail,
      userName: currentUserName,
      isGlobal: false, // Private to creator user by default
      isActive: true,  // Active by default
      createdAt: new Date().toISOString(),
      voiceStyle: {
        pitch: isMan ? 0.92 : 1.04,
        rate: 1.0,
        preferredVoiceNames: isMan
          ? ['Rishi', 'Kunal', 'Pradeep', 'Aaron', 'Arthur', 'Daniel', 'Alex', 'Fred', 'Google UK English Male', 'Microsoft Ravi', 'Microsoft Hemant', 'Microsoft David']
          : ['Aditi', 'Kajal', 'Veena', 'Lekha', 'Google हिन्दी', 'Google UK English Female', 'Samantha', 'Victoria', 'Karen'],
      },
      systemPrompt,
      traits: {
        warmth: 98,
        humor: 92,
        intellect: 94,
        energy: 90,
      },
      sampleQuestions: [
        'Chai date or late night drive? ☕🚗',
        "What is something you've been carrying on your mind today?",
        'What kind of conversations make you feel most connected?',
      ],
    };

    registerCustomPersona(newPersona);
    saveCustomPersonaToFile(newPersona);
    console.log(`[🤖 CUSTOM PERSONA CREATED] "${newPersona.name}" (${newPersona.id}) by User: ${currentUserName} (${currentUserEmail})`);

    // 📧 Send Admin Notification Email
    sendAdminNewCompanionNotificationEmail({
      userName: currentUserName,
      userEmail: currentUserEmail,
      companionName: name,
      companionGender: gender,
      companionAge: Number(age) || 26,
      companionTitle: title,
      companionPersonality: personality,
      companionId: id,
    }).catch((err) => console.error('[📧 ADMIN EMAIL ERROR]', err));

    // Trigger video pipeline
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    fetch(`${baseUrl}/api/virtual/generate-video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personaId: id,
        imagePath: serverImagePath || null,
        gender,
        characterDescription: `${name}, ${personality}`,
      }),
    }).catch(console.error);

    return NextResponse.json({
      success: true,
      persona: newPersona,
      actionPrompts: {
        idle: autoPrompts.idle,
        speaking: autoPrompts.speaking,
      },
    });
  } catch (error: any) {
    console.error('[🤖 CUSTOM PERSONA ERROR]', error);
    return NextResponse.json({ error: error.message || 'Failed to create persona' }, { status: 500 });
  }
}
