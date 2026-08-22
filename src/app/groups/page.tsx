'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Card,
  CardBody,
  Button,
  Avatar,
  Input,
  Textarea,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Switch,
} from '@nextui-org/react';
import {
  FaPlus,
  FaVideo,
  FaComments,
  FaSearch,
  FaUsers,
} from 'react-icons/fa';

interface GroupItem {
  id: string;
  name: string;
  description?: string | null;
  image?: string | null;
  isPublic: boolean;
  memberCount: number;
  isMember: boolean;
  lastMessage?: {
    text: string;
    senderName: string;
    createdAt: string;
  } | null;
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupImage, setNewGroupImage] = useState('');
  const [newGroupPublic, setNewGroupPublic] = useState(true);
  const [creating, setCreating] = useState(false);

  const fetchGroups = async () => {
    try {
      const res = await fetch('/api/groups');
      const data = await res.json();
      if (data.success && Array.isArray(data.groups)) {
        setGroups(data.groups);
      }
    } catch (err) {
      console.error('Failed to load groups:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || creating) return;

    setCreating(true);
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newGroupName.trim(),
          description: newGroupDesc.trim(),
          image: newGroupImage.trim() || null,
          isPublic: newGroupPublic,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIsCreateOpen(false);
        setNewGroupName('');
        setNewGroupDesc('');
        setNewGroupImage('');
        fetchGroups();
      } else {
        alert(data.error || 'Failed to create group');
      }
    } catch (err: any) {
      alert(err.message || 'Network error');
    } finally {
      setCreating(false);
    }
  };

  const filteredGroups = groups.filter(
    (g) =>
      g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (g.description && g.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen py-6 px-3 sm:px-6 max-w-5xl mx-auto space-y-6 pb-24">
      {/* ── HEADER BANNER ────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-700 via-indigo-700 to-pink-600 text-white p-6 sm:p-8 shadow-xl"
      >
        <div className="absolute -top-10 -right-10 w-60 h-60 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-pink-200 text-xs font-bold uppercase tracking-wider mb-2">
              <FaUsers className="text-pink-300" />
              Real Dating &amp; Social Groups
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              Group Chats &amp; Video Hangouts
            </h1>
            <p className="text-sm text-purple-100 mt-1 max-w-lg">
              Join topic groups with real singles and friends, talk in real-time, and jump on multi-person live video calls!
            </p>
          </div>
          <Button
            onClick={() => setIsCreateOpen(true)}
            className="bg-white text-purple-900 font-bold px-6 py-2.5 rounded-2xl shadow-lg hover:scale-105 transition-all text-xs"
            startContent={<FaPlus className="text-pink-600" />}
          >
            + Create New Group
          </Button>
        </div>
      </motion.div>

      {/* ── SEARCH BAR ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search groups by topic or name..."
          value={searchQuery}
          onValueChange={setSearchQuery}
          variant="bordered"
          size="md"
          startContent={<FaSearch className="text-gray-400 text-sm" />}
          classNames={{
            inputWrapper: 'bg-white/90 dark:bg-gray-900/90 rounded-2xl border-gray-200 dark:border-gray-800 shadow-sm',
          }}
        />
      </div>

      {/* ── GROUPS LIST ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <div className="col-span-full text-center py-12 space-y-3">
            <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-gray-400">Loading your groups...</p>
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="col-span-full">
            <Card className="p-8 text-center rounded-3xl border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/70">
              <p className="text-gray-500 text-sm mb-4">No groups found. Be the first to create one!</p>
              <Button
                onClick={() => setIsCreateOpen(true)}
                className="bg-purple-600 text-white font-bold rounded-xl text-xs mx-auto"
                startContent={<FaPlus />}
              >
                Create Group
              </Button>
            </Card>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filteredGroups.map((group) => (
              <motion.div
                key={group.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="rounded-3xl border border-gray-200/80 dark:border-gray-800 shadow-md hover:shadow-xl transition-all duration-300 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md overflow-hidden group">
                  <CardBody className="p-4 sm:p-5 flex flex-col justify-between h-full space-y-4">
                    <div className="flex items-start gap-3.5">
                      <Avatar
                        src={group.image || undefined}
                        name={group.name}
                        className="w-14 h-14 rounded-2xl text-base font-bold bg-gradient-to-tr from-pink-500 to-purple-600 text-white flex-shrink-0 shadow-md"
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h2 className="font-extrabold text-base text-gray-900 dark:text-white truncate">
                            {group.name}
                          </h2>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-300 flex items-center gap-1 flex-shrink-0">
                            <FaUsers className="text-[10px]" /> {group.memberCount}
                          </span>
                        </div>

                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-1">
                          {group.description || 'Welcome to this hangout group! Join in and chat.'}
                        </p>

                        {group.lastMessage && (
                          <div className="mt-2 text-[11px] text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 px-2.5 py-1 rounded-xl truncate flex items-center gap-1">
                            <span className="font-bold text-pink-600">{group.lastMessage.senderName}:</span>
                            <span className="truncate">{group.lastMessage.text}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                      <Button
                        as={Link}
                        href={`/groups/${group.id}`}
                        size="sm"
                        className="bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs shadow-sm"
                        startContent={<FaComments className="text-xs" />}
                      >
                        Open Chat
                      </Button>

                      <Button
                        as={Link}
                        href={`/groups/call/${group.id}`}
                        size="sm"
                        className="bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white font-bold rounded-xl text-xs shadow-sm"
                        startContent={<FaVideo className="text-xs animate-pulse" />}
                      >
                        Group Video Call
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* ── CREATE GROUP MODAL ───────────────────────────────────────────────── */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} size="lg">
        <ModalContent className="rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
          <form onSubmit={handleCreateGroup}>
            <ModalHeader className="font-extrabold text-lg flex items-center gap-2">
              <FaUsers className="text-purple-600" />
              Create a New Group
            </ModalHeader>
            <ModalBody className="space-y-4">
              <Input
                label="Group Name"
                placeholder="e.g. Mumbai Chai &amp; Chill, Tech Singles, Weekend Travelers"
                value={newGroupName}
                onValueChange={setNewGroupName}
                required
                variant="bordered"
                className="rounded-2xl"
              />

              <Textarea
                label="Group Description"
                placeholder="What is this group about? Who should join?"
                value={newGroupDesc}
                onValueChange={setNewGroupDesc}
                minRows={2}
                variant="bordered"
                className="rounded-2xl"
              />

              <Input
                label="Group Icon Image URL (Optional)"
                placeholder="https://... photo link"
                value={newGroupImage}
                onValueChange={setNewGroupImage}
                variant="bordered"
                className="rounded-2xl"
              />

              <div className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 dark:bg-gray-800/60">
                <div>
                  <div className="font-bold text-xs">Public Group</div>
                  <div className="text-[11px] text-gray-400">
                    Anyone can discover, join and participate in group calls
                  </div>
                </div>
                <Switch
                  isSelected={newGroupPublic}
                  onValueChange={setNewGroupPublic}
                  color="secondary"
                  size="sm"
                />
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="light" size="sm" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold rounded-xl"
                isLoading={creating}
              >
                Create Group
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
    </div>
  );
}
