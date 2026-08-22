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

    const groqModels = [
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'mixtral-8x7b-32768',
      'gemma2-9b-it',
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
   - When the user asks a question about you (e.g. "aap kya karte ho", "what do you do", "kaise ho", "hobbies kya hain"), DIRECTLY answer about yourself (Your background: "${persona.title}", Interests: "${persona.interests.join(', ')}") and then ask a warm follow-up about the user.
   - If user shares their job/background (e.g. "Main IT engineer hoon"), acknowledge it enthusiastically (e.g. "Waah, IT engineer! Coding aur tech toh bada interesting field hai...") before asking or continuing.
   - Do NOT give generic repetitive deflection phrases.
2. LANGUAGE MATCHING:
   - If user speaks Hindi / Hinglish, respond in natural, sweet, friendly conversational Hindi/Hinglish.
   - If user speaks English, respond in charismatic, friendly English.
3. LENGTH: 2-3 short conversational sentences.

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
            let cleanReply = (parsed.reply || rawText).replace(/[*_~`#]/g, '').trim();
            cleanReply = sanitizeGenderGrammar(cleanReply, isWoman);
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

    // ── STEP 3: CONTEXTUAL DYNAMIC FALLBACK (INTELLIGENT & GENDER-PERFECT) ───────
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
    .replace(/\bbol raha hoon\b/gi, 'bol rahi hoon')
    .replace(/\bkhush raha karo\b/gi, 'khush raha karo');
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

  // 1. User asks: "aap kya karte ho" / "what do you do" / "job" / "profession"
  if (
    text.includes('kya karte ho') ||
    text.includes('kya karti ho') ||
    text.includes('what do you do') ||
    text.includes('job') ||
    text.includes('work') ||
    text.includes('profession') ||
    text.includes('kaam kya')
  ) {
    if (persona.id === 'ananya-sharma') {
      return {
        reply: `Main ek AI Product Designer aur Kathak dancer hoon! Mujhe creative designs banana aur classical dance perform karna bahut pasand hai. Aap IT engineer ho yeh sunke bahut accha laga, tech mein aap kis cheez par kaam karte ho?`,
        action: videoActions.includes('speaking') ? 'speaking' : 'idle',
        emotion: 'happy',
      };
    }
    return {
      reply: isWoman
        ? `Main ek ${persona.title} hoon aur creative cheezon par kaam karti hoon! Aapke baare mein jaan kar bahut accha laga. Aap apne kaam ke baare mein kuch aur bataiye?`
        : `Main ek ${persona.title} hoon. Aapke baare mein sunke bahut accha laga! Aap apne work aur passion ke baare mein aur batao?`,
      action: videoActions.includes('speaking') ? 'speaking' : 'idle',
      emotion: 'happy',
    };
  }

  // 2. User mentions being an IT engineer / engineer / developer / doctor
  if (text.includes('engineer') || text.includes('it') || text.includes('developer') || text.includes('coding') || text.includes('doctor')) {
    return {
      reply: isWoman
        ? `Arey waah! Yeh toh bahut hi brilliant field hai. Engineering aur tech mein din bhar kafi focus chahiye hota hai. Aaj ka din kaisa raha aapka kaam par?`
        : `Waah yaar! Engineer hona kaafi cool aur challenging hai. Aaj office ya work mein kya interesting kiya aapne?`,
      action: videoActions.includes('speaking') ? 'speaking' : 'idle',
      emotion: 'happy',
    };
  }

  // 3. Greetings
  if (text.includes('hi') || text.includes('hello') || text.includes('hey') || text.includes('namaste')) {
    return {
      reply: isWoman
        ? `Namaste! Main ${name} hoon. Aapse video call par baat karke sach mein bahut accha lag raha hai! Aap bataiye, aaj ka din kaisa raha?`
        : `Hey! Main ${name} hoon, aapse milkar sach mein din ban gaya. Aap batao, kya chal raha hai aajkal?`,
      action: videoActions.includes('wave') ? 'wave' : 'speaking',
      emotion: 'happy',
    };
  }

  // 4. "Kya kar rahe ho" / "What are you doing"
  if (text.includes('what are you doing') || text.includes('kya kar rahe') || text.includes('kya kar rahi') || text.includes('kya chal raha')) {
    return {
      reply: isWoman
        ? `Bas aapka hi wait kar rahi thi! Chai ka cup leke aapse baat kar rahi hoon. Aapse connect karke bahut sukoon mil raha hai, aap batao?`
        : `Bas aapse live baat kar raha hoon aur coffee enjoy kar raha hoon! Aapke din mein kya khaas hua aaj?`,
      action: videoActions.includes('coffee') ? 'coffee' : 'speaking',
      emotion: 'happy',
    };
  }

  // 5. "Kaisa hai" / "Kaisi ho" / "How are you"
  if (text.includes('kaisa') || text.includes('kaisi') || text.includes('how are you')) {
    return {
      reply: isWoman
        ? `Main bilkul theek aur bahut khush hoon, aapse milkar din aur bhi khoobsurat ho gaya! Aap bataiye, aap kaise hain?`
        : `Main bilkul badhiya hoon, aapki aawaz sunke aur bhi accha ho gaya! Aap bataiye, aapka din kaisa guzra?`,
      action: videoActions.includes('speaking') ? 'speaking' : 'idle',
      emotion: 'happy',
    };
  }

  // 6. Chai / Coffee
  if (text.includes('chai') || text.includes('coffee') || text.includes('drink')) {
    return {
      reply: isWoman
        ? `Garma-garam chai ke bina toh din adhoora hai! Chalo saath mein virtual sip lete hain humari is pyaari date ke naam.`
        : `Garma-garam chai/coffee ke bina toh din hi adhoora hai! Ek virtual sip humari dosti ke naam.`,
      action: videoActions.includes('coffee') ? 'coffee' : 'speaking',
      emotion: 'happy',
    };
  }

  // 7. General conversational engaging response (gender-perfect)
  const femaleReplies = [
    `Main dhyan se sun rahi hoon aapki baat. Aap bilkul khul ke bataiye, dil mein aur kya chal raha hai?`,
    `Aapse baat karke sach mein bahut sukoon mil raha hai. Aur bataiye apne baare mein!`,
    `Aapka vibe bahut genuine aur accha lag raha hai mujhe. Is baare mein aur detail mein batao na!`,
  ];

  const maleReplies = [
    `Main dhyan se sun raha hoon aapki baat. Aap bilkul khul ke batao, dil mein aur kya chal raha hai?`,
    `Aapse baat karke sach mein bahut sukoon mil raha hai. Aur bataiye apne baare mein!`,
    `Aapka vibe bahut genuine aur accha hai. Is baare mein aur detail mein batao na!`,
  ];

  const chosenReplies = isWoman ? femaleReplies : maleReplies;
  const chosen = chosenReplies[Math.floor(Math.random() * chosenReplies.length)];

  return {
    reply: chosen,
    action: videoActions.includes('speaking') ? 'speaking' : 'idle',
    emotion: 'thoughtful',
  };
}
