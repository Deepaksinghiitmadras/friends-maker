import { auth } from "@/auth";
import { Button, Card, CardBody, Chip } from "@nextui-org/react";
import Link from "next/link";
import Image from "next/image";
import dynamicImport from "next/dynamic";
import {
  FaVideo,
  FaHeart,
  FaUserFriends,
  FaLock,
  FaSmile,
  FaComments,
  FaShieldAlt,
  FaUserPlus,
  FaHeadphones,
  FaDownload,
} from "react-icons/fa";
import { HiSparkles } from "react-icons/hi2";
import InstallAppButton from "@/components/pwa/InstallAppButton";

export const dynamic = 'force-dynamic';

const DynamicHeartAnimation = dynamicImport(
  () => import("@/components/animations/HeartAnimation"),
  { ssr: false }
);
const DynamicAnimatedBackground = dynamicImport(
  () => import("@/components/animations/AnimatedBackground"),
  { ssr: false }
);

export default async function Home() {
  const session = await auth();

  return (
    <div className="-mx-[calc(50vw-50%)] w-screen -mt-[calc(1.25rem)] overflow-hidden">
      {/* ── HERO SECTION ────────────────────────────────────────────────────── */}
      <div className="w-full min-h-[92vh] relative overflow-hidden bg-gradient-to-b from-pink-100/90 via-purple-50/60 to-white dark:from-gray-950 dark:via-purple-950/20 dark:to-gray-900 flex flex-col justify-center items-center py-20 px-4">
        <DynamicAnimatedBackground />
        <DynamicHeartAnimation />

        <div className="w-full max-w-5xl mx-auto text-center space-y-8 relative z-10">
          {/* Top Pill */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border border-pink-200 dark:border-purple-500/30 text-pink-600 dark:text-pink-400 text-xs sm:text-sm font-bold uppercase tracking-wider shadow-sm">
            <HiSparkles className="text-amber-400 animate-spin" style={{ animationDuration: '3s' }} />
            <span>24/7 Emotional Companionship &amp; Real Dating Sanctuary</span>
          </div>

          {/* Main Title */}
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-tight">
            Never Feel Alone. <br />
            <span className="bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
              Always Have Someone to Talk To.
            </span>
          </h1>

          {/* Emotional Subtitle */}
          <p className="text-base sm:text-xl text-gray-700 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed font-normal">
            Whether you are feeling lonely, going through a stressful day, missing someone special, or ready to meet genuine singles — <strong className="text-pink-600 dark:text-pink-400 font-semibold">TrueFriends</strong> gives you instant live 1-on-1 AI video companions and authentic real-life connections in a judgment-free space.
          </p>

          {/* Primary Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Button
              as={Link}
              href="/virtual"
              size="lg"
              className="w-full sm:w-auto bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 text-white font-extrabold text-base sm:text-lg px-8 py-7 rounded-full shadow-xl shadow-pink-500/25 hover:scale-105 transition-all"
              startContent={<FaVideo className="text-xl animate-pulse" />}
            >
              Talk to AI Friend (Live Video Call)
            </Button>

            {session ? (
              <Button
                as={Link}
                href="/members"
                size="lg"
                className="w-full sm:w-auto bg-white dark:bg-gray-800 text-purple-700 dark:text-purple-300 border-2 border-purple-400 text-base sm:text-lg px-8 py-7 rounded-full hover:bg-purple-50 dark:hover:bg-gray-700 font-bold shadow-md hover:scale-105 transition-all"
                startContent={<FaUserFriends className="text-xl text-pink-500" />}
              >
                Find Real Matches
              </Button>
            ) : (
              <Button
                as={Link}
                href="/register"
                size="lg"
                className="w-full sm:w-auto bg-white dark:bg-gray-800 text-pink-600 dark:text-pink-400 border-2 border-pink-400 text-base sm:text-lg px-8 py-7 rounded-full hover:bg-pink-50 dark:hover:bg-gray-700 font-bold shadow-md hover:scale-105 transition-all"
                startContent={<FaHeart className="text-xl text-pink-500" />}
              >
                Join TrueFriends Free
              </Button>
            )}
          </div>

          {/* Trust Points */}
          <div className="flex flex-wrap items-center justify-center gap-6 pt-4 text-xs font-semibold text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-2">
              <FaLock className="text-emerald-500" />
              <span>100% Private &amp; Anonymous</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Available 24/7 / 365 Days</span>
            </div>
            <div className="flex items-center gap-2">
              <FaSmile className="text-amber-500" />
              <span>Zero Judgment • Empathy First</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── EMOTIONAL SUPPORT & WHAT YOU CAN DO SECTION ──────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
          <Chip color="secondary" variant="flat" className="font-bold text-xs uppercase tracking-wider">
            Your Comfort Sanctuary
          </Chip>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Whatever You Are Feeling, <br />
            <span className="bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
              You Don&apos;t Have to Go Through It Alone.
            </span>
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-base sm:text-lg leading-relaxed">
            TrueFriends was created because everyone deserves a listening ear, a comforting presence, and a warm companion to talk to anytime.
          </p>
        </div>

        {/* 4 Feature Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1: Loneliness & Empathy */}
          <Card className="p-6 rounded-3xl border border-pink-100 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md shadow-md hover:shadow-xl transition-all duration-300 group hover:-translate-y-1">
            <CardBody className="space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-pink-500/10 text-pink-500 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                🌸
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                Share Your Feelings (&quot;Mann Ki Baat&quot;)
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                Had a tough day? Feeling stressed or overwhelmed? Talk naturally in Hindi or English. Our companions listen with deep empathy and validate your emotions.
              </p>
            </CardBody>
          </Card>

          {/* Card 2: Late Night Chats & Chai Dates */}
          <Card className="p-6 rounded-3xl border border-purple-100 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md shadow-md hover:shadow-xl transition-all duration-300 group hover:-translate-y-1">
            <CardBody className="space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                ☕
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                Late-Night Talks &amp; Chai Dates
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                Enjoy charming, relaxing conversations over chai, acoustic melodies, Bollywood memories, and deep philosophical talks with intelligent virtual friends.
              </p>
            </CardBody>
          </Card>

          {/* Card 3: Custom AI Companion from Photo */}
          <Card className="p-6 rounded-3xl border border-indigo-100 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md shadow-md hover:shadow-xl transition-all duration-300 group hover:-translate-y-1">
            <CardBody className="space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                🎨
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                Bring Your Persona to Life
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                Upload a portrait of someone you wish to speak with. Our studio generates realistic video clips so you can experience comforting 1-on-1 face-to-face calls.
              </p>
            </CardBody>
          </Card>

          {/* Card 4: Real Human Matches */}
          <Card className="p-6 rounded-3xl border border-rose-100 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md shadow-md hover:shadow-xl transition-all duration-300 group hover:-translate-y-1">
            <CardBody className="space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                💖
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                Find Real Romance &amp; Dates
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                When you are ready, browse verified singles looking for authentic relationships, genuine friendship, and true love in your city.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* ── FEATURED COMPANIONS SHOWCASE BANNER ──────────────────────────────── */}
      <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-pink-900 text-white py-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <Chip size="sm" color="secondary" variant="flat" className="text-pink-300 font-bold uppercase">
              Meet Your Virtual Friends
            </Chip>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Ready to Talk Right Now?
            </h2>
            <p className="text-purple-200/90 text-sm sm:text-base">
              Connect in seconds on high-definition video calls with our most popular virtual companions.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Ananya Sharma */}
            <div className="bg-white/10 backdrop-blur-md rounded-3xl p-5 border border-white/20 flex flex-col justify-between space-y-4 hover:scale-105 transition-all">
              <div className="relative h-60 w-full rounded-2xl overflow-hidden shadow-lg">
                <Image
                  src="https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=800&auto=format&fit=crop&q=80"
                  alt="Ananya Sharma"
                  fill
                  className="object-cover"
                />
                <div className="absolute top-2 left-2 px-2.5 py-1 rounded-full bg-emerald-500 text-white text-[11px] font-bold">
                  🟢 Ready for Call
                </div>
              </div>
              <div>
                <h4 className="text-lg font-bold">Ananya Sharma, 26</h4>
                <p className="text-xs text-pink-300">Kathak Dancer &amp; AI Designer</p>
                <p className="text-xs text-purple-200 mt-2 line-clamp-2 italic">
                  &quot;Chai lover, old Bollywood melodies, and romantic late-night heart-to-hearts.&quot;
                </p>
              </div>
              <Button
                as={Link}
                href="/virtual/call/ananya-sharma"
                size="sm"
                className="bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold rounded-xl"
                startContent={<FaVideo className="text-xs" />}
              >
                Call Ananya Now
              </Button>
            </div>

            {/* Aarav Malhotra */}
            <div className="bg-white/10 backdrop-blur-md rounded-3xl p-5 border border-white/20 flex flex-col justify-between space-y-4 hover:scale-105 transition-all">
              <div className="relative h-60 w-full rounded-2xl overflow-hidden shadow-lg">
                <Image
                  src="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800&auto=format&fit=crop&q=80"
                  alt="Aarav Malhotra"
                  fill
                  className="object-cover"
                />
                <div className="absolute top-2 left-2 px-2.5 py-1 rounded-full bg-emerald-500 text-white text-[11px] font-bold">
                  🟢 Ready for Call
                </div>
              </div>
              <div>
                <h4 className="text-lg font-bold">Aarav Malhotra, 28</h4>
                <p className="text-xs text-pink-300">Architect &amp; Indie Musician</p>
                <p className="text-xs text-purple-200 mt-2 line-clamp-2 italic">
                  &quot;Late-night acoustic melodies, deep chai conversations &amp; poetry.&quot;
                </p>
              </div>
              <Button
                as={Link}
                href="/virtual/call/aarav-malhotra"
                size="sm"
                className="bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold rounded-xl"
                startContent={<FaVideo className="text-xs" />}
              >
                Call Aarav Now
              </Button>
            </div>

            {/* Elena Rostova */}
            <div className="bg-white/10 backdrop-blur-md rounded-3xl p-5 border border-white/20 flex flex-col justify-between space-y-4 hover:scale-105 transition-all">
              <div className="relative h-60 w-full rounded-2xl overflow-hidden shadow-lg">
                <Image
                  src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800&auto=format&fit=crop&q=80"
                  alt="Elena Rostova"
                  fill
                  className="object-cover"
                />
                <div className="absolute top-2 left-2 px-2.5 py-1 rounded-full bg-emerald-500 text-white text-[11px] font-bold">
                  🟢 Ready for Call
                </div>
              </div>
              <div>
                <h4 className="text-lg font-bold">Elena Rostova, 29</h4>
                <p className="text-xs text-pink-300">Travel Photographer</p>
                <p className="text-xs text-purple-200 mt-2 line-clamp-2 italic">
                  &quot;Chasing golden-hour sunsets, cozy wine nights, and deep heart-to-hearts.&quot;
                </p>
              </div>
              <Button
                as={Link}
                href="/virtual/call/elena-rostova"
                size="sm"
                className="bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold rounded-xl"
                startContent={<FaVideo className="text-xs" />}
              >
                Call Elena Now
              </Button>
            </div>

            {/* Kabir */}
            <div className="bg-white/10 backdrop-blur-md rounded-3xl p-5 border border-white/20 flex flex-col justify-between space-y-4 hover:scale-105 transition-all">
              <div className="relative h-60 w-full rounded-2xl overflow-hidden shadow-lg">
                <Image
                  src="/images/kabir.jpeg"
                  alt="Kabir"
                  fill
                  className="object-cover"
                />
                <div className="absolute top-2 left-2 px-2.5 py-1 rounded-full bg-emerald-500 text-white text-[11px] font-bold">
                  🟢 Ready for Call
                </div>
              </div>
              <div>
                <h4 className="text-lg font-bold">Kabir, 27</h4>
                <p className="text-xs text-pink-300">Filmmaker &amp; Storyteller</p>
                <p className="text-xs text-purple-200 mt-2 line-clamp-2 italic">
                  &quot;Cinema, beach sunsets, and honest soul-stirring conversations.&quot;
                </p>
              </div>
              <Button
                as={Link}
                href="/virtual/call/kabir"
                size="sm"
                className="bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold rounded-xl"
                startContent={<FaVideo className="text-xs" />}
              >
                Call Kabir Now
              </Button>
            </div>
          </div>

          <div className="text-center pt-4">
            <Button
              as={Link}
              href="/virtual"
              size="lg"
              className="bg-white text-purple-900 font-extrabold rounded-full px-8 shadow-xl hover:scale-105 transition-all"
            >
              Explore All Virtual Companions →
            </Button>
          </div>
        </div>
      </div>

      {/* ── INSTALL PWA BANNER ──────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 py-16 text-center">
        <div className="bg-gradient-to-br from-pink-50 to-purple-50 dark:from-gray-900 dark:to-purple-950/40 p-8 sm:p-12 rounded-3xl border border-pink-200 dark:border-purple-800/40 shadow-lg space-y-6">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-pink-500 to-purple-600 text-white flex items-center justify-center mx-auto text-3xl shadow-lg shadow-pink-500/30">
            <FaHeart className="animate-pulse" />
          </div>
          <div className="space-y-2 max-w-2xl mx-auto">
            <h3 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">
              Install TrueFriends on Your Phone or Desktop
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Get 1-click instant access right from your home screen. Fast, responsive, and works seamlessly like a native mobile app.
            </p>
          </div>

          <div className="flex justify-center">
            <InstallAppButton size="lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
