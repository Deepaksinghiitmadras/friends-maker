import { NextRequest, NextResponse } from 'next/server';
import * as googleTTS from 'google-tts-api';

export async function POST(req: NextRequest) {
  try {
    const { text, personaId, language } = await req.json();

    if (!text || !text.trim()) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    // Determine language based on persona
    let lang = language || 'en';
    if (personaId === 'ananya-sharma') {
      // Check if text has Devanagari or Hindi words, else use en-IN / hi
      const hasDevanagari = /[\u0900-\u097F]/.test(text);
      lang = hasDevanagari ? 'hi' : 'en-IN';
    } else if (personaId === 'sophia-martinez') {
      lang = 'en';
    } else if (personaId === 'leo-sterling') {
      lang = 'en';
    } else if (personaId === 'ethan-reed') {
      lang = 'en-AU';
    }

    // Generate Direct High Quality Neural Audio URL
    const cleanText = text.replace(/[*_~`]/g, '').trim().slice(0, 300);
    const audioUrl = googleTTS.getAudioUrl(cleanText, {
      lang: lang,
      slow: false,
      host: 'https://translate.google.com',
    });

    return NextResponse.json({
      audioUrl,
      source: 'neural-tts',
      language: lang,
    });
  } catch (error: any) {
    console.error('TTS Route Error:', error);
    return NextResponse.json({ error: error.message || 'TTS generation failed' }, { status: 500 });
  }
}
