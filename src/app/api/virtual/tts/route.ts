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

    // Determine language based on persona and text content
    let lang = language || 'en';
    if (personaId === 'ananya-sharma') {
      const hasDevanagari = /[\u0900-\u097F]/.test(text);
      const isHinglish = /\b(namaste|aap|kaise|kaisi|kaisa|main|meri|mera|mujhe|hum|theek|haan|nahi|kya|accha|achha|bahut|shukriya|pyaar|dil|chai|bolo|batao|karo|sach|arey|ji)\b/i.test(text);
      
      if (hasDevanagari || isHinglish || language === 'hi') {
        lang = 'hi';
      } else {
        lang = 'en';
      }
    } else if (personaId === 'elena-rostova') {
      const isSpanish = /\b(hola|cómo|estas|gracias|amor|buenos|noches|que|tal)\b/i.test(text);
      lang = isSpanish ? 'es' : 'en';
    } else if (personaId === 'marcus-chen') {
      const hasChinese = /[\u4e00-\u9fa5]/.test(text);
      lang = hasChinese ? 'zh' : 'en';
    }

    const cleanText = text.replace(/[*_~`]/g, '').trim().slice(0, 300);
    console.log(`[🔊 TTS INCOMING] Persona: "${personaId}" | Lang: "${lang}" | Text: "${cleanText.slice(0, 60)}..."`);

    // Generate the Google TTS audio URL
    const googleAudioUrl = googleTTS.getAudioUrl(cleanText, {
      lang: lang,
      slow: false,
      host: 'https://translate.google.com',
    });

    // PROXY: Fetch the audio from Google and stream it back to the browser
    const audioResponse = await fetch(googleAudioUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Referer': 'https://translate.google.com/',
      },
    });

    if (!audioResponse.ok) {
      console.error(`[🔊 TTS ERROR] Google returned ${audioResponse.status}`);
      return NextResponse.json({ error: 'Audio fetch failed' }, { status: 502 });
    }

    const audioBuffer = await audioResponse.arrayBuffer();
    const duration = Date.now() - startTime;
    console.log(`[🔊 TTS SUCCESS] Generated ${audioBuffer.byteLength} bytes of audio in ${duration}ms`);

    // Return the audio directly as binary stream
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(audioBuffer.byteLength),
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error: any) {
    console.error('[🔊 TTS FATAL ERROR]', error);
    return NextResponse.json({ error: error.message || 'TTS generation failed' }, { status: 500 });
  }
}
