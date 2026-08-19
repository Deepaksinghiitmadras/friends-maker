import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { updateCustomPersonaStatus } from '@/lib/customPersonasStore';

const VEO_MODEL = 'veo-3.1-generate-preview';

/**
 * Retrieve all configured Gemini API keys from .env pool.
 */
function getGeminiApiKeys(): string[] {
  const keys: string[] = [];

  // Primary key
  if (process.env.GEMINI_API_KEY && isValidKey(process.env.GEMINI_API_KEY)) {
    keys.push(process.env.GEMINI_API_KEY.trim());
  }

  // Multi-key numbering pool: GEMINI_API_KEY1 to GEMINI_API_KEY10
  for (let i = 1; i <= 10; i++) {
    const k = process.env[`GEMINI_API_KEY${i}`];
    if (k && isValidKey(k) && !keys.includes(k.trim())) {
      keys.push(k.trim());
    }
  }

  // Comma-separated list support: GEMINI_API_KEYS="key1,key2,key3"
  if (process.env.GEMINI_API_KEYS) {
    const list = process.env.GEMINI_API_KEYS.split(',').map((s) => s.trim());
    for (const k of list) {
      if (k && isValidKey(k) && !keys.includes(k)) {
        keys.push(k);
      }
    }
  }

  return keys;
}

function isValidKey(key: string): boolean {
  if (!key) return false;
  const k = key.trim();
  if (k.length < 10) return false;
  if (k.startsWith('YOUR_') || k.includes('PLACEHOLDER') || k.includes('HERE')) return false;
  return true;
}

/**
 * Generate video using the official @google/genai SDK with multi-key failover.
 */
async function generateVideoWithVeoSDK(
  prompt: string,
  imageBase64: string | null,
  outputPath: string,
  label: string
): Promise<boolean> {
  const keys = getGeminiApiKeys();

  if (keys.length === 0) {
    console.warn(`[🎬 VEO ${label}] No valid Gemini API keys found in pool.`);
    return false;
  }

  console.log(`[🎬 VEO ${label}] Starting video generation with ${keys.length} API key(s)...`);

  for (let keyIdx = 0; keyIdx < keys.length; keyIdx++) {
    const currentKey = keys[keyIdx];
    const maskedKey = `${currentKey.slice(0, 8)}...${currentKey.slice(-4)}`;
    console.log(`[🎬 VEO ${label}] Trying Gemini Key #${keyIdx + 1}/${keys.length} (${maskedKey})...`);

    try {
      const ai = new GoogleGenAI({ apiKey: currentKey });

      // Prepare generation source
      const source: any = { prompt };
      if (imageBase64) {
        source.image = {
          imageBytes: imageBase64,
          mimeType: 'image/jpeg',
        };
      }

      console.log(`[🎬 VEO ${label}] Calling ai.models.generateVideos (${VEO_MODEL})...`);
      let operation = await ai.models.generateVideos({
        model: VEO_MODEL,
        source,
        config: {
          aspectRatio: '16:9',
          durationSeconds: 6,
          numberOfVideos: 1,
        },
      });

      console.log(`[🎬 VEO ${label}] Operation queued with Key #${keyIdx + 1}: ${operation?.name}. Polling...`);

      // Poll until operation is complete (max 60 polls x 10s = 10 minutes)
      const MAX_POLLS = 60;
      const POLL_INTERVAL_MS = 10000;

      for (let poll = 0; poll < MAX_POLLS; poll++) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

        try {
          operation = await ai.operations.getVideosOperation({
            operation: operation,
          });

          if (operation.done) {
            console.log(`[🎬 VEO ${label}] ✅ Video generation completed after ${poll + 1} polls!`);

            const result = (operation as any).response || (operation as any).result;
            const generatedVideos = result?.generatedVideos || result?.predictions || [];

            if (!generatedVideos || generatedVideos.length === 0) {
              console.error(`[🎬 VEO ${label} ERROR] No generated video in response:`, JSON.stringify(result));
              return false;
            }

            const genVideo = generatedVideos[0];
            if (genVideo.video) {
              await ai.files.download({
                file: genVideo.video,
                downloadPath: outputPath,
              });
              console.log(`[🎬 VEO ${label} SUCCESS] Video downloaded and saved to: ${outputPath}`);
              return true;
            } else if (genVideo.bytesBase64Encoded) {
              const videoBuffer = Buffer.from(genVideo.bytesBase64Encoded, 'base64');
              fs.writeFileSync(outputPath, videoBuffer);
              console.log(`[🎬 VEO ${label} SUCCESS] Video buffer saved to: ${outputPath}`);
              return true;
            }

            return false;
          }

          if ((poll + 1) % 6 === 0) {
            console.log(`[🎬 VEO ${label}] Still processing... (${((poll + 1) * POLL_INTERVAL_MS / 1000)}s elapsed)`);
          }
        } catch (pollErr: any) {
          console.warn(`[🎬 VEO ${label}] Poll #${poll + 1} exception:`, pollErr.message);
        }
      }

      console.error(`[🎬 VEO ${label} TIMEOUT] Operation exceeded maximum polling time.`);
    } catch (err: any) {
      const errMsg = err.message || JSON.stringify(err);
      console.warn(`[🎬 VEO ${label}] Key #${keyIdx + 1} error: ${errMsg.slice(0, 300)}`);
      if (keyIdx < keys.length - 1) {
        console.log(`[🎬 VEO ${label}] Switching to fallback Key #${keyIdx + 2}...`);
        continue;
      }
    }
  }

  return false;
}

export async function POST(req: NextRequest) {
  try {
    const { personaId, imagePath, gender = 'man', characterDescription } = await req.json();

    if (!personaId) {
      return NextResponse.json({ error: 'personaId is required' }, { status: 400 });
    }

    const availableKeys = getGeminiApiKeys();
    const videoDir = path.join(process.cwd(), 'public', 'videos', personaId);
    if (!fs.existsSync(videoDir)) {
      fs.mkdirSync(videoDir, { recursive: true });
    }

    const idlePath = path.join(videoDir, 'idle.mp4');
    const speakPath = path.join(videoDir, 'speaking.mp4');

    console.log(`\n════════════════════════════════════════════════════════════`);
    console.log(`[🎬 VIDEO ENGINE] Background video pipeline for "${personaId}"`);
    console.log(`[🎬 VIDEO ENGINE] Image: ${imagePath || 'none'}`);
    console.log(`[🎬 VIDEO ENGINE] Gemini API Keys in failover pool: ${availableKeys.length}`);
    console.log(`[🎬 VIDEO ENGINE] Status: Remains "generating" awaiting Admin approval & video upload`);
    console.log(`════════════════════════════════════════════════════════════\n`);

    // Return immediately — background attempt runs
    const backgroundPromise = (async () => {
      try {
        let imageBase64: string | null = null;
        let resolvedImgPath = imagePath;

        if (imagePath && imagePath.startsWith('/')) {
          resolvedImgPath = path.join(process.cwd(), 'public', imagePath.replace(/^\//, ''));
        }
        if (resolvedImgPath && fs.existsSync(resolvedImgPath)) {
          imageBase64 = fs.readFileSync(resolvedImgPath).toString('base64');
          console.log(`[🎬 VIDEO ENGINE] ✅ Loaded reference image: ${resolvedImgPath} (${Math.round(imageBase64.length / 1024)}KB base64)`);
        }

        const person = gender === 'man' ? 'Indian man' : 'Indian woman';
        const desc = characterDescription || 'friendly companion';

        const idlePrompt = `A high quality realistic 4K video call webcam view of a ${person} (${desc}), looking warmly directly into the camera lens, gentle natural breathing, blinking naturally with a subtle charming smile. Cozy indoor ambient lighting, stable camera, continuous smooth natural loop. The person should NOT talk or move lips.`;
        const speakPrompt = `A high quality realistic 4K video call webcam view of a ${person} (${desc}), talking warmly and expressively into the camera with natural lip movements and subtle head gestures. Engaging eye contact, soft cinematic background blur, warm friendly expression.`;

        let idleGenerated = false;
        let speakGenerated = false;

        if (availableKeys.length > 0) {
          idleGenerated = await generateVideoWithVeoSDK(idlePrompt, imageBase64, idlePath, 'IDLE');
          speakGenerated = await generateVideoWithVeoSDK(speakPrompt, imageBase64, speakPath, 'SPEAKING');
        }

        // Only mark ready if AI generation actually produced the files on disk
        if (idleGenerated && speakGenerated) {
          updateCustomPersonaStatus(personaId, 'ready');
          console.log(`[🎬 VIDEO ENGINE DONE] "${personaId}" successfully generated via AI! Status → "ready"`);
        } else {
          // Keep status in progress so Admin can review in Companion Studio and upload videos manually
          console.log(`[🎬 VIDEO ENGINE] "${personaId}" video generation pending API quota/admin upload. Keeping status as "generating".`);
        }
      } catch (genErr: any) {
        console.error(`[🎬 VIDEO ENGINE ERROR]`, genErr);
      }
    })();

    backgroundPromise.catch((err) => console.error('[🎬 VIDEO ENGINE UNHANDLED]', err));

    return NextResponse.json({
      success: true,
      message: `Video generation request queued for "${personaId}". Awaiting video generation or Admin upload.`,
      status: 'generating',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
