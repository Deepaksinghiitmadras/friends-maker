'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Card, CardBody, Button, Avatar } from '@nextui-org/react';
import { FaUsers, FaCheckCircle, FaSpinner } from 'react-icons/fa';
import { HiSparkles } from 'react-icons/hi2';

export default function JoinGroupPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.groupId as string;

  const [group, setGroup] = useState<any>(null);
  const [status, setStatus] = useState<'joining' | 'success' | 'error'>('joining');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function joinGroup() {
      try {
        // 1. Fetch group metadata
        const resGroup = await fetch(`/api/groups/${groupId}`);
        const dataGroup = await resGroup.json();

        if (!dataGroup.success || !dataGroup.group) {
          setStatus('error');
          setErrorMessage(dataGroup.error || 'Group not found');
          return;
        }

        setGroup(dataGroup.group);

        // 2. Join the group
        const resJoin = await fetch(`/api/groups/${groupId}/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'join' }),
        });

        if (resJoin.status === 401) {
          // User not logged in: redirect to login with return URL
          router.push(`/login?callbackUrl=/groups/join/${groupId}`);
          return;
        }

        const dataJoin = await resJoin.json();
        if (dataJoin.success) {
          setStatus('success');
          setTimeout(() => {
            router.push(`/groups/${groupId}`);
          }, 1500);
        } else {
          setStatus('error');
          setErrorMessage(dataJoin.error || 'Could not join group');
        }
      } catch (err: any) {
        setStatus('error');
        setErrorMessage(err.message || 'Something went wrong');
      }
    }

    if (groupId) {
      joinGroup();
    }
  }, [groupId, router]);

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        <Card className="rounded-3xl border border-gray-200/80 dark:border-gray-800 shadow-2xl bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl p-6 text-center">
          <CardBody className="space-y-6 items-center">
            {group ? (
              <Avatar
                src={group.image || undefined}
                name={group.name}
                className="w-24 h-24 text-2xl font-bold bg-gradient-to-tr from-pink-500 to-purple-600 text-white shadow-xl ring-4 ring-purple-500/20"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-purple-100 dark:bg-purple-950/60 flex items-center justify-center text-3xl text-purple-600">
                <FaUsers />
              </div>
            )}

            <div>
              <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">
                {group?.name || 'Joining Group...'}
              </h1>
              <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
                {group?.description || 'You were invited to join this group chat & video room on TrueFriends.'}
              </p>
            </div>

            {status === 'joining' && (
              <div className="flex items-center gap-2 text-purple-600 font-bold text-sm">
                <FaSpinner className="animate-spin" />
                <span>Joining group &amp; connecting chats...</span>
              </div>
            )}

            {status === 'success' && (
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2 text-emerald-500 font-extrabold text-base">
                  <FaCheckCircle className="text-xl" />
                  <span>Joined Successfully!</span>
                </div>
                <p className="text-xs text-gray-400">Opening conversation...</p>
              </div>
            )}

            {status === 'error' && (
              <div className="space-y-3">
                <p className="text-xs text-red-500 font-medium">{errorMessage}</p>
                <Button
                  onClick={() => router.push('/groups')}
                  className="bg-purple-600 text-white font-bold rounded-xl text-xs"
                >
                  Go to Groups
                </Button>
              </div>
            )}
          </CardBody>
        </Card>
      </motion.div>
    </div>
  );
}
