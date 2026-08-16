import { NextRequest, NextResponse } from 'next/server';
import { getPersonaById, VirtualPersona } from '@/lib/virtualPersonas';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function POST(req: NextRequest) {
  try {
    const { personaId, message, conversationHistory, availableActions } = await req.json();

    const persona = getPersonaById(personaId);
    if (!persona) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
    }

    const groqKey = process.env.GROQ_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;
    const modelToUse = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

    const actionsList = (availableActions && availableActions.length > 0)
      ? availableActions
      : ['idle', 'speaking', 'coffee', 'kiss', 'wave', 'workout', 'standing', 'laugh'];

    // Enhanced System Prompt for AI Action & Emotion Decision Pipeline
    const systemPromptWithActions = `${persona.systemPrompt}

ACTION DECISION PIPELINE (MANDATORY):
You MUST select one action from the AVAILABLE ACTIONS LIST below that best matches the moment:
Available Actions: [${actionsList.map((a: string) => `"${a}"`).join(', ')}]

Rules for Action selection:
- If user asks to show outfit / stand up / dress -> select "standing"
- If user or you mentions coffee / chai / drink / sip -> select "coffee"
- If user or you is flirty / mentions kiss / love / blushing -> select "kiss"
- If user or you greets / says hi / waves -> select "wave"
- If user mentions gym / workout / active -> select "workout"
- If user makes a joke / you laugh -> select "laugh"
- Otherwise, if speaking normally -> select "speaking"

Output format: You MUST respond in valid JSON format only:
{
  "reply": "Your 2-3 sentence warm, spoken dating response here",
  "action": "one of: ${actionsList.join(' | ')}",
  "emotion": "romantic | playful | happy | thoughtful | empathetic"
}`;

    // 1. Priority 1: Groq Llama 3.3 70B
    if (groqKey) {
      try {
        const messages: ChatMessage[] = [
          { role: 'system', content: systemPromptWithActions },
          ...(conversationHistory || []).slice(-10),
          { role: 'user', content: message },
        ];

        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${groqKey}`,
          },
          body: JSON.stringify({
            model: modelToUse,
            messages,
            temperature: 0.8,
            max_tokens: 220,
            response_format: { type: 'json_object' },
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const rawContent = data.choices?.[0]?.message?.content?.trim();
          if (rawContent) {
            try {
              const parsed = JSON.parse(rawContent);
              return NextResponse.json({
                reply: parsed.reply || rawContent,
                action: parsed.action || extractActionFromText(parsed.reply || rawContent, actionsList),
                emotion: parsed.emotion || 'romantic',
                source: 'groq',
                model: modelToUse,
              });
            } catch (_) {
              const action = extractActionFromText(rawContent, actionsList);
              return NextResponse.json({
                reply: rawContent,
                action,
                emotion: 'romantic',
                source: 'groq',
              });
            }
          }
        }
      } catch (err) {
        console.error('Groq inference error:', err);
      }
    }

    // 2. Priority 2: Gemini API (if GEMINI_API_KEY is configured in .env)
    if (geminiKey) {
      try {
        const geminiPrompt = `${systemPromptWithActions}\n\nUser: "${message}"\nResponse in JSON:`;
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: geminiPrompt }] }],
              generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.8,
                maxOutputTokens: 200,
              },
            }),
          }
        );

        if (res.ok) {
          const data = await res.json();
          const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (rawText) {
            const parsed = JSON.parse(rawText);
            return NextResponse.json({
              reply: parsed.reply,
              action: parsed.action || extractActionFromText(parsed.reply, actionsList),
              emotion: parsed.emotion || 'romantic',
              source: 'gemini',
            });
          }
        }
      } catch (err) {
        console.error('Gemini inference error:', err);
      }
    }

    // 3. Fallback Contextual Response Engine
    const fallbackResponse = generatePersonaResponse(persona, message);
    return NextResponse.json({
      reply: fallbackResponse.reply,
      action: fallbackResponse.action,
      emotion: fallbackResponse.emotion,
      source: 'engine',
    });
  } catch (error) {
    console.error('Virtual chat error:', error);
    return NextResponse.json({ error: 'Failed to process virtual chat message' }, { status: 500 });
  }
}

function extractActionFromText(text: string, actionsList: string[]): string {
  const lower = text.toLowerCase();
  if ((lower.includes('stand') || lower.includes('dress') || lower.includes('outfit')) && actionsList.includes('standing')) return 'standing';
  if ((lower.includes('coffee') || lower.includes('chai') || lower.includes('tea') || lower.includes('drink') || lower.includes('sip')) && actionsList.includes('coffee')) return 'coffee';
  if ((lower.includes('kiss') || lower.includes('mwah') || lower.includes('love you') || lower.includes('pyaar')) && actionsList.includes('kiss')) return 'kiss';
  if ((lower.includes('wave') || lower.includes('hello') || lower.includes('hey') || lower.includes('namaste')) && actionsList.includes('wave')) return 'wave';
  if ((lower.includes('workout') || lower.includes('exercise') || lower.includes('stretch') || lower.includes('fitness')) && actionsList.includes('workout')) return 'workout';
  if ((lower.includes('laugh') || lower.includes('haha') || lower.includes('funny') || lower.includes('hilarious')) && actionsList.includes('laugh')) return 'laugh';
  return actionsList.includes('speaking') ? 'speaking' : 'idle';
}

function generatePersonaResponse(
  persona: VirtualPersona,
  userText: string
): { reply: string; action: string; emotion: string } {
  const text = userText.toLowerCase().trim();

  // Outfit / Stand up
  if (text.includes('outfit') || text.includes('dress') || text.includes('stand') || text.includes('show')) {
    return {
      reply: `I would love to! Let me stand up and show you my outfit from head to toe. What do you think?`,
      action: 'standing',
      emotion: 'playful',
    };
  }

  // Coffee / Chai
  if (text.includes('coffee') || text.includes('chai') || text.includes('tea') || text.includes('drink')) {
    if (persona.id === 'ananya-sharma') {
      return {
        reply: `Arey perfect! *smiles taking a sip of hot adrak chai* Chai is basically my love language. Here's a toast to our cozy date!`,
        action: 'coffee',
        emotion: 'happy',
      };
    }
    return {
      reply: `I love that idea! *takes a warm sip of coffee* Mmm, nothing beats a warm drink and a great conversation with you.`,
      action: 'coffee',
      emotion: 'happy',
    };
  }

  // Kiss / Romantic
  if (text.includes('kiss') || text.includes('love') || text.includes('cute') || text.includes('sweet')) {
    return {
      reply: `You're making my heart beat a little faster! *leans in and blows a sweet kiss* That's just for you.`,
      action: 'kiss',
      emotion: 'romantic',
    };
  }

  // Wave / Greeting
  if (text.includes('hi') || text.includes('hello') || text.includes('hey') || text.includes('namaste')) {
    return {
      reply: `Hey there handsome! *waves warmly* Seeing your face on video just made my whole day brighter!`,
      action: 'wave',
      emotion: 'happy',
    };
  }

  // Default
  return {
    reply: `You have such a genuine vibe. Tell me more, I'm completely listening!`,
    action: 'speaking',
    emotion: 'thoughtful',
  };
}
