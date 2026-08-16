import { NextRequest, NextResponse } from 'next/server';
import { getPersonaById, getAvailableVideoActions, VirtualPersona } from '@/lib/virtualPersonas';

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

    const groqKey = process.env.GROQ_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;
    const modelToUse = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

    // Get actual available video file names from persona config
    const videoActions = getAvailableVideoActions(persona);

    // Build the action instruction with explicit video file → trigger mapping
    const actionInstructions = `
VIDEO ACTION SYSTEM (CRITICAL - YOU MUST FOLLOW):
You have access to pre-recorded video clips. For EVERY response, you MUST pick the single best-matching video action.

AVAILABLE VIDEO FILES: [${videoActions.map(a => `"${a}"`).join(', ')}]

ACTION SELECTION RULES (check in order, pick FIRST match):
- User asks to see outfit / stand up / full body / dress / what you wearing → "standing"
- User or you mentions coffee / chai / tea / drink / sip / brew → "coffee"  
- User or you mentions kiss / love you / mwah / blow kiss / pyaar → "kiss"
- User makes a joke / you laugh / haha / funny / hilarious → "laugh"
- User gives a sweet compliment / flattery / you get shy → "blush"
- User or you mentions wine / toast / cheers / celebrate / champagne → "cheers"
- User asks deep/thoughtful question / you need to think → "thinking"
- User wants intimacy / you lean closer / whisper / secret → "lean_in"
- User mentions cozy / sleepy / yawn / late night / cold → "cozy"
- User greets / says hi / hello / hey / waves / namaste → "wave"
- User mentions gym / workout / exercise / stretch / fitness → "workout"
- If NONE of the above match, but you are speaking → "speaking"
- Last resort → "idle"

RESPONSE FORMAT (valid JSON only, nothing else):
{"reply": "Your 2-3 sentence warm dating response", "action": "one_action_from_list_above", "emotion": "romantic|playful|happy|thoughtful|empathetic"}`;

    const fullSystemPrompt = `${persona.systemPrompt}\n\n${actionInstructions}`;

    // 1. Priority 1: Groq Llama 3.3 70B
    if (groqKey) {
      try {
        const messages: ChatMessage[] = [
          { role: 'system', content: fullSystemPrompt },
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
            max_tokens: 250,
            response_format: { type: 'json_object' },
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const rawContent = data.choices?.[0]?.message?.content?.trim();
          if (rawContent) {
            try {
              const parsed = JSON.parse(rawContent);
              const action = validateAction(parsed.action, videoActions, parsed.reply || rawContent);
              console.log(`[CHAT] AI replied with action="${action}" for message="${message}"`);
              return NextResponse.json({
                reply: parsed.reply || rawContent,
                action,
                emotion: parsed.emotion || 'romantic',
                source: 'groq',
                model: modelToUse,
              });
            } catch (_) {
              const action = extractActionFromText(rawContent, videoActions);
              console.log(`[CHAT] JSON parse fallback, extracted action="${action}"`);
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

    // 2. Priority 2: Gemini API
    if (geminiKey) {
      try {
        const geminiPrompt = `${fullSystemPrompt}\n\nUser: "${message}"\nResponse in JSON:`;
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
                maxOutputTokens: 250,
              },
            }),
          }
        );

        if (res.ok) {
          const data = await res.json();
          const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (rawText) {
            const parsed = JSON.parse(rawText);
            const action = validateAction(parsed.action, videoActions, parsed.reply);
            return NextResponse.json({
              reply: parsed.reply,
              action,
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
    const fallbackResponse = generatePersonaResponse(persona, message, videoActions);
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

/**
 * Validates the AI-returned action against available video files.
 * Falls back to text extraction if the action doesn't exist.
 */
function validateAction(aiAction: string | undefined, videoActions: string[], replyText: string): string {
  if (aiAction && videoActions.includes(aiAction)) {
    return aiAction;
  }
  // AI returned an action that doesn't exist as a video file - extract from text
  return extractActionFromText(replyText || '', videoActions);
}

function extractActionFromText(text: string, videoActions: string[]): string {
  const lower = text.toLowerCase();
  
  const rules: [string[], string][] = [
    [['stand', 'outfit', 'dress', 'full body', 'what.*wearing', 'show me'], 'standing'],
    [['coffee', 'chai', 'tea', 'drink', 'brew', 'sip'], 'coffee'],
    [['kiss', 'mwah', 'love you', 'pyaar', 'blow'], 'kiss'],
    [['laugh', 'haha', 'funny', 'hilarious', 'lol', 'joke'], 'laugh'],
    [['blush', 'shy', 'flatter', 'compliment', 'sweet of you'], 'blush'],
    [['wine', 'toast', 'cheers', 'champagne', 'celebrate'], 'cheers'],
    [['think', 'hmm', 'ponder', 'curious', 'wonder'], 'thinking'],
    [['lean', 'closer', 'whisper', 'secret', 'intimate'], 'lean_in'],
    [['cozy', 'sleepy', 'yawn', 'cold', 'snuggle', 'sweater'], 'cozy'],
    [['wave', 'hello', 'hey', 'namaste', 'hi there'], 'wave'],
    [['workout', 'exercise', 'stretch', 'fitness', 'gym'], 'workout'],
  ];
  
  for (const [keywords, action] of rules) {
    if (videoActions.includes(action)) {
      for (const kw of keywords) {
        if (lower.includes(kw)) return action;
      }
    }
  }
  
  return videoActions.includes('speaking') ? 'speaking' : 'idle';
}

function generatePersonaResponse(
  persona: VirtualPersona,
  userText: string,
  videoActions: string[]
): { reply: string; action: string; emotion: string } {
  const text = userText.toLowerCase().trim();

  if (text.includes('outfit') || text.includes('dress') || text.includes('stand') || text.includes('show')) {
    return {
      reply: `I would love to! Let me stand up and show you my outfit from head to toe. What do you think?`,
      action: videoActions.includes('standing') ? 'standing' : 'speaking',
      emotion: 'playful',
    };
  }

  if (text.includes('coffee') || text.includes('chai') || text.includes('tea') || text.includes('drink')) {
    return {
      reply: persona.id === 'ananya-sharma'
        ? `Arey perfect! *smiles taking a sip of hot adrak chai* Chai is basically my love language. Here's a toast to our cozy date!`
        : `I love that idea! *takes a warm sip of coffee* Mmm, nothing beats a warm drink and great conversation with you.`,
      action: videoActions.includes('coffee') ? 'coffee' : 'speaking',
      emotion: 'happy',
    };
  }

  if (text.includes('kiss') || text.includes('love') || text.includes('cute') || text.includes('sweet')) {
    return {
      reply: `You're making my heart beat a little faster! *leans in and blows a sweet kiss* That's just for you.`,
      action: videoActions.includes('kiss') ? 'kiss' : 'speaking',
      emotion: 'romantic',
    };
  }

  if (text.includes('hi') || text.includes('hello') || text.includes('hey') || text.includes('namaste')) {
    return {
      reply: `Hey there handsome! *waves warmly* Seeing your face on video just made my whole day brighter!`,
      action: videoActions.includes('wave') ? 'wave' : 'speaking',
      emotion: 'happy',
    };
  }

  return {
    reply: `You have such a genuine vibe. Tell me more, I'm completely listening!`,
    action: 'speaking',
    emotion: 'thoughtful',
  };
}
