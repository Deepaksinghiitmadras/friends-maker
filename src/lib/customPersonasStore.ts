import fs from 'fs';
import path from 'path';
import { VirtualPersona } from './virtualPersonas';
import { prisma } from './prisma';

const DATA_DIR = path.join(process.cwd(), 'data');
const FILE_PATH = path.join(DATA_DIR, 'custom-personas.json');

function ensureFileExists() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(FILE_PATH)) {
      fs.writeFileSync(FILE_PATH, JSON.stringify([]), 'utf-8');
    }
  } catch (_) {
    // Ignore read-only filesystem errors on Vercel
  }
}

/**
 * Save custom persona to Database (and fallback to file in local dev).
 */
export async function saveCustomPersonaToFile(persona: VirtualPersona) {
  const isGlobal = persona.isGlobal !== undefined ? persona.isGlobal : false;
  const isActive = persona.isActive !== undefined ? persona.isActive : true;

  // 1. Save to Database (Prisma)
  try {
    await prisma.customPersona.upsert({
      where: { id: persona.id },
      update: {
        name: persona.name,
        age: Number(persona.age) || 26,
        gender: persona.gender,
        title: persona.title,
        location: persona.location,
        tagline: persona.tagline,
        avatarImage: persona.avatarImage,
        personality: persona.personality,
        interests: persona.interests,
        languages: persona.languages,
        greeting: persona.greeting,
        status: persona.status || 'generating',
        isCustom: persona.isCustom !== undefined ? persona.isCustom : true,
        userId: persona.userId,
        userEmail: persona.userEmail,
        userName: persona.userName,
        isGlobal,
        isActive,
        systemPrompt: persona.systemPrompt || '',
        videoClips: persona.videoClips ? (persona.videoClips as any) : undefined,
        voiceStyle: persona.voiceStyle ? (persona.voiceStyle as any) : undefined,
        traits: persona.traits ? (persona.traits as any) : undefined,
        sampleQuestions: persona.sampleQuestions || [],
      },
      create: {
        id: persona.id,
        name: persona.name,
        age: Number(persona.age) || 26,
        gender: persona.gender,
        title: persona.title,
        location: persona.location,
        tagline: persona.tagline,
        avatarImage: persona.avatarImage,
        personality: persona.personality,
        interests: persona.interests,
        languages: persona.languages,
        greeting: persona.greeting,
        status: persona.status || 'generating',
        isCustom: persona.isCustom !== undefined ? persona.isCustom : true,
        userId: persona.userId,
        userEmail: persona.userEmail,
        userName: persona.userName,
        isGlobal,
        isActive,
        systemPrompt: persona.systemPrompt || '',
        videoClips: persona.videoClips ? (persona.videoClips as any) : undefined,
        voiceStyle: persona.voiceStyle ? (persona.voiceStyle as any) : undefined,
        traits: persona.traits ? (persona.traits as any) : undefined,
        sampleQuestions: persona.sampleQuestions || [],
      },
    });
  } catch (dbErr) {
    console.warn('[STORE] DB save warning:', dbErr);
  }

  // 2. Local file fallback
  try {
    ensureFileExists();
    if (fs.existsSync(FILE_PATH)) {
      const data = fs.readFileSync(FILE_PATH, 'utf-8');
      const personas: VirtualPersona[] = data ? JSON.parse(data) : [];
      const idx = personas.findIndex((p) => p.id === persona.id);
      const personaToSave = { ...persona, isActive, isGlobal };
      if (idx >= 0) {
        personas[idx] = { ...personas[idx], ...personaToSave };
      } else {
        personas.unshift(personaToSave);
      }
      fs.writeFileSync(FILE_PATH, JSON.stringify(personas, null, 2), 'utf-8');
    }
  } catch (_) {}
}

/**
 * Load all custom personas from Database (with local file fallback).
 */
export async function loadCustomPersonasAsync(): Promise<VirtualPersona[]> {
  try {
    const dbPersonas = await prisma.customPersona.findMany({
      orderBy: { createdAt: 'desc' },
    });

    if (dbPersonas && dbPersonas.length > 0) {
      return dbPersonas.map((p) => ({
        id: p.id,
        name: p.name,
        age: p.age,
        gender: p.gender as 'woman' | 'man',
        title: p.title,
        location: p.location,
        tagline: p.tagline,
        avatarImage: p.avatarImage,
        videoClips: (p.videoClips as any) || {
          idle: `/videos/${p.id}/idle.mp4`,
          speaking: `/videos/${p.id}/speaking.mp4`,
        },
        personality: p.personality,
        interests: p.interests,
        languages: p.languages,
        greeting: p.greeting,
        status: (p.status as any) || 'generating',
        isCustom: p.isCustom,
        userId: p.userId || undefined,
        userEmail: p.userEmail || undefined,
        userName: p.userName || undefined,
        isGlobal: p.isGlobal,
        isActive: p.isActive,
        createdAt: p.createdAt.toISOString(),
        voiceStyle: (p.voiceStyle as any) || {
          pitch: p.gender === 'man' ? 0.88 : 1.04,
          rate: p.gender === 'man' ? 0.98 : 0.97,
        },
        systemPrompt: p.systemPrompt,
        traits: (p.traits as any) || { warmth: 95, humor: 90, intellect: 90, energy: 90 },
        sampleQuestions: p.sampleQuestions,
      }));
    }
  } catch (err) {
    console.warn('[STORE] DB load warning:', err);
  }

  // Fallback to local file
  return loadCustomPersonasFromFile();
}

export function loadCustomPersonasFromFile(): VirtualPersona[] {
  try {
    ensureFileExists();
    if (fs.existsSync(FILE_PATH)) {
      const data = fs.readFileSync(FILE_PATH, 'utf-8');
      const personas: VirtualPersona[] = data ? JSON.parse(data) : [];
      return personas.map((p) => ({
        ...p,
        isActive: p.isActive !== undefined ? p.isActive : true,
        isGlobal: p.isGlobal !== undefined ? p.isGlobal : false,
      }));
    }
  } catch (_) {}
  return [];
}

/**
 * Update custom persona flags in Database and file.
 */
export async function updateCustomPersona(id: string, updates: Partial<VirtualPersona>) {
  // 1. Update in Database
  try {
    const dataToUpdate: any = {};
    if (updates.status !== undefined) dataToUpdate.status = updates.status;
    if (updates.isActive !== undefined) dataToUpdate.isActive = updates.isActive;
    if (updates.isGlobal !== undefined) dataToUpdate.isGlobal = updates.isGlobal;
    if (updates.videoClips !== undefined) dataToUpdate.videoClips = updates.videoClips;

    // Check if exists in DB or is a built-in persona override
    const existing = await prisma.customPersona.findUnique({ where: { id } });
    if (existing) {
      const updated = await prisma.customPersona.update({
        where: { id },
        data: dataToUpdate,
      });
      return updated;
    } else {
      const { VIRTUAL_PERSONAS } = require('./virtualPersonas');
      const builtIn = VIRTUAL_PERSONAS.find((b: any) => b.id === id);
      if (builtIn) {
        const created = await prisma.customPersona.create({
          data: {
            id: builtIn.id,
            name: builtIn.name,
            age: builtIn.age,
            gender: builtIn.gender,
            title: builtIn.title,
            location: builtIn.location,
            tagline: builtIn.tagline,
            avatarImage: builtIn.avatarImage,
            personality: builtIn.personality,
            interests: builtIn.interests,
            languages: builtIn.languages,
            greeting: builtIn.greeting,
            status: builtIn.status || 'ready',
            isCustom: false,
            isGlobal: updates.isGlobal !== undefined ? updates.isGlobal : true,
            isActive: updates.isActive !== undefined ? updates.isActive : true,
            systemPrompt: builtIn.systemPrompt,
            videoClips: builtIn.videoClips as any,
            voiceStyle: builtIn.voiceStyle as any,
            traits: builtIn.traits as any,
            sampleQuestions: builtIn.sampleQuestions,
          },
        });
        return created;
      }
    }
  } catch (err) {
    console.warn('[STORE] DB update warning:', err);
  }

  // 2. Update local file
  try {
    ensureFileExists();
    if (fs.existsSync(FILE_PATH)) {
      const data = fs.readFileSync(FILE_PATH, 'utf-8');
      const personas: VirtualPersona[] = data ? JSON.parse(data) : [];
      const idx = personas.findIndex((p) => p.id === id);
      if (idx >= 0) {
        personas[idx] = { ...personas[idx], ...updates };
        fs.writeFileSync(FILE_PATH, JSON.stringify(personas, null, 2), 'utf-8');
        return personas[idx];
      }
    }
  } catch (_) {}
  return null;
}

export function updateCustomPersonaStatus(id: string, status: 'generating' | 'ready') {
  return updateCustomPersona(id, { status });
}

export function updateCustomPersonaActive(id: string, isActive: boolean) {
  return updateCustomPersona(id, { isActive });
}

export function updateCustomPersonaGlobal(id: string, isGlobal: boolean) {
  return updateCustomPersona(id, { isGlobal });
}

export async function deleteCustomPersonaFromFile(id: string) {
  // 1. Delete from Database
  try {
    await prisma.customPersona.deleteMany({
      where: { id },
    });
  } catch (err) {
    console.warn('[STORE] DB delete warning:', err);
  }

  // 2. Delete from file & video folder
  try {
    ensureFileExists();
    if (fs.existsSync(FILE_PATH)) {
      const data = fs.readFileSync(FILE_PATH, 'utf-8');
      const personas: VirtualPersona[] = data ? JSON.parse(data) : [];
      const filtered = personas.filter((p) => p.id !== id);
      fs.writeFileSync(FILE_PATH, JSON.stringify(filtered, null, 2), 'utf-8');
    }

    const videoDir = path.join(process.cwd(), 'public', 'videos', id);
    if (fs.existsSync(videoDir)) {
      fs.rmSync(videoDir, { recursive: true, force: true });
    }
  } catch (_) {}
}
