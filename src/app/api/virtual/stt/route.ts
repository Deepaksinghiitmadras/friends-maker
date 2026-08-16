import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      return NextResponse.json({ error: 'GROQ_API_KEY not configured' }, { status: 500 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as Blob;
    const language = (formData.get('language') as string) || 'en';

    if (!file) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    // Forward audio stream to Groq Whisper Speech API
    const groqFormData = new FormData();
    groqFormData.append('file', file, 'audio.webm');
    groqFormData.append('model', 'whisper-large-v3-turbo');
    groqFormData.append('response_format', 'json');
    if (language) {
      groqFormData.append('language', language);
    }

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqKey}`,
      },
      body: groqFormData,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Groq Whisper error:', errText);
      return NextResponse.json({ error: 'Whisper transcription failed', details: errText }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json({ text: data.text, source: 'groq-whisper-turbo' });
  } catch (error: any) {
    console.error('STT API Route error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
