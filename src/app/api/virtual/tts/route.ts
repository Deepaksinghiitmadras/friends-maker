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
      const hasDevanagari = /[\u0900-\u097F]/.test(text);
      lang = hasDevanagari ? 'hi' : 'en-IN';
    } else if (personaId === 'elena-rostova') {
      lang = 'en';
    }

    // Generate the Google TTS audio URL
    const cleanText = text.replace(/[*_~`]/g, '').trim().slice(0, 300);
    const googleAudioUrl = googleTTS.getAudioUrl(cleanText, {
      lang: lang,
      slow: false,
      host: 'https://translate.google.com',
    });

    // PROXY: Fetch the audio from Google and stream it back to the browser
    // This avoids CORS issues that prevent new Audio(crossOriginUrl).play()
    const audioResponse = await fetch(googleAudioUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Referer': 'https://translate.google.com/',
      },
    });

    if (!audioResponse.ok) {
      console.error(`[TTS] Google returned ${audioResponse.status}`);
      return NextResponse.json({ error: 'Audio fetch failed' }, { status: 502 });
    }

    const audioBuffer = await audioResponse.arrayBuffer();

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
    console.error('TTS Route Error:', error);
    return NextResponse.json({ error: error.message || 'TTS generation failed' }, { status: 500 });
  }
}
