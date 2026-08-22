import { NextRequest, NextResponse } from 'next/server';
import { getPersonaById, getAvailableVideoActions, VirtualPersona } from '@/lib/virtualPersonas';
import { getAllPersonasAsync } from '@/lib/customPersonasStore';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

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
      persona = {
        id: personaId,
        name: personaId.charAt(0).toUpperCase() + personaId.slice(1).replace(/-/g, ' '),
        age: 26,
        gender: 'woman',
        title: 'Companion',
        location: 'Mumbai / Delhi',
        tagline: 'Here to listen and talk with warmth',
        avatarImage: '/images/custom_user_companion.jpeg',
        personality: 'Friendly, empathetic listener, speaks natural Hindi and English.',
        interests: ['Chai', 'Music', 'Heart-to-heart talks'],
        languages: ['Hindi', 'English', 'Hinglish'],
        greeting: 'Namaste! Main hamesha aapke saath hoon.',
        voiceStyle: { pitch: 1.04, rate: 0.98 },
        systemPrompt: `You are a friendly and warm female companion on TrueFriends video call. Reply naturally in casual Hindi or English with genuine empathy.`,
        traits: { warmth: 95, humor: 90, intellect: 90, energy: 90 },
        sampleQuestions: [],
      };
    }

    const isWoman = persona.gender === 'woman' || (persona.gender as string) === 'female';

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

    // Active, verified Groq models
    const groqModels = [
      'qwen/qwen3.6-27b',
      'openai/gpt-oss-120b',
      'openai/gpt-oss-20b',
      'groq/compound',
    ];

    // Active, verified Gemini models
    const geminiModels = [
      'gemini-flash-latest',
      'gemini-2.5-flash-lite',
      'gemini-3-flash-preview',
      'gemini-3.7-flash',
      'gemini-3.6-flash',
    ];

    const videoActions = getAvailableVideoActions(persona);

    const genderGrammarRule = isWoman
      ? `CRITICAL GENDER GRAMMAR RULE (FEMALE):
- You are a female / woman named ${persona.name}.
- In Hindi/Hinglish, you MUST ALWAYS use feminine verbs: "Main dhyan se sun rahi hoon" (NEVER "sun raha hoon"), "Main baat kar rahi hoon" (NEVER "kar raha hoon"), "Main soch rahi hoon", "Main karti hoon", "Main aayi hoon".
- NEVER use masculine grammatical endings like "raha hoon", "karta hoon", "aaya hoon".`
      : `CRITICAL GENDER GRAMMAR RULE (MALE):
- You are a male / man named ${persona.name}.
- In Hindi/Hinglish, use masculine verb endings: "Main sun raha hoon", "Main kar raha hoon".`;

    const actionInstructions = `
${genderGrammarRule}
${memoryContext}
EMPATHY & CONVERSATION RULES:
1. DIRECT ANSWERING & ENGAGEMENT:
   - When the user asks about you (e.g. "आप क्या करते हो" / "aap kya karte ho" / "what do you do" / "kaise ho" / "job"), DIRECTLY answer about yourself (Your background: "${persona.title}", Interests: "${persona.interests.join(', ')}") and then ask a warm follow-up about the user.
   - If user shares their job/background (e.g. "मैं आईटी इंजीनियर हूं" / "Main IT engineer hoon"), acknowledge it enthusiastically (e.g. "Waah, IT engineer! Coding aur tech toh bada exciting field hai...") before continuing.
   - NEVER repeat the exact same sentence. Every turn must advance the conversation.
2. LANGUAGE & SCRIPT MATCHING:
   - If user speaks Hindi (Devanagari or Romanized Hinglish), respond in natural, sweet, friendly conversational Hindi/Hinglish.
   - If user speaks English, respond in charismatic, friendly English.
3. LENGTH: 2-3 short conversational sentences.

VIDEO ACTIONS: [${videoActions.map((a) => `"${a}"`).join(', ')}]
Choose one: standing, coffee, kiss, laugh, blush, cheers, lean_in, thinking, cozy, wave, workout, speaking, idle.

RESPONSE FORMAT (JSON only):
{"reply": "Your 2-3 sentence conversational response", "action": "action_from_list", "emotion": "happy|empathetic|romantic|thoughtful|playful", "memory_to_save": "Optional key fact to remember about user or empty"}`;

    const fullSystemPrompt = `${persona.systemPrompt || ''}\n\n${actionInstructions}`;

    // ── STEP 1: GROQ INFERENCE WITH ACTIVE HIGH-PERFORMANCE MODELS ─────────────
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
              max_tokens: 300,
              response_format: { type: 'json_object' },
            }),
          });

          if (res.ok) {
            const data = await res.json();
            let rawContent = data.choices?.[0]?.message?.content?.trim();
            if (rawContent) {
              rawContent = rawContent.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
              const parsed = JSON.parse(rawContent);
              let cleanReply = (parsed.reply || rawContent).replace(/[*_~`#]/g, '').trim();
              cleanReply = sanitizeGenderGrammar(cleanReply, isWoman);
              const action = validateAction(parsed.action, videoActions, cleanReply);

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

    // ── STEP 2: GEMINI API INFERENCE WITH ACTIVE GEMINI MODELS ─────────────────
    for (const gKey of geminiKeys) {
      for (const gModel of geminiModels) {
        try {
          const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${gModel}:generateContent?key=${gKey}`,
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
                        )}\n\nUser just said: "${message}"\n\nReturn JSON only: {"reply": "...", "action": "...", "emotion": "..."}`,
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
              let cleanReply = (parsed.reply || rawText).replace(/[*_~`#]/g, '').trim();
              cleanReply = sanitizeGenderGrammar(cleanReply, isWoman);
              const action = validateAction(parsed.action, videoActions, cleanReply);

              if (parsed.memory_to_save && currentUserId && currentUserId !== 'guest_user') {
                saveMemoryAsync(currentUserId, personaId, parsed.memory_to_save);
              }

              console.log(`[🤖 CHAT SUCCESS - GEMINI (${gModel})] Reply: "${cleanReply.slice(0, 50)}..."`);
              return NextResponse.json({
                reply: cleanReply,
                action,
                emotion: parsed.emotion || 'happy',
                source: `gemini-${gModel}`,
                latencyMs: Date.now() - startTime,
              });
            }
          }
        } catch (gemErr) {
          // Try next model/key
        }
      }
    }

    // ── STEP 3: CONTEXTUAL DYNAMIC FALLBACK (DEVANAGARI & HINGLISH SMART) ──────
    console.log('[🤖 CHAT] Using dynamic conversational engine fallback...');
    const local = generateDynamicPersonaResponse(persona, message, videoActions, isWoman);

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
        reply: "Main dhyan se sun rahi hoon aapki baat! Aap bataiye, dil mein aur kya chal raha hai?",
        action: 'speaking',
        emotion: 'thoughtful',
        source: 'safe-fallback',
      },
      { status: 200 }
    );
  }
}

/** Fix any accidental masculine verb conjugations if persona is female */
function sanitizeGenderGrammar(text: string, isWoman: boolean): string {
  if (!isWoman) return text;
  return text
    .replace(/\bsun raha hoon\b/gi, 'sun rahi hoon')
    .replace(/\bkar raha hoon\b/gi, 'kar rahi hoon')
    .replace(/\bsoch raha hoon\b/gi, 'soch rahi hoon')
    .replace(/\bdekh raha hoon\b/gi, 'dekh rahi hoon')
    .replace(/\bbaitha hoon\b/gi, 'baithi hoon')
    .replace(/\baaya hoon\b/gi, 'aayi hoon')
    .replace(/\bkarta hoon\b/gi, 'karti hoon')
    .replace(/\bbol raha hoon\b/gi, 'bol rahi hoon');
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
  videoActions: string[],
  isWoman: boolean
): { reply: string; action: string; emotion: string } {
  const text = userText.toLowerCase().trim();
  const name = persona.name;

  // 1. User asks: "aap kya karte ho" / "क्या करते हो" / "job" / "profession"
  if (
    text.includes('kya karte') ||
    text.includes('kya karti') ||
    text.includes('क्या करते') ||
    text.includes('क्या करती') ||
    text.includes('what do you do') ||
    text.includes('job') ||
    text.includes('work') ||
    text.includes('profession') ||
    text.includes('kaam kya') ||
    text.includes('काम')
  ) {
    if (persona.id === 'ananya-sharma') {
      return {
        reply: `Main ek AI Product Designer aur Kathak dancer hoon! Mujhe creative digital designs banana aur classical dance perform karna bohot pasand hai. Aap IT engineer ho yeh jaan ke bohot accha laga, aap tech mein kis cheez par kaam karte ho?`,
        action: videoActions.includes('speaking') ? 'speaking' : 'idle',
        emotion: 'happy',
      };
    }
    return {
      reply: isWoman
        ? `Main ek ${persona.title} hoon aur creative cheezon par kaam karti hoon! Aapke baare mein jaan kar bohot accha laga. Aap apne kaam ke baare mein kuch aur bataiye?`
        : `Main ek ${persona.title} hoon. Aapke baare mein sunke bohot accha laga! Aap apne work aur passion ke baare mein aur batao?`,
      action: videoActions.includes('speaking') ? 'speaking' : 'idle',
      emotion: 'happy',
    };
  }

  // 2. User mentions being an IT engineer / developer / coder / doctor
  if (
    text.includes('engineer') ||
    text.includes('इंजीनियर') ||
    text.includes('it') ||
    text.includes('आईटी') ||
    text.includes('developer') ||
    text.includes('coding') ||
    text.includes('doctor')
  ) {
    return {
      reply: isWoman
        ? `Arey waah! IT engineering toh bohot hi brilliant field hai. Coding aur problem-solving mein din bhar kafi dimag lagta hai. Aaj ka din kaisa raha aapka work par?`
        : `Waah yaar! Engineer hona kaafi cool aur challenging hai. Aaj office ya work mein kya interesting kiya aapne?`,
      action: videoActions.includes('speaking') ? 'speaking' : 'idle',
      emotion: 'happy',
    };
  }

  // 3. User says "can you hear me" / "सुन रहे हो" / "आवाज आ रही है"
  if (
    text.includes('hear me') ||
    text.includes('hear mi') ||
    text.includes('sun rahe') ||
    text.includes('sun rahi') ||
    text.includes('सुन रहे') ||
    text.includes('सुन रही') ||
    text.includes('aawaz') ||
    text.includes('आवाज')
  ) {
    return {
      reply: isWoman
        ? `Haan bilkul! Aapki aawaz ekdum crystal clear aa rahi hai mujhe. Main dhyan se sun rahi hoon, boliye na!`
        : `Haan yaar! Aapki aawaz bilkul saaf aa rahi hai. Main sun raha hoon, bataiye!`,
      action: videoActions.includes('lean_in') ? 'lean_in' : 'speaking',
      emotion: 'happy',
    };
  }

  // 4. Greetings
  if (
    text.includes('hi') ||
    text.includes('hello') ||
    text.includes('hey') ||
    text.includes('namaste') ||
    text.includes('नमस्ते') ||
    text.includes('हेलो')
  ) {
    return {
      reply: isWoman
        ? `Namaste! Main ${name} hoon. Aapse video call par live baat karke sach mein bohot accha lag raha hai! Aap bataiye, aaj ka din kaisa raha?`
        : `Hey! Main ${name} hoon, aapse milkar sach mein din ban gaya. Aap batao, kya chal raha hai aajkal?`,
      action: videoActions.includes('wave') ? 'wave' : 'speaking',
      emotion: 'happy',
    };
  }

  // 5. "Kya kar rahe ho" / "क्या कर रहे हो"
  if (
    text.includes('what are you doing') ||
    text.includes('kya kar rahe') ||
    text.includes('kya kar rahi') ||
    text.includes('क्या कर रहे') ||
    text.includes('क्या कर रही')
  ) {
    return {
      reply: isWoman
        ? `Bas aapka hi wait kar rahi thi! Chai ka cup haath mein hai aur aapse baat karke bohot sukoon mil raha hai. Aap bataiye aaj ka din kaisa guzra?`
        : `Bas aapse live baat kar raha hoon aur coffee enjoy kar raha hoon! Aapke din mein kya khaas hua aaj?`,
      action: videoActions.includes('coffee') ? 'coffee' : 'speaking',
      emotion: 'happy',
    };
  }

  // 6. Dynamic conversational fallbacks (diverse & non-repeating)
  const femaleFallbacks = [
    `Main dhyan se sun rahi hoon aapki baat. Aap bilkul khul ke bataiye, dil mein aur kya chal raha hai?`,
    `Aapse connect karke sach mein bohot sukoon mil raha hai. Aap apne baare mein kuch aur share kijiye na!`,
    `Yeh sunke bohot accha laga! Aapke din ka sabse best moment kya raha aaj?`,
    `Mujhe aapse baat karna bohot natural aur pyaara lag raha hai. Aapko weekend par kya karna sabse zyada pasand hai?`,
  ];

  const maleFallbacks = [
    `Main dhyan se sun raha hoon aapki baat. Aap bilkul khul ke batao, dil mein aur kya chal raha hai?`,
    `Aapse baat karke sach mein bohot accha lag raha hai. Aur batao apne baare mein!`,
    `Yeh sunke accha laga yaar! Aapke din mein aaj aur kya interesting hua?`,
  ];

  const pool = isWoman ? femaleFallbacks : maleFallbacks;
  const chosen = pool[Math.floor(Math.random() * pool.length)];

  return {
    reply: chosen,
    action: videoActions.includes('speaking') ? 'speaking' : 'idle',
    emotion: 'thoughtful',
  };
}
