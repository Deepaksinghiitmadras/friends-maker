import { NextRequest, NextResponse } from 'next/server';
import * as googleTTS from 'google-tts-api';

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  try {
    const { text, personaId, language } = await req.json();

    if (!text || !text.trim()) {
      console.warn('[🔊 TTS] Rejected request with empty text');
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    // Comprehensive script and vocabulary language auto-detection
    let lang = language || 'en';

    // 1. Script-based Unicode detection (Instant & 100% accurate)
    if (/[\u0B80-\u0BFF]/.test(text)) {
      lang = 'ta'; // Tamil
    } else if (/[\u0980-\u09FF]/.test(text)) {
      lang = 'bn'; // Bengali
    } else if (/[\u0C00-\u0C7F]/.test(text)) {
      lang = 'te'; // Telugu
    } else if (/[\u0A80-\u0AFF]/.test(text)) {
      lang = 'gu'; // Gujarati
    } else if (/[\u0A00-\u0A7F]/.test(text)) {
      lang = 'pa'; // Punjabi
    } else if (/[\u0600-\u06FF]/.test(text)) {
      lang = 'ur'; // Urdu / Arabic
    } else if (/[\u4e00-\u9fa5]/.test(text)) {
      lang = 'zh'; // Chinese
    } else if (/[\u3040-\u30ff]/.test(text)) {
      lang = 'ja'; // Japanese
    } else if (/[\uac00-\ud7af]/.test(text)) {
      lang = 'ko'; // Korean
    } else if (/[\u0900-\u097F]/.test(text)) {
      lang = 'hi'; // Hindi / Marathi
    } else if (personaId === 'ananya-sharma' || personaId === 'aarav-malhotra' || personaId === 'kabir-malhotra') {
      const isHinglish = /\b(namaste|aap|kaise|kaisi|kaisa|main|meri|mera|mujhe|hum|theek|haan|nahi|kya|accha|achha|bahut|shukriya|pyaar|dil|chai|bolo|batao|karo|sach|arey|ji|yaar|kya baat|sunao|badhiya)\b/i.test(text);
      if (isHinglish || language === 'hi') {
        lang = 'hi';
      } else {
        lang = 'en';
      }
    } else if (personaId === 'elena-rostova') {
      const isSpanish = /\b(hola|cómo|estas|gracias|amor|buenos|noches|que|tal|corazon|vida)\b/i.test(text);
      lang = isSpanish ? 'es' : 'en';
    } else if (personaId === 'marcus-chen') {
      lang = language === 'zh' ? 'zh' : 'en';
    }

    const cleanText = text.replace(/[*_~`]/g, '').trim();
    console.log(`[🔊 TTS INCOMING] Persona: "${personaId}" | Lang: "${lang}" | Length: ${cleanText.length} chars | Text: "${cleanText.slice(0, 60)}..."`);

    // Generate Google TTS audio URLs (supports text longer than 200 chars via chunking)
    const audioUrlObjects = googleTTS.getAllAudioUrls(cleanText, {
      lang: lang,
      slow: false,
      host: 'https://translate.google.com',
      splitPunct: '.,!?।;',
    });

    // Fetch all audio chunks in parallel
    const chunkPromises = audioUrlObjects.map(async (item) => {
      const res = await fetch(item.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Referer': 'https://translate.google.com/',
        },
      });
      if (!res.ok) throw new Error(`Google chunk fetch failed with status ${res.status}`);
      return res.arrayBuffer();
    });

    const chunkBuffers = await Promise.all(chunkPromises);
    const totalLength = chunkBuffers.reduce((acc, b) => acc + b.byteLength, 0);
    
    // Combine all chunks into a single audio stream
    const combinedBuffer = new Uint8Array(totalLength);
    let offset = 0;
    for (const buf of chunkBuffers) {
      combinedBuffer.set(new Uint8Array(buf), offset);
      offset += buf.byteLength;
    }

    const duration = Date.now() - startTime;
    console.log(`[🔊 TTS SUCCESS] Generated ${totalLength} bytes across ${chunkBuffers.length} chunk(s) in ${duration}ms`);

    // Return the audio directly as binary stream
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
