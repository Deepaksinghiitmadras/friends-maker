'use client';

import React from 'react';
import Link from 'next/link';
import { FaHeart, FaVideo, FaUserFriends, FaLock, FaShieldAlt } from 'react-icons/fa';
import { HiSparkles } from 'react-icons/hi2';
import InstallAppButton from '@/components/pwa/InstallAppButton';

export default function Footer() {
  return (
    <footer className="w-full bg-gradient-to-b from-white to-pink-50/50 dark:from-gray-950 dark:to-black border-t border-pink-100 dark:border-gray-800 text-gray-700 dark:text-gray-300 py-12 px-4 sm:px-6 lg:px-8 mt-20 transition-colors">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
        {/* Brand & Mission Column */}
        <div className="md:col-span-2 space-y-4">
          <Link href="/" className="inline-flex items-center gap-2 text-2xl font-black tracking-tight">
            <span className="p-2 rounded-2xl bg-gradient-to-tr from-pink-500 to-rose-500 text-white shadow-md shadow-pink-500/30">
              <FaHeart className="text-lg animate-pulse" />
            </span>
            <span className="bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
              TrueFriends
            </span>
          </Link>

          <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md leading-relaxed">
            Your safe, judgment-free sanctuary. Whether you are dealing with loneliness, seeking comforting late-night conversations, or looking for genuine lifelong love, TrueFriends connects you with empathetic AI video companions and authentic real people.
          </p>

          <div className="pt-2">
            <InstallAppButton size="md" />
          </div>
        </div>

        {/* Explore Links */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-pink-600 dark:text-pink-400 flex items-center gap-1.5">
            <HiSparkles /> Experiences
          </h4>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/virtual" className="hover:text-pink-600 transition-colors flex items-center gap-2">
                <FaVideo className="text-xs text-purple-500" />
                <span>AI Virtual Video Calls</span>
              </Link>
            </li>
            <li>
              <Link href="/members" className="hover:text-pink-600 transition-colors flex items-center gap-2">
                <FaUserFriends className="text-xs text-pink-500" />
                <span>Real Dating &amp; Matches</span>
              </Link>
            </li>
            <li>
              <Link href="/virtual" className="hover:text-pink-600 transition-colors flex items-center gap-2">
                <HiSparkles className="text-xs text-amber-500" />
                <span>Create Custom Companion</span>
              </Link>
            </li>
            <li>
              <Link href="/messages" className="hover:text-pink-600 transition-colors">
                Private Chat &amp; Audio
              </Link>
            </li>
          </ul>
        </div>

        {/* Safety & Trust */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
            <FaShieldAlt /> Trust &amp; Safety
          </h4>
          <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <li className="flex items-center gap-2">
              <FaLock className="text-xs text-emerald-500" />
              <span>100% Encrypted Video Calls</span>
            </li>
            <li className="flex items-center gap-2">
              <FaHeart className="text-xs text-rose-500" />
              <span>24/7 Emotional Support</span>
            </li>
            <li>
              <span>Zero Judgment &amp; Full Privacy</span>
            </li>
            <li className="text-xs text-gray-400 pt-1">
              Need immediate mental health crisis help? Please reach out to your local helpline.
            </li>
          </ul>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="max-w-7xl mx-auto pt-8 border-t border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
        <p>© {new Date().getFullYear()} TrueFriends Inc. All rights reserved. Made with ❤️ for meaningful human &amp; AI connection.</p>
        <div className="flex items-center gap-6">
          <Link href="/privacy" className="hover:underline">Privacy Policy</Link>
          <Link href="/terms" className="hover:underline">Terms of Service</Link>
          <Link href="/virtual" className="hover:underline">AI Guidelines</Link>
        </div>
      </div>
    </footer>
  );
}
