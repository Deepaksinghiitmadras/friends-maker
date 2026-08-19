import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import {
  loadCustomPersonasFromFile,
  updateCustomPersona,
  deleteCustomPersonaFromFile,
} from '@/lib/customPersonasStore';
import { generateVideoActionPrompts, VIRTUAL_PERSONAS, getAllPersonas } from '@/lib/virtualPersonas';
import { sendUserCompanionReadyEmail } from '@/lib/mail';

export async function GET() {
  try {
    const all = getAllPersonas();

    // Check disk status of videos for all personas
    const enhancedPersonas = all.map((p) => {
      const videoDir = path.join(process.cwd(), 'public', 'videos', p.id);
      const idlePath = path.join(videoDir, 'idle.mp4');
      const speakPath = path.join(videoDir, 'speaking.mp4');

      const hasIdle = fs.existsSync(idlePath) && fs.statSync(idlePath).size > 1000;
      const hasSpeaking = fs.existsSync(speakPath) && fs.statSync(speakPath).size > 1000;

      const prompts = generateVideoActionPrompts(p.name, p.gender, p.personality);

      return {
        ...p,
        hasIdleVideo: hasIdle,
        hasSpeakingVideo: hasSpeaking,
        idleVideoSize: hasIdle ? fs.statSync(idlePath).size : 0,
        speakingVideoSize: hasSpeaking ? fs.statSync(speakPath).size : 0,
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

    const updated = updateCustomPersona(personaId, updates);

    // If marked ready, trigger user notification email
    if (status === 'ready' && updated && updated.userEmail && !updated.userEmail.includes('anonymous')) {
      sendUserCompanionReadyEmail({
        userEmail: updated.userEmail,
        userName: updated.userName || 'Valued Member',
        companionName: updated.name,
        companionId: updated.id,
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

    deleteCustomPersonaFromFile(id);
    return NextResponse.json({ success: true, message: `Persona "${id}" deleted` });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
