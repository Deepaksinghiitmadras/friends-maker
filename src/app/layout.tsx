import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "@/components/Providers";
import TopNav from "@/components/navbar/TopNavGlass";
import Footer from "@/components/footer/Footer";
import PWARegister from "@/components/pwa/PWARegister";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import NextTopLoader from "nextjs-toploader";

// Root layout reads auth session — must be dynamic on every request
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "TrueFriends - AI Companions, Emotional Support & Real Dating",
  description:
    "Never feel lonely again. Talk with ultra-realistic AI virtual companions on live video calls or find genuine real-life dates in a judgment-free sanctuary.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TrueFriends",
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/images/logo.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#ec4899",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let session: any = null;
  try {
    session = await auth();
  } catch (err) {
    console.warn('[RootLayout] Session fetch warning:', err);
  }

  let userId = session?.user?.id || null;
  let profileComplete = (session?.user?.profileComplete as boolean) || false;

  // Single-device login enforcement: verify sessionToken matches current DB state
  if (userId && session?.user?.sessionToken) {
    try {
      const dbUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { sessionToken: true, isBlocked: true },
      });

      if (dbUser?.isBlocked || (dbUser?.sessionToken && dbUser.sessionToken !== session.user.sessionToken)) {
        // Session superseded by another device login or user blocked
        userId = null;
        profileComplete = false;
      }
    } catch {
      // Non-blocking fallback
    }
  }

  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="TrueFriends" />
      </head>
      <body className="min-h-screen flex flex-col justify-between bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 antialiased selection:bg-pink-500 selection:text-white">
        <NextTopLoader color="#ec4899" showSpinner={false} />
        <PWARegister />
        <Providers profileComplete={profileComplete} userId={userId}>
          <TopNav />
          <main className="container mx-auto flex-grow px-2 sm:px-4">
            {children}
          </main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
