import { NextRequest, NextResponse } from 'next/server';
import { getPersonaById, getAvailableVideoActions, VirtualPersona } from '@/lib/virtualPersonas';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  try {
    const { personaId, message, conversationHistory } = await req.json();

    console.log(`\n================== [🤖 VIRTUAL CHAT INCOMING] ==================`);
    console.log(`[🤖 CHAT] Persona: "${personaId}" | Message: "${message}"`);
    console.log(`[🤖 CHAT] History Length: ${conversationHistory?.length || 0} messages`);

    const persona = getPersonaById(personaId);
    if (!persona) {
      console.error(`[🤖 CHAT ERROR] Persona "${personaId}" not found`);
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
    }

    // Collect all available Groq API keys for automatic failover
    const groqKeys: string[] = [];
    if (process.env.GROQ_API_KEY) groqKeys.push(process.env.GROQ_API_KEY);
    for (let i = 1; i <= 10; i++) {
      const key = process.env[`GROQ_API_KEY${i}`];
      if (key && !groqKeys.includes(key)) groqKeys.push(key);
    }
    if (process.env.GROQ_API_KEYS) {
      const split = process.env.GROQ_API_KEYS.split(',').map((k) => k.trim()).filter(Boolean);
      for (const k of split) {
        if (!groqKeys.includes(k)) groqKeys.push(k);
      }
    }

    const modelToUse = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

    // Get actual available video file names from persona config
    const videoActions = getAvailableVideoActions(persona);
    console.log(`[🤖 CHAT] Available video actions: [${videoActions.join(', ')}]`);
    console.log(`[🤖 CHAT] Loaded ${groqKeys.length} Groq API key(s) in failover pool`);

    // Build the action instruction with explicit video file → trigger mapping
    const actionInstructions = `
EMPATHY & CONVERSATION RULES (CRITICAL):
1. UNDERSTAND USER'S PURPOSE & EMOTIONAL STATE:
   - "Mann Ki Baat" / Venting / Loneliness: If the user is tired, stressed, feeling lonely, sharing personal problems, or seeking comfort, be deeply empathetic and gentle. Validate their emotions (e.g. "Main samajh sakti hoon, kabhi kabhi dil halka karna zaroori hota hai... main hamesha yahin hoon aapke liye").
   - Romance / Dating: If the user is flirty, playful, or charming, respond with sweet romantic banter, blushes, and warmth.
   - Deep Philosophy / Curiosity: If the user asks deep questions, engage thoughtfully.
2. CONTEXT AWARENESS: You are provided with the recent conversation history. Actively reference previous things the user shared in this call so the date feels real and continuous.
3. LANGUAGE MATCHING: Match the user's language seamlessly (Hindi, English, Hinglish, or any regional/foreign language).

VIDEO ACTION SYSTEM:
You have access to pre-recorded video clips. For EVERY response, pick the single best-matching video action.

AVAILABLE VIDEO FILES: [${videoActions.map(a => `"${a}"`).join(', ')}]

ACTION SELECTION RULES (check in order, pick FIRST match):
- User asks to see outfit / stand up / full body / dress / what you wearing → "standing"
- User or you mentions coffee / chai / tea / drink / sip / brew → "coffee"  
- User or you mentions kiss / love you / mwah / blow kiss / pyaar / cute → "kiss"
- User makes a joke / you laugh / haha / funny / hilarious → "laugh"
- User gives a sweet compliment / flattery / you get shy / blush → "blush"
- User or you mentions wine / toast / cheers / celebrate / champagne → "cheers"
- User shares deep feelings / needs comfort / you listen closely / intimacy → "lean_in"
- User asks deep/thoughtful question / you need to think / ponder → "thinking"
- User mentions cozy / sleepy / yawn / late night / cold → "cozy"
- User explicitly says goodbye / bye / wave / waves → "wave"
- User mentions gym / workout / exercise / stretch / fitness → "workout"
- Default for all regular conversation, empathetic listening, or talking → "speaking"
- Last resort → "idle"

RESPONSE FORMAT (valid JSON only, nothing else):
{"reply": "Your 2-3 sentence warm empathetic or dating response", "action": "one_action_from_list_above", "emotion": "romantic|playful|happy|thoughtful|empathetic"}`;

    const fullSystemPrompt = `${persona.systemPrompt}\n\n${actionInstructions}`;

    // 1. Priority 1: Groq High-Speed Inference with Automatic Multi-Key Failover
    if (groqKeys.length > 0) {
      const messages: ChatMessage[] = [
        { role: 'system', content: fullSystemPrompt },
        ...(conversationHistory || []).slice(-16),
        { role: 'user', content: message },
      ];

      for (let keyIndex = 0; keyIndex < groqKeys.length; keyIndex++) {
        const currentKey = groqKeys[keyIndex];
        const keyMasked = `${currentKey.slice(0, 6)}...${currentKey.slice(-4)}`;
        try {
          console.log(`[🤖 CHAT] Attempting Groq inference with key #${keyIndex + 1} (${keyMasked}) and model "${modelToUse}"...`);
          const groqStart = Date.now();
          const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${currentKey}`,
            },
            body: JSON.stringify({
              model: modelToUse,
              messages,
              temperature: 0.8,
              max_completion_tokens: 1000,
              response_format: { type: 'json_object' },
            }),
          });

          const groqDuration = Date.now() - groqStart;

          if (res.ok) {
            const data = await res.json();
            let rawContent = data.choices?.[0]?.message?.content?.trim();
            if (rawContent) {
              rawContent = rawContent.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
              try {
                const parsed = JSON.parse(rawContent);
                const cleanReply = (parsed.reply || rawContent).replace(/[*_~`]/g, '').trim();
                const action = validateAction(parsed.action, videoActions, cleanReply);
                console.log(`[🤖 CHAT SUCCESS - GROQ (Key #${keyIndex + 1})] Time: ${groqDuration}ms | Action: "${action}" | Emotion: "${parsed.emotion}"`);
                return NextResponse.json({
                  reply: cleanReply,
                  action,
                  emotion: parsed.emotion || 'romantic',
                  source: `groq-key-${keyIndex + 1}`,
                  model: modelToUse,
                  latencyMs: Date.now() - startTime,
                });
              } catch (jsonErr) {
                const cleanReply = rawContent.replace(/[*_~`]/g, '').trim();
                const action = extractActionFromText(cleanReply, videoActions);
                return NextResponse.json({
                  reply: cleanReply,
                  action,
                  emotion: 'romantic',
                  source: `groq-key-${keyIndex + 1}`,
                  latencyMs: Date.now() - startTime,
                });
              }
            }
          } else {
            const errBody = await res.text();
            console.warn(`[🤖 CHAT GROQ WARNING] Key #${keyIndex + 1} failed (Status: ${res.status}). Body: ${errBody}`);
            // If rate limited (429) or unauthorized (401) or other, try next key in pool
            if (keyIndex < groqKeys.length - 1) {
              console.log(`[🤖 CHAT] Switching to fallback key #${keyIndex + 2}...`);
              continue;
            }
          }
        } catch (err) {
          console.error(`[🤖 CHAT GROQ ERROR] Key #${keyIndex + 1} threw error:`, err);
          if (keyIndex < groqKeys.length - 1) {
            console.log(`[🤖 CHAT] Switching to fallback key #${keyIndex + 2}...`);
            continue;
          }
        }
      }
    }

    // 2. Local Contextual Response Engine
    console.log('[🤖 CHAT] Using local persona contextual response engine fallback...');
    const local = generatePersonaResponse(persona, message, videoActions);
    console.log(`[🤖 CHAT SUCCESS - LOCAL ENGINE] Action: "${local.action}"`);

    return NextResponse.json({
      reply: local.reply,
      action: local.action,
      emotion: local.emotion,
      source: 'engine',
      latencyMs: Date.now() - startTime,
    });
  } catch (error) {
    console.error('[🤖 CHAT FATAL ERROR]', error);
    return NextResponse.json({ error: 'Failed to process virtual chat message' }, { status: 500 });
  }
}

function validateAction(aiAction: string | undefined, videoActions: string[], replyText: string): string {
  if (aiAction && videoActions.includes(aiAction)) {
    return aiAction;
  }
  return extractActionFromText(replyText || '', videoActions);
}

function extractActionFromText(text: string, videoActions: string[]): string {
  const lower = text.toLowerCase();
  
  const rules: [string[], string][] = [
    [['stand', 'outfit', 'dress', 'full body', 'what.*wearing', 'show me'], 'standing'],
    [['coffee', 'chai', 'tea', 'drink', 'brew', 'sip'], 'coffee'],
    [['kiss', 'mwah', 'love you', 'pyaar', 'blow', 'cute'], 'kiss'],
    [['laugh', 'haha', 'funny', 'hilarious', 'lol', 'joke'], 'laugh'],
    [['blush', 'shy', 'flatter', 'compliment', 'sweet of you', 'sundar', 'khoobsurat'], 'blush'],
    [['wine', 'toast', 'cheers', 'champagne', 'celebrate'], 'cheers'],
    [['think', 'hmm', 'ponder', 'curious', 'wonder', 'soch'], 'thinking'],
    [['lean', 'closer', 'whisper', 'secret', 'intimate', 'paas'], 'lean_in'],
    [['cozy', 'sleepy', 'yawn', 'cold', 'snuggle', 'sweater'], 'cozy'],
    [['wave', 'bye', 'goodbye', 'alvida', 'tata'], 'wave'],
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

  if (text.includes('outfit') || text.includes('dress') || text.includes('stand') || text.includes('show') || text.includes('kapde')) {
    return {
      reply: persona.id === 'ananya-sharma'
        ? "Bilkul! Main khadi hoke apna pura traditional outfit dikhati hoon. Batana kaisa lag raha hai!"
        : "I would love to! Let me stand up and show you my outfit from head to toe. What do you think?",
      action: videoActions.includes('standing') ? 'standing' : 'speaking',
      emotion: 'playful',
    };
  }

  if (text.includes('coffee') || text.includes('chai') || text.includes('tea') || text.includes('drink')) {
    return {
      reply: persona.id === 'ananya-sharma'
        ? "Arey perfect! Ek garma-garam masala chai ka sip leke baat karne ka maza hi alag hai. Cheers humari video date ke naam!"
        : "I love that idea! *takes a warm sip of coffee* Mmm, nothing beats a warm drink and great conversation with you.",
      action: videoActions.includes('coffee') ? 'coffee' : 'speaking',
      emotion: 'happy',
    };
  }

  if (text.includes('sundar') || text.includes('khoobsurat') || text.includes('beautiful') || text.includes('gorgeous') || text.includes('pretty') || text.includes('cute')) {
    return {
      reply: persona.id === 'ananya-sharma'
        ? "Arey shukriya! Aapne toh mujhe sach mein blush karwa diya. Waise aap bhi video par bahut handsome lag rahe ho!"
        : "Aww, you're making me blush! You're looking exceptionally handsome today too.",
      action: videoActions.includes('blush') ? 'blush' : 'speaking',
      emotion: 'romantic',
    };
  }

  if (text.includes('kiss') || text.includes('love') || text.includes('pyaar') || text.includes('sweet')) {
    return {
      reply: persona.id === 'ananya-sharma'
        ? "Aapke saath baat karke mera dil khush ho gaya! Ye chhota sa sweet flying kiss sirf aapke liye."
        : "You're making my heart beat a little faster! *leans in and blows a sweet kiss* That's just for you.",
      action: videoActions.includes('kiss') ? 'kiss' : 'speaking',
      emotion: 'romantic',
    };
  }

  return {
    reply: persona.id === 'ananya-sharma'
      ? "Aapse baat karke bahut accha lag raha hai! Aur bataiye, aapke shauk kya hain? Mujhe aapke baare mein aur jaan-na hai."
      : "You have such a genuine vibe. Tell me more, I'm completely listening!",
    action: 'speaking',
    emotion: 'thoughtful',
  };
}
