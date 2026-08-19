import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { updateCustomPersona } from '@/lib/customPersonasStore';

export async function POST(req: NextRequest) {
  try {
    const { personaId, customVoiceId } = await req.json();

    if (!personaId) {
      return NextResponse.json({ error: 'personaId is required' }, { status: 400 });
    }

    // 1. If admin manually selected or provided a Voice ID
    if (customVoiceId && customVoiceId.trim()) {
      await updateCustomPersona(personaId, { voiceId: customVoiceId.trim() });
      return NextResponse.json({
        success: true,
        voiceId: customVoiceId.trim(),
        message: 'Voice ID saved successfully!',
      });
    }

    // 2. Fetch persona details from DB
    const persona = await prisma.customPersona.findUnique({
      where: { id: personaId },
    });

    if (!persona) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
    }

    if (!persona.voiceSampleUrl) {
      return NextResponse.json(
        { error: 'No voice sample audio found for this companion. Please upload an audio file first.' },
        { status: 400 }
      );
    }

    const elevenKey = process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_API_KEY;
    if (!elevenKey) {
      return NextResponse.json(
        { error: 'ELEVENLABS_API_KEY is not configured in environment variables' },
        { status: 400 }
      );
    }

    console.log(`[🎙️ ELEVENLABS CLONE] Fetching audio sample for "${persona.name}"...`);

    // Fetch the audio sample buffer
    let audioBuffer: Buffer;
    let mimeType = 'audio/webm';

    if (persona.voiceSampleUrl.startsWith('data:')) {
      const parts = persona.voiceSampleUrl.split(';base64,');
      mimeType = parts[0].replace('data:', '') || 'audio/webm';
      audioBuffer = Buffer.from(parts[1], 'base64');
    } else {
      const audioRes = await fetch(persona.voiceSampleUrl);
      if (!audioRes.ok) {
        throw new Error(`Failed to fetch audio sample from URL (${audioRes.status})`);
      }
      audioBuffer = Buffer.from(await audioRes.arrayBuffer());
      mimeType = audioRes.headers.get('content-type') || 'audio/webm';
    }

    console.log(`[🎙️ ELEVENLABS CLONE] Uploading ${audioBuffer.length} bytes to ElevenLabs Instant Voice Cloning...`);

    // Prepare multipart form data for ElevenLabs
    const formData = new FormData();
    formData.append('name', `${persona.name} (${persona.id.slice(0, 8)})`);
    formData.append('description', `Cloned voice for TrueFriends companion ${persona.name}`);
    const audioBlob = new Blob([audioBuffer], { type: mimeType });
    formData.append('files', audioBlob, `voice_sample_${persona.id}.webm`);

    const cloneRes = await fetch('https://api.elevenlabs.io/v1/voices/add', {
      method: 'POST',
      headers: {
        'xi-api-key': elevenKey,
      },
      body: formData,
    });

    if (!cloneRes.ok) {
      const errText = await cloneRes.text();
      console.warn(`[🎙️ ELEVENLABS CLONE NOTICE] Status ${cloneRes.status}:`, errText);

      // Check if it's the free tier limitation
      if (errText.includes('payment_required') || errText.includes('paid_plan_required')) {
        return NextResponse.json({
          success: false,
          isPaidPlanRequired: true,
          error:
            'ElevenLabs Instant Voice Cloning requires their paid Starter plan ($5/mo). On the free tier, you can select from the 20+ ElevenLabs premade voices or Chariot.in Indian voices (Darshan & Meera).',
        });
      }

      return NextResponse.json(
        { error: `ElevenLabs cloning returned status ${cloneRes.status}: ${errText}` },
        { status: cloneRes.status }
      );
    }

    const cloneData = await cloneRes.json();
    const clonedVoiceId = cloneData.voice_id;

    console.log(`[🎙️ ELEVENLABS CLONE SUCCESS] Created voice_id: "${clonedVoiceId}" for "${persona.name}"`);

    // Save cloned voice_id to database
    await updateCustomPersona(personaId, { voiceId: clonedVoiceId });

    return NextResponse.json({
      success: true,
      voiceId: clonedVoiceId,
      message: `Voice cloned successfully! Voice ID: ${clonedVoiceId}`,
    });
  } catch (error: any) {
    console.error('[🎙️ CLONE VOICE ERROR]', error);
    return NextResponse.json({ error: error.message || 'Voice cloning failed' }, { status: 500 });
  }
}
