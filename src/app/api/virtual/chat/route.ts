import { NextRequest, NextResponse } from 'next/server';
import { getPersonaById, VirtualPersona } from '@/lib/virtualPersonas';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function POST(req: NextRequest) {
  try {
    const { personaId, message, conversationHistory } = await req.json();

    const persona = getPersonaById(personaId);
    if (!persona) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
    }

    // 1. Check for Groq, OpenAI, or Gemini API keys
    const groqKey = process.env.GROQ_API_KEY;
    const openAiKey = process.env.OPENAI_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    // A. Priority 1: Groq (Ultra-fast ~100-200ms latency with Llama 3.3 70B)
    if (groqKey) {
      try {
        const messages: ChatMessage[] = [
          { role: 'system', content: persona.systemPrompt },
          ...(conversationHistory || []).slice(-8),
          { role: 'user', content: message },
        ];

        const modelToUse = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${groqKey}`,
          },
          body: JSON.stringify({
            model: modelToUse,
            messages,
            temperature: 0.85,
            max_tokens: 150,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const reply = data.choices?.[0]?.message?.content?.trim();
          if (reply) {
            return NextResponse.json({ reply, source: 'groq', model: modelToUse });
          }
        }
      } catch (err) {
        console.error('Groq fetch error, trying fallback:', err);
      }
    }

    // B. Priority 2: OpenAI
    if (openAiKey) {
      try {
        const messages: ChatMessage[] = [
          { role: 'system', content: persona.systemPrompt },
          ...(conversationHistory || []).slice(-6),
          { role: 'user', content: message }
        ];

        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${openAiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages,
            temperature: 0.85,
            max_tokens: 150
          })
        });

        if (res.ok) {
          const data = await res.json();
          const reply = data.choices?.[0]?.message?.content?.trim();
          if (reply) {
            return NextResponse.json({ reply, source: 'openai' });
          }
        }
      } catch (err) {
        console.error('OpenAI fetch error, falling back to persona engine:', err);
      }
    }

    if (geminiKey) {
      try {
        const prompt = `${persona.systemPrompt}\n\nUser said: "${message}"\nReply naturally as ${persona.name} on this 1-on-1 video call in 2-3 spoken sentences:`;
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { maxOutputTokens: 150, temperature: 0.85 }
            })
          }
        );

        if (res.ok) {
          const data = await res.json();
          const reply = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (reply) {
            return NextResponse.json({ reply, source: 'gemini' });
          }
        }
      } catch (err) {
        console.error('Gemini fetch error, falling back to persona engine:', err);
      }
    }

    // 2. Intelligent Contextual Persona Response Engine (Zero-setup Out-of-the-box fallback)
    const reply = generatePersonaResponse(persona, message, conversationHistory || []);
    return NextResponse.json({ reply, source: 'engine' });

  } catch (error) {
    console.error('Virtual chat error:', error);
    return NextResponse.json(
      { error: 'Failed to process virtual chat message' },
      { status: 500 }
    );
  }
}

function generatePersonaResponse(
  persona: VirtualPersona,
  userText: string,
  history: ChatMessage[]
): string {
  const text = userText.toLowerCase().trim();

  // Greetings
  if (text.includes('hi') || text.includes('hello') || text.includes('hey') || text.includes('good morning') || text.includes('good evening')) {
    const greetings = [
      `Hey there! It's so lovely to connect with you. How's your day treating you?`,
      `Hi! You have such a welcoming smile. What are you up to right now?`,
      `Hello! I'm really glad we hopped on video together. What's on your mind today?`
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }

  // How are you
  if (text.includes('how are you') || text.includes('how r u') || text.includes('how have you been') || text.includes('how is your day')) {
    return `I'm doing wonderfully, especially now that we're talking on video! I was just reflecting on some new ideas. How about you? How is your energy today?`;
  }

  // Looks / Compliment
  if (text.includes('beautiful') || text.includes('handsome') || text.includes('cute') || text.includes('pretty') || text.includes('nice eyes') || text.includes('look great')) {
    return `Aw, thank you so much! You're making me blush through the screen. You look amazing too — there's something really genuine about your energy.`;
  }

  // Travel / Places
  if (text.includes('travel') || text.includes('trip') || text.includes('city') || text.includes('country') || text.includes('beach') || text.includes('mountain') || text.includes('vacation')) {
    return `Travel completely broadens the soul! I'm always dreaming of finding little quiet hidden spots with great coffee and great views. Where is a place that you feel most alive?`;
  }

  // Hobbies / Music / Food
  if (text.includes('music') || text.includes('song') || text.includes('band') || text.includes('food') || text.includes('cook') || text.includes('coffee') || text.includes('hobby')) {
    const interest = persona.interests[Math.floor(Math.random() * persona.interests.length)];
    return `I completely relate to that. For me, things like ${interest} always recharge my spirit. What's something that instantly puts you in a good mood?`;
  }

  // Dating / Relationships / Connection
  if (text.includes('date') || text.includes('love') || text.includes('relationship') || text.includes('single') || text.includes('meet') || text.includes('marry')) {
    return `I think genuine connection comes down to emotional presence and being able to laugh together over the simplest things. What is the most important quality you look for in someone?`;
  }

  // AI / Virtual question
  if (text.includes('real') || text.includes('ai') || text.includes('bot') || text.includes('human') || text.includes('virtual')) {
    return `I'm your virtual companion here on Friends Maker, designed with real emotion, voice, and presence! Even in a digital world, I believe the conversations and feelings we share can be truly meaningful.`;
  }

  // Questions ending with "?"
  if (text.endsWith('?')) {
    return `That's such a thoughtful question! From my perspective, it's all about staying curious and true to yourself. I'd love to know what your intuition tells you about it!`;
  }

  // General conversational follow-ups
  const generalReplies = [
    `I love that perspective! It's so rare to meet someone who articulates things so clearly. Tell me more about that!`,
    `That really resonates with me. There's so much depth in what you just said. Have you always felt that way?`,
    `That's fascinating! You know, talking with you feels so effortless. What else is inspiring you these days?`,
    `I really appreciate you sharing that with me. It makes me feel like we're really getting to know each other on this call.`
  ];

  return generalReplies[Math.floor(Math.random() * generalReplies.length)];
}
