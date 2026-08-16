'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { FaUserFriends } from 'react-icons/fa';
import { HiSparkles } from 'react-icons/hi2';
import { clsx } from 'clsx';

export default function ModeToggle() {
  const pathname = usePathname();
  const router = useRouter();

  const isVirtualMode = pathname.startsWith('/virtual');

  const handleModeSwitch = (mode: 'real' | 'virtual') => {
    if (mode === 'virtual' && !isVirtualMode) {
      router.push('/virtual');
    } else if (mode === 'real' && isVirtualMode) {
      router.push('/members');
    }
  };

  return (
    <div className="relative flex items-center bg-gray-100/90 dark:bg-gray-800/90 backdrop-blur-md p-1 rounded-full border border-gray-200/80 shadow-inner max-w-fit">
      {/* Real Dating Button */}
      <button
        onClick={() => handleModeSwitch('real')}
        className={clsx(
          'relative z-10 flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs md:text-sm font-semibold transition-colors duration-200 cursor-pointer',
          !isVirtualMode ? 'text-white' : 'text-gray-600 hover:text-gray-900'
        )}
        type="button"
        aria-label="Switch to Real Dating mode"
      >
        <FaUserFriends className="text-sm" />
        <span>Real Dating</span>
      </button>

      {/* AI Virtual Companion Button */}
      <button
        onClick={() => handleModeSwitch('virtual')}
        className={clsx(
          'relative z-10 flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs md:text-sm font-semibold transition-colors duration-200 cursor-pointer',
          isVirtualMode ? 'text-white' : 'text-gray-600 hover:text-gray-900'
        )}
        type="button"
        aria-label="Switch to AI Virtual Companions mode"
      >
        <HiSparkles className="text-sm text-amber-300 animate-pulse" />
        <span>AI Virtual</span>
      </button>

      {/* Sliding Pill Indicator */}
      <motion.div
        className={clsx(
          'absolute top-1 bottom-1 rounded-full shadow-md transition-all',
          isVirtualMode
            ? 'bg-gradient-to-r from-purple-600 to-pink-500'
            : 'bg-gradient-to-r from-pink-500 to-rose-500'
        )}
        layout
        transition={{ type: 'spring', stiffness: 450, damping: 35 }}
        style={{
          left: isVirtualMode ? '50%' : '4px',
          right: isVirtualMode ? '4px' : '50%',
        }}
      />
    </div>
  );
}
