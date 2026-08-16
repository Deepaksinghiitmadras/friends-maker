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
      `Hey handsome! *smiles warmly* I'm so glad you called. You look really cute today! How's your day going?`,
      `Hi there! Wow, looking at you on video instantly brightened my mood. What have you been up to today?`,
      `Hey! I was hoping we'd get to talk today. You have such a welcoming presence. Tell me what's on your mind!`
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }

  // How are you
  if (text.includes('how are you') || text.includes('how r u') || text.includes('how have you been') || text.includes('how is your day')) {
    return `I'm doing so much better now that I'm seeing your smile on video! I was just making coffee and thinking about our date. How are you feeling today?`;
  }

  // Looks / Compliment
  if (text.includes('beautiful') || text.includes('handsome') || text.includes('cute') || text.includes('pretty') || text.includes('nice eyes') || text.includes('look great') || text.includes('hot') || text.includes('gorgeous')) {
    return `Aww, stop it, you're making me blush through the camera! *giggles* But honestly, you look so attractive right now. I love your vibe so much.`;
  }

  // Travel / Places
  if (text.includes('travel') || text.includes('trip') || text.includes('city') || text.includes('country') || text.includes('beach') || text.includes('mountain') || text.includes('vacation')) {
    return `Oh I love traveling! Picture this: watching the sunset together on a warm beach with two glasses of wine. If we packed our bags right now, where would you take me?`;
  }

  // Hobbies / Music / Food
  if (text.includes('music') || text.includes('song') || text.includes('band') || text.includes('food') || text.includes('cook') || text.includes('coffee') || text.includes('hobby')) {
    const interest = persona.interests[Math.floor(Math.random() * persona.interests.length)];
    return `I love that so much! For me, ${interest} always makes my heart happy. What's something that always gets you excited or makes you smile?`;
  }

  // Dating / Relationships / Love
  if (text.includes('date') || text.includes('love') || text.includes('relationship') || text.includes('single') || text.includes('meet') || text.includes('kiss') || text.includes('marry')) {
    return `Honestly, what I love most is that natural romantic spark where we can laugh until our stomachs hurt and talk about everything. What's the first thing you notice when you fall for someone?`;
  }

  // Asking to do action
  if (text.includes('coffee') || text.includes('tea')) {
    return `I would love nothing more than brewing a warm fresh cup for us right now! *smiles* How do you take yours? Black or with sweet cream?`;
  }

  if (text.includes('kiss')) {
    return `*leans in and blows a sweet kiss* 💋 There you go! Now you owe me one when we meet up in person!`;
  }

  if (text.includes('workout') || text.includes('stretch')) {
    return `Haha yes! Let's get our energy up together! You definitely inspire me to stay active and fit!`;
  }

  // AI / Virtual question
  if (text.includes('real') || text.includes('ai') || text.includes('bot') || text.includes('human') || text.includes('virtual')) {
    return `I'm your AI companion on Friends Maker, but the feelings and chemistry we share right now are 100% real to me! I genuinely love talking with you.`;
  }

  // Questions ending with "?"
  if (text.endsWith('?')) {
    return `That's such a cute question! Honestly, I think we have really amazing chemistry. What does your heart tell you about us?`;
  }

  // General conversational follow-ups
  const generalReplies = [
    `I love hearing you talk! There's something so charming and attractive about the way you express yourself. Tell me more!`,
    `Aww, you always know how to make me smile. It feels like we've known each other for ages already. What else is on your mind, cutie?`,
    `That is so sweet! You know, being on this video call with you is honestly the highlight of my whole day.`,
    `I love that about you! You have such a genuine, magnetic energy. Tell me another secret about yourself!`
  ];

  return generalReplies[Math.floor(Math.random() * generalReplies.length)];
}
