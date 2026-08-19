import { NextRequest, NextResponse } from 'next/server';
import * as googleTTS from 'google-tts-api';
import { getPersonaById } from '@/lib/virtualPersonas';
import { getAllPersonasAsync } from '@/lib/customPersonasStore';

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  try {
    const { text, personaId, language } = await req.json();

    if (!text || !text.trim()) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const cleanText = text.replace(/[*_~`#]/g, '').trim();

    // Look up persona details to get gender, custom voice ID, etc.
    const allPersonas = await getAllPersonasAsync();
    const persona = allPersonas.find((p) => p.id === personaId) || getPersonaById(personaId);
    const isMan = persona?.gender === 'man';

    console.log(`[🔊 TTS INCOMING] Persona: "${personaId}" (${isMan ? 'Man' : 'Woman'}) | Length: ${cleanText.length} chars | Text: "${cleanText.slice(0, 60)}..."`);

    // ── 1. CHARIOT.IN NATIVE INDIAN TTS (High-fidelity Indian voices: Darshan & Meera) ──
    const chariotKey = process.env.CHARIOT_KEY || process.env.CHARIOT_API_KEY;
    if (chariotKey) {
      try {
        console.log(`[🔊 TTS CHARIOT] Streaming Indian voice via Chariot.in (${isMan ? 'Darshan (Male)' : 'Meera (Female)'})...`);
        const chariotRes = await fetch('https://api.chariot.in/v1/tts/stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'chariotai-api-key': chariotKey,
          },
          body: JSON.stringify({
            voice_id: isMan ? 'Darshan' : 'Meera',
            text: cleanText,
            model_type: 'v0',
          }),
        });

        if (chariotRes.ok) {
          const audioBuffer = await chariotRes.arrayBuffer();
          if (audioBuffer.byteLength > 100) {
            console.log(`[🔊 TTS SUCCESS - CHARIOT] Generated ${audioBuffer.byteLength} bytes in ${Date.now() - startTime}ms`);
            return new NextResponse(audioBuffer, {
              status: 200,
              headers: {
                'Content-Type': 'audio/mpeg',
                'Content-Length': String(audioBuffer.byteLength),
                'Cache-Control': 'public, max-age=3600',
              },
            });
          }
        }
      } catch (chariotErr) {
        console.warn('[🔊 TTS CHARIOT WARNING] Chariot fetch failed, falling back:', chariotErr);
      }
    }

    // ── 2. ELEVENLABS MULTILINGUAL V2 / CUSTOM CLONED VOICE ──────────────────────
    const elevenKey = process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_API_KEY;
    const voiceId = persona?.voiceId || (isMan ? 'pNInz6obpgDQGcFmaJgB' : '21m00Tcm4TlvDq8ikWAM'); // Adam/Rachel defaults

    if (elevenKey) {
      try {
        console.log(`[🔊 TTS ELEVENLABS] Calling ElevenLabs Multilingual V2 (Voice: ${voiceId})...`);
        const elevenRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'xi-api-key': elevenKey,
          },
          body: JSON.stringify({
            text: cleanText,
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
            },
          }),
        });

        if (elevenRes.ok) {
          const audioBuffer = await elevenRes.arrayBuffer();
          if (audioBuffer.byteLength > 100) {
            console.log(`[🔊 TTS SUCCESS - ELEVENLABS] Generated ${audioBuffer.byteLength} bytes in ${Date.now() - startTime}ms`);
            return new NextResponse(audioBuffer, {
              status: 200,
              headers: {
                'Content-Type': 'audio/mpeg',
                'Content-Length': String(audioBuffer.byteLength),
                'Cache-Control': 'public, max-age=3600',
              },
            });
          }
        }
      } catch (elevenErr) {
        console.warn('[🔊 TTS ELEVENLABS WARNING] ElevenLabs fetch failed, falling back:', elevenErr);
      }
    }

    // ── 3. GOOGLE TTS PARALLEL CHUNKING STREAM (Universal Zero-Config Fallback) ──
    let lang = language || 'en';
    if (/[\u0900-\u097F]/.test(cleanText) || /\b(namaste|aap|kaise|kaisi|kaisa|main|meri|mera|mujhe|hum|theek|haan|nahi|kya|accha|achha|bahut|shukriya|pyaar|dil|chai|bolo|batao|karo|sach|arey|ji|yaar)\b/i.test(cleanText)) {
      lang = 'hi';
    }

    const audioUrlObjects = googleTTS.getAllAudioUrls(cleanText, {
      lang,
      slow: false,
      host: 'https://translate.google.com',
      splitPunct: '.,!?।;',
    });

    const chunkPromises = audioUrlObjects.map(async (item) => {
      const res = await fetch(item.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Referer': 'https://translate.google.com/',
        },
      });
      if (!res.ok) throw new Error(`Chunk fetch failed: ${res.status}`);
      return res.arrayBuffer();
    });

    const chunkBuffers = await Promise.all(chunkPromises);
    const totalLength = chunkBuffers.reduce((acc, b) => acc + b.byteLength, 0);

    const combinedBuffer = new Uint8Array(totalLength);
    let offset = 0;
    for (const buf of chunkBuffers) {
      combinedBuffer.set(new Uint8Array(buf), offset);
      offset += buf.byteLength;
    }

    console.log(`[🔊 TTS SUCCESS - GOOGLE] Generated ${totalLength} bytes in ${Date.now() - startTime}ms`);

    return new NextResponse(combinedBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(totalLength),
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error: any) {
    console.error('[🔊 TTS FATAL ERROR]', error);
    return NextResponse.json({ error: error.message || 'TTS generation failed' }, { status: 500 });
  }
}
