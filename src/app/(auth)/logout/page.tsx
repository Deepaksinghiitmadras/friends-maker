'use client';

import React, { useEffect, useState } from 'react';
import { signOutUser } from '@/app/actions/authActions';
import { Button, Card, CardBody, CardHeader, Spinner } from '@nextui-org/react';
import Link from 'next/link';
import { FaSignOutAlt, FaCheckCircle } from 'react-icons/fa';

export default function LogoutPage() {
  const [loggingOut, setLoggingOut] = useState(true);
  const [done, setDone] = useState(false);

  useEffect(() => {
    async function performLogout() {
      try {
        await signOutUser();
      } catch (err) {
        console.error('Logout error:', err);
      } finally {
        setLoggingOut(false);
        setDone(true);
        // Redirect to login after 1 second
        setTimeout(() => {
          window.location.href = '/login';
        }, 1200);
      }
    }
    performLogout();
  }, []);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <Card className="max-w-md w-full p-6 text-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl rounded-3xl">
        <CardHeader className="flex flex-col items-center gap-2 pb-2">
          <div className="w-16 h-16 rounded-full bg-pink-500/10 flex items-center justify-center text-pink-500 text-2xl mb-2">
            <FaSignOutAlt />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {loggingOut ? 'Signing you out...' : 'Signed Out Successfully'}
          </h2>
          <p className="text-xs text-gray-500">
            {loggingOut
              ? 'Clearing your authentication session...'
              : 'You have been safely logged out. Redirecting to login...'}
          </p>
        </CardHeader>
        <CardBody className="py-6 flex flex-col items-center gap-4">
          {loggingOut ? (
            <Spinner color="secondary" size="lg" />
          ) : (
            <div className="space-y-4 w-full">
              <div className="inline-flex items-center gap-2 text-emerald-500 text-sm font-semibold">
                <FaCheckCircle />
                <span>Session Cleared</span>
              </div>
              <Button
                as={Link}
                href="/login"
                color="primary"
                fullWidth
                className="bg-gradient-to-r from-pink-500 to-purple-600 font-bold"
              >
                Go to Login
              </Button>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
