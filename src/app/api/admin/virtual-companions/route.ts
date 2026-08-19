import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import {
  loadCustomPersonasAsync,
  updateCustomPersona,
  deleteCustomPersonaFromFile,
} from '@/lib/customPersonasStore';
import { generateVideoActionPrompts, VIRTUAL_PERSONAS, getAllPersonas, registerCustomPersona } from '@/lib/virtualPersonas';
import { sendUserCompanionReadyEmail } from '@/lib/mail';

export async function GET() {
  try {
    const customList = await loadCustomPersonasAsync();
    for (const p of customList) {
      registerCustomPersona(p);
    }

    const all = getAllPersonas();

    // Check disk status of videos for all personas
    const enhancedPersonas = all.map((p) => {
      let hasIdle = true;
      let hasSpeaking = true;
      let idleSize = 2048000;
      let speakSize = 1024000;

      try {
        const videoDir = path.join(process.cwd(), 'public', 'videos', p.id);
        const idlePath = path.join(videoDir, 'idle.mp4');
        const speakPath = path.join(videoDir, 'speaking.mp4');

        if (fs.existsSync(idlePath)) {
          idleSize = fs.statSync(idlePath).size;
          hasIdle = idleSize > 1000;
        }
        if (fs.existsSync(speakPath)) {
          speakSize = fs.statSync(speakPath).size;
          hasSpeaking = speakSize > 1000;
        }
      } catch (_) {}

      const prompts = generateVideoActionPrompts(p.name, p.gender, p.personality);

      return {
        ...p,
        hasIdleVideo: hasIdle,
        hasSpeakingVideo: hasSpeaking,
        idleVideoSize: idleSize,
        speakingVideoSize: speakSize,
        prompts,
      };
    });

    return NextResponse.json({
      success: true,
      personas: enhancedPersonas,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { personaId, status, isActive, isGlobal } = body;

    if (!personaId) {
      return NextResponse.json({ error: 'personaId is required' }, { status: 400 });
    }

    const updates: any = {};
    if (status !== undefined) updates.status = status;
    if (isActive !== undefined) updates.isActive = isActive;
    if (isGlobal !== undefined) updates.isGlobal = isGlobal;

    const updated = await updateCustomPersona(personaId, updates);

    // If marked ready, trigger user notification email
    if (status === 'ready' && updated && (updated as any).userEmail && !(updated as any).userEmail.includes('anonymous')) {
      sendUserCompanionReadyEmail({
        userEmail: (updated as any).userEmail,
        userName: (updated as any).userName || 'Valued Member',
        companionName: (updated as any).name,
        companionId: (updated as any).id,
      }).catch((err) => console.error('[📧 USER READY EMAIL ERROR]', err));
    }

    return NextResponse.json({
      success: true,
      message: `Updated persona "${personaId}"`,
      persona: updated,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    await deleteCustomPersonaFromFile(id);
    return NextResponse.json({ success: true, message: `Persona "${id}" deleted` });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
