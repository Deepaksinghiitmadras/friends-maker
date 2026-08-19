import fs from 'fs';
import path from 'path';
import { VirtualPersona } from './virtualPersonas';

const DATA_DIR = path.join(process.cwd(), 'data');
const FILE_PATH = path.join(DATA_DIR, 'custom-personas.json');

function ensureFileExists() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(FILE_PATH)) {
    fs.writeFileSync(FILE_PATH, JSON.stringify([]), 'utf-8');
  }
}

export function saveCustomPersonaToFile(persona: VirtualPersona) {
  try {
    ensureFileExists();
    const data = fs.readFileSync(FILE_PATH, 'utf-8');
    const personas: VirtualPersona[] = data ? JSON.parse(data) : [];
    const idx = personas.findIndex((p) => p.id === persona.id);
    const personaToSave = {
      ...persona,
      isActive: persona.isActive !== undefined ? persona.isActive : true,
      isGlobal: persona.isGlobal !== undefined ? persona.isGlobal : false,
      createdAt: persona.createdAt || new Date().toISOString(),
    };
    if (idx >= 0) {
      personas[idx] = { ...personas[idx], ...personaToSave };
    } else {
      personas.unshift(personaToSave);
    }
    fs.writeFileSync(FILE_PATH, JSON.stringify(personas, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save custom persona to file:', err);
  }
}

export function loadCustomPersonasFromFile(): VirtualPersona[] {
  try {
    ensureFileExists();
    const data = fs.readFileSync(FILE_PATH, 'utf-8');
    const personas: VirtualPersona[] = data ? JSON.parse(data) : [];
    return personas.map((p) => ({
      ...p,
      isActive: p.isActive !== undefined ? p.isActive : true,
      isGlobal: p.isGlobal !== undefined ? p.isGlobal : false,
    }));
  } catch (err) {
    console.error('Failed to load custom personas from file:', err);
    return [];
  }
}

export function updateCustomPersona(id: string, updates: Partial<VirtualPersona>) {
  try {
    ensureFileExists();
    const data = fs.readFileSync(FILE_PATH, 'utf-8');
    const personas: VirtualPersona[] = data ? JSON.parse(data) : [];
    const idx = personas.findIndex((p) => p.id === id);
    if (idx >= 0) {
      personas[idx] = { ...personas[idx], ...updates };
      fs.writeFileSync(FILE_PATH, JSON.stringify(personas, null, 2), 'utf-8');
      return personas[idx];
    } else {
      // If updating a built-in persona (e.g. ananya-sharma, aarav-malhotra), create an entry in custom store
      const { VIRTUAL_PERSONAS } = require('./virtualPersonas');
      const builtIn = VIRTUAL_PERSONAS.find((b: any) => b.id === id);
      if (builtIn) {
        const newEntry = { ...builtIn, ...updates };
        personas.push(newEntry);
        fs.writeFileSync(FILE_PATH, JSON.stringify(personas, null, 2), 'utf-8');
        return newEntry;
      }
    }
    return null;
  } catch (err) {
    console.error('Failed to update custom persona:', err);
    return null;
  }
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

export function deleteCustomPersonaFromFile(id: string) {
  try {
    ensureFileExists();
    const data = fs.readFileSync(FILE_PATH, 'utf-8');
    const personas: VirtualPersona[] = data ? JSON.parse(data) : [];
    const filtered = personas.filter((p) => p.id !== id);
    fs.writeFileSync(FILE_PATH, JSON.stringify(filtered, null, 2), 'utf-8');

    // Also clean up video folder if exists
    const videoDir = path.join(process.cwd(), 'public', 'videos', id);
    if (fs.existsSync(videoDir)) {
      fs.rmSync(videoDir, { recursive: true, force: true });
    }
  } catch (err) {
    console.error('Failed to delete custom persona from file:', err);
  }
}
