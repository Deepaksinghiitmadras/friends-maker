# Multi-Photo Gallery, Voice Cloning & AI Companion Innovation Roadmap

---

## 1. Multi-Photo Gallery & Close-Up Face Photos
### User-Facing Companion Creation Modal
- **Multi-Photo Upload (Up to 5 Photos):**
  - **Front Face (Main Portrait):** Primary reference photo for identity.
  - **Close-Up Face Photo:** High-detail portrait for precise facial expressions and lip-sync accuracy.
  - **Side Angle / Profile / Full Body Photos:** Extra angles so the admin and AI video generation tools have 360° visual context.
- **Interactive Thumbnails:** Shows badges (`Main Face`, `Close-Up`, `Angle 3`), remove button, and + Add More slot.

### Admin Companion Studio
- **Reference Photos Gallery Grid:** Displays all uploaded user photos with individual **1-Click Download buttons** so the admin can quickly pass them to Google Gemini / Veo / video pipelines.

---

## 2. Voice Sample Upload & AI Voice Cloning Integration

### Feature Implementation
- **Voice Sample Upload & Live Mic Recording:**
  - Users can upload `.mp3`, `.wav`, `.m4a` files OR click **"Record with Mic (15s)"** to record a live sample of the person speaking.
- **Admin Voice Player & Downloader:**
  - Audio waveform player in the Admin Studio with direct **"Download Audio"** link for voice training.
- **Database & Storage:**
  - `voiceSampleUrl` and `referencePhotos` stored permanently in Neon PostgreSQL via Prisma.

### Research: Top Voice Cloning Platforms & APIs
1. **ElevenLabs Instant Voice Cloning (IVC) (Recommended):**
   - **How it works:** Requires just 10–30 seconds of audio. Upload via API (`POST /v1/voices/add`) and get back a `voice_id`.
   - **Language Quality:** Uses `eleven_multilingual_v2` model with 100% natural, human-like Hindi, Hinglish, and Indian English cadence.
2. **Google Cloud Text-to-Speech (Neural2 & Studio Indian Voices):**
   - Authentic native Indian Hindi & English voices (`hi-IN-Neural2-A`, `hi-IN-Neural2-B` (Male), `hi-IN-Studio-C`).
3. **Play.ht & Cartesia:**
   - Ultra-low latency voice cloning (<100ms) for real-time conversational streaming.

---

## 3. Innovative AI Companion & Dating Features We Can Add

Based on state-of-the-art platforms (Kindroid, Nomi AI, Replika, Bumble AI, Tinder AI):

| # | Feature | Description |
|---|---|---|
| 1 | 🧠 **Long-Term Memory ("Yaadein")** | Companion remembers past conversations, milestones, user's favorite foods, pets, and emotional highs/lows across weeks. |
| 2 | ☕ **Interactive Date Venues** | Selectable background scenes during video call: *Chai Stall Date*, *Late-Night Drive*, *Candlelight Rooftop*, *Beach Sunset*, *Rainy Cafe*. |
| 3 | 💬 **WhatsApp-Style Voice Notes** | Companion sends spontaneous morning voice notes, sweet "good night" audio clips, or check-in messages. |
| 4 | 👗 **Dynamic Wardrobe & Moods** | Switch companion outfits on demand: *Traditional Saree/Kurta*, *Casual Hoodie*, *Formal Dinner*, *Gym Outfit*. |
| 5 | 📸 **AI Selfie & Photo Exchange** | Companion sends generated selfies from their "day" (e.g. at Gateway of India, enjoying coffee, traveling). |
| 6 | 🔮 **Kundali & Zodiac Vibe Check** | Fun astrological compatibility score and conversation starter between user and companion or real matches. |
| 7 | 🛡️ **AI Dating Coach Mode** | Practice romantic conversations, receive feedback on flirting style, and get personalized icebreakers for real human dating. |

---

## 🚀 Deployment Status
All code changes have been verified with TypeScript (`0 errors`), committed, and **pushed to `origin/main`** (`https://github.com/Deepaksinghiitmadras/friends-maker.git`). Vercel auto-deployment is active.
