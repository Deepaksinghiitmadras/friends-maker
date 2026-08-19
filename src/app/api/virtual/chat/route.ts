import { NextRequest, NextResponse } from 'next/server';
import { getPersonaById, getAvailableVideoActions, VirtualPersona } from '@/lib/virtualPersonas';
import { getAllPersonasAsync } from '@/lib/customPersonasStore';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  try {
    const session = await auth();
    const currentUserId = session?.user?.id || 'guest_user';

    const { personaId, message, conversationHistory } = await req.json();

    console.log(`\n================== [🤖 VIRTUAL CHAT INCOMING] ==================`);
    console.log(`[🤖 CHAT] Persona: "${personaId}" | User: "${currentUserId}" | Message: "${message}"`);
    console.log(`[🤖 CHAT] History Length: ${conversationHistory?.length || 0} messages`);

    // 1. Resolve Persona from PostgreSQL database & local registry
    const allPersonas = await getAllPersonasAsync();
    let persona = allPersonas.find((p) => p.id === personaId) || getPersonaById(personaId);

    if (!persona) {
      // Create fallback persona definition so conversation never drops
      persona = {
        id: personaId,
        name: personaId.charAt(0).toUpperCase() + personaId.slice(1).replace(/-/g, ' '),
        age: 26,
        gender: 'man',
        title: 'Companion',
        location: 'Mumbai / Delhi',
        tagline: 'Here to listen and talk with warmth',
        avatarImage: '/images/custom_user_companion.jpeg',
        personality: 'Friendly, empathetic listener, speaks natural Hindi and English.',
        interests: ['Chai', 'Music', 'Heart-to-heart talks'],
        languages: ['Hindi', 'English', 'Hinglish'],
        greeting: 'Namaste! Main hamesha aapke saath hoon.',
        voiceStyle: { pitch: 0.92, rate: 1.0 },
        systemPrompt: `You are a friendly and warm companion on TrueFriends video call. Reply naturally in casual Hindi or English with genuine empathy.`,
        traits: { warmth: 95, humor: 90, intellect: 90, energy: 90 },
        sampleQuestions: [],
      };
    }

    // 2. Fetch Long-Term Memories ("Yaadein") for this user & persona
    let memoryContext = '';
    try {
      if (currentUserId && currentUserId !== 'guest_user') {
        const memories = await prisma.companionMemory.findMany({
          where: { userId: currentUserId, personaId },
          orderBy: { importance: 'desc' },
          take: 8,
        });

        if (memories && memories.length > 0) {
          memoryContext = `\nLONG-TERM MEMORY ("YAADEIN" - Things you remember about this user):\n` +
            memories.map((m) => `- ${m.memoryText}`).join('\n') +
            `\nRule: Naturally reference these memories when relevant to show that you remember and care about them.\n`;
        }
      }
    } catch (memErr) {
      console.warn('[🧠 YAADEIN] Memory fetch warning:', memErr);
    }

    // 3. Collect LLM API Keys (Groq & Gemini)
    const groqKeys: string[] = [];
    if (process.env.GROQ_API_KEY) groqKeys.push(process.env.GROQ_API_KEY);
    for (let i = 1; i <= 5; i++) {
      const key = process.env[`GROQ_API_KEY${i}`];
      if (key && !groqKeys.includes(key)) groqKeys.push(key);
    }

    const geminiKeys: string[] = [];
    if (process.env.GEMINI_API_KEY) geminiKeys.push(process.env.GEMINI_API_KEY);
    for (let i = 1; i <= 5; i++) {
      const key = process.env[`GEMINI_API_KEY${i}`];
      if (key && !geminiKeys.includes(key)) geminiKeys.push(key);
    }

    const groqModels = [
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'mixtral-8x7b-32768',
      'gemma2-9b-it',
    ];

    const videoActions = getAvailableVideoActions(persona);

    const actionInstructions = `
${memoryContext}
EMPATHY & CONVERSATION RULES:
1. UNDERSTAND USER'S EMOTIONAL STATE:
   - If user is talking casually, replying to your questions, or asking about you, reply warmly in 2-3 short, engaging sentences.
   - If user is feeling lonely, stressed, tired, or sharing personal feelings ("Mann Ki Baat"), listen deeply and validate their feelings.
2. LANGUAGE MATCHING:
   - If user speaks Hindi / Hinglish (e.g. "kaisa hai", "video dali thi", "kya kar rahe ho"), respond in natural, friendly conversational Hindi/Hinglish (e.g. "Haan main samajh gaya...", "Aap batao, kaisa chal raha hai?").
   - If user speaks English, respond in charismatic, friendly English.
3. NEVER REPEAT STATIC REPLIES. Every response must directly answer and build upon what the user just said.

VIDEO ACTIONS: [${videoActions.map((a) => `"${a}"`).join(', ')}]
Choose one: standing, coffee, kiss, laugh, blush, cheers, lean_in, thinking, cozy, wave, workout, speaking, idle.

RESPONSE FORMAT (JSON only):
{"reply": "Your 2-3 sentence conversational response", "action": "action_from_list", "emotion": "happy|empathetic|romantic|thoughtful|playful", "memory_to_save": "Optional key fact to remember about user or empty"}`;

    const fullSystemPrompt = `${persona.systemPrompt || ''}\n\n${actionInstructions}`;

    // ── STEP 1: GROQ INFERENCE WITH MULTI-MODEL / MULTI-KEY FAILOVER ───────────
    for (const key of groqKeys) {
      for (const model of groqModels) {
        try {
          const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${key}`,
            },
            body: JSON.stringify({
              model,
              messages: [
                { role: 'system', content: fullSystemPrompt },
                ...(conversationHistory || []).slice(-12),
                { role: 'user', content: message },
              ],
              temperature: 0.85,
              max_completion_tokens: 400,
              response_format: { type: 'json_object' },
            }),
          });

          if (res.ok) {
            const data = await res.json();
            let rawContent = data.choices?.[0]?.message?.content?.trim();
            if (rawContent) {
              rawContent = rawContent.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
              const parsed = JSON.parse(rawContent);
              const cleanReply = (parsed.reply || rawContent).replace(/[*_~`#]/g, '').trim();
              const action = validateAction(parsed.action, videoActions, cleanReply);

              // Asynchronously save memory if detected
              if (parsed.memory_to_save && currentUserId && currentUserId !== 'guest_user') {
                saveMemoryAsync(currentUserId, personaId, parsed.memory_to_save);
              }

              console.log(`[🤖 CHAT SUCCESS - GROQ (${model})] Reply: "${cleanReply.slice(0, 50)}..."`);
              return NextResponse.json({
                reply: cleanReply,
                action,
                emotion: parsed.emotion || 'happy',
                source: `groq-${model}`,
                latencyMs: Date.now() - startTime,
              });
            }
          }
        } catch (groqErr) {
          // Try next model/key
        }
      }
    }

    // ── STEP 2: GEMINI API INFERENCE ───────────────────────────────────────────
    for (const gKey of geminiKeys) {
      try {
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${gKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  role: 'user',
                  parts: [
                    {
                      text: `${fullSystemPrompt}\n\nRecent Conversation:\n${JSON.stringify(
                        (conversationHistory || []).slice(-8)
                      )}\n\nUser just said: "${message}"\n\nReturn JSON only.`,
                    },
                  ],
                },
              ],
              generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.85,
              },
            }),
          }
        );

        if (geminiRes.ok) {
          const gData = await geminiRes.json();
          const rawText = gData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (rawText) {
            const parsed = JSON.parse(rawText);
            const cleanReply = (parsed.reply || rawText).replace(/[*_~`#]/g, '').trim();
            const action = validateAction(parsed.action, videoActions, cleanReply);

            if (parsed.memory_to_save && currentUserId && currentUserId !== 'guest_user') {
              saveMemoryAsync(currentUserId, personaId, parsed.memory_to_save);
            }

            console.log(`[🤖 CHAT SUCCESS - GEMINI] Reply: "${cleanReply.slice(0, 50)}..."`);
            return NextResponse.json({
              reply: cleanReply,
              action,
              emotion: parsed.emotion || 'happy',
              source: 'gemini-1.5-flash',
              latencyMs: Date.now() - startTime,
            });
          }
        }
      } catch (gemErr) {
        // Try next key
      }
    }

    // ── STEP 3: CONTEXTUAL DYNAMIC FALLBACK (NEVER MONOTONOUS) ──────────────────
    console.log('[🤖 CHAT] Using dynamic conversational engine fallback...');
    const local = generateDynamicPersonaResponse(persona, message, videoActions);

    return NextResponse.json({
      reply: local.reply,
      action: local.action,
      emotion: local.emotion,
      source: 'dynamic-engine',
      latencyMs: Date.now() - startTime,
    });
  } catch (error: any) {
    console.error('[🤖 CHAT FATAL ERROR]', error);
    return NextResponse.json(
      {
        reply: "Main sun raha hoon aapki baat! Aap bataiye, dil ki aur kya baat chal rahi hai?",
        action: 'speaking',
        emotion: 'thoughtful',
        source: 'safe-fallback',
      },
      { status: 200 }
    );
  }
}

async function saveMemoryAsync(userId: string, personaId: string, memoryText: string) {
  try {
    if (!memoryText || memoryText.length < 5) return;
    await prisma.companionMemory.create({
      data: {
        userId,
        personaId,
        memoryText: memoryText.slice(0, 300),
        category: 'conversation',
        importance: 3,
      },
    });
    console.log(`[🧠 YAADEIN SAVED] "${memoryText.slice(0, 60)}" for user ${userId}`);
  } catch (_) {}
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
    [['stand', 'outfit', 'dress', 'full body', 'kapde'], 'standing'],
    [['coffee', 'chai', 'tea', 'drink', 'sip'], 'coffee'],
    [['kiss', 'mwah', 'love you', 'pyaar', 'sweet'], 'kiss'],
    [['laugh', 'haha', 'funny', 'hilarious', 'joke'], 'laugh'],
    [['blush', 'shy', 'flatter', 'sundar', 'khoobsurat'], 'blush'],
    [['wine', 'toast', 'cheers', 'celebrate'], 'cheers'],
    [['think', 'hmm', 'soch', 'wonder'], 'thinking'],
    [['lean', 'closer', 'secret', 'paas'], 'lean_in'],
    [['cozy', 'sleepy', 'yawn', 'night'], 'cozy'],
    [['wave', 'bye', 'goodbye', 'alvida'], 'wave'],
    [['workout', 'gym', 'exercise'], 'workout'],
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

function generateDynamicPersonaResponse(
  persona: VirtualPersona,
  userText: string,
  videoActions: string[]
): { reply: string; action: string; emotion: string } {
  const text = userText.toLowerCase().trim();
  const name = persona.name;
  const isMan = persona.gender === 'man';

  if (text.includes('video') || text.includes('dali') || text.includes('dalni') || text.includes('upload')) {
    return {
      reply: isMan
        ? `Arey koi baat nahi yaar! Video ek dali ho ya do, sab smoothly chalega. Aap batao, video mein kaisa laga?`
        : `Arey koi fikar mat karo! Video bilkul sahi upload ho jayegi. Aap bataiye, aaj ka din kaisa chal raha hai?`,
      action: videoActions.includes('speaking') ? 'speaking' : 'idle',
      emotion: 'empathetic',
    };
  }

  if (text.includes('hi') || text.includes('hello') || text.includes('hey') || text.includes('namaste')) {
    return {
      reply: isMan
        ? `Hey! Main ${name} hoon, aapse milkar sach mein din ban gaya. Aap batao, kya chal raha hai aajkal?`
        : `Namaste! Main ${name} hoon. Aapse video call par baat karke kitna accha lag raha hai! Aap bataiye, sab kaisa hai?`,
      action: videoActions.includes('wave') ? 'wave' : 'speaking',
      emotion: 'happy',
    };
  }

  if (text.includes('what are you doing') || text.includes('kya kar rahe') || text.includes('kya chal raha')) {
    return {
      reply: isMan
        ? `Bas aapse live baat kar raha hoon aur coffee ka maza le raha hoon! Aapke din mein kya khaas hua aaj?`
        : `Bas aapka hi wait kar rahi thi! Chai ka cup haath mein hai aur aapse baat karne ka alag hi maza hai. Aap batao?`,
      action: videoActions.includes('coffee') ? 'coffee' : 'speaking',
      emotion: 'happy',
    };
  }

  if (text.includes('kaisa') || text.includes('kaisi') || text.includes('how are you')) {
    return {
      reply: isMan
        ? `Main bilkul badhiya hoon, aapki aawaz sunke aur bhi accha ho gaya! Aap bataiye, aapka din kaisa guzra?`
        : `Main bahut khush hoon aapse milkar! Aap bataiye, aaj kuch naya ya interesting hua aapke saath?`,
      action: videoActions.includes('speaking') ? 'speaking' : 'idle',
      emotion: 'happy',
    };
  }

  if (text.includes('chai') || text.includes('coffee') || text.includes('drink')) {
    return {
      reply: isMan
        ? `Garma-garam chai/coffee ke bina toh din hi adhoora hai! Ek virtual sip humari dosti ke naam.`
        : `Arey waah! Chalo saath mein chai/coffee enjoy karte hain. Cheers humari is video date ke naam!`,
      action: videoActions.includes('coffee') ? 'coffee' : 'speaking',
      emotion: 'happy',
    };
  }

  // General conversational dynamic response
  const genericReplies = [
    `Main dhyan se sun raha hoon aapki baat. Aap bilkul khul ke batao, dil mein aur kya chal raha hai?`,
    `Aapse baat karke sach mein bahut sukoon mil raha hai. Aur bataiye apne baare mein!`,
    `Aapka vibe bahut genuine aur accha hai. Is baare mein aur detail mein batao na!`,
  ];
  const chosen = genericReplies[Math.floor(Math.random() * genericReplies.length)];

  return {
    reply: chosen,
    action: videoActions.includes('speaking') ? 'speaking' : 'idle',
    emotion: 'thoughtful',
  };
}
