'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Card,
  CardBody,
  Button,
  Avatar,
  Input,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Tooltip,
} from '@nextui-org/react';
import {
  FaArrowLeft,
  FaVideo,
  FaPaperPlane,
  FaImage,
  FaLink,
  FaWhatsapp,
  FaCopy,
  FaCheck,
  FaUserPlus,
  FaUsers,
} from 'react-icons/fa';

interface GroupInfo {
  id: string;
  name: string;
  description?: string | null;
  image?: string | null;
  memberCount: number;
  isMember: boolean;
  isAdmin: boolean;
  members: {
    userId: string;
    userName: string;
    userImage?: string | null;
    role: string;
  }[];
}

interface MessageItem {
  id: string;
  groupId: string;
  senderId: string;
  senderName: string;
  senderImage?: string | null;
  text: string;
  mediaUrl?: string | null;
  createdAt: string;
}

export default function GroupChatPage() {
  const params = useParams();
  const groupId = params.groupId as string;

  const [group, setGroup] = useState<GroupInfo | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputText, setInputText] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [showMediaInput, setShowMediaInput] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  };

  const fetchGroup = async () => {
    try {
      const res = await fetch(`/api/groups/${groupId}`);
      const data = await res.json();
      if (data.success && data.group) {
        setGroup(data.group);
      }
    } catch (_) {}
  };

  const fetchMessages = async () => {
    try {
      const res = await fetch(`/api/groups/${groupId}/messages`);
      const data = await res.json();
      if (data.success && Array.isArray(data.messages)) {
        setMessages(data.messages);
      }
    } catch (_) {}
    finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroup();
    fetchMessages();

    // Polling interval for live group chat updates
    const interval = setInterval(fetchMessages, 2500);
    return () => clearInterval(interval);
  }, [groupId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || sending) return;

    const textToSend = inputText.trim();
    const mediaToSend = mediaUrl.trim() || null;
    setInputText('');
    setMediaUrl('');
    setShowMediaInput(false);

    try {
      setSending(true);
      const res = await fetch(`/api/groups/${groupId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textToSend,
          mediaUrl: mediaToSend,
        }),
      });
      const data = await res.json();
      if (data.success && data.message) {
        setMessages((prev) => [...prev, data.message]);
      }
    } catch (_) {
    } finally {
      setSending(false);
    }
  };

  const getInviteUrl = () => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/groups/join/${groupId}`;
    }
    return `https://truefriend.vercel.app/groups/join/${groupId}`;
  };

  const handleCopyInviteLink = () => {
    navigator.clipboard.writeText(getInviteUrl());
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(
      `Hey! Join our group "${group?.name || 'Hangout'}" on TrueFriends for group chat and live group video calls:\n\n${getInviteUrl()}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  return (
    <div className="h-[calc(100vh-5rem)] max-w-4xl mx-auto flex flex-col p-2 sm:p-4 pb-20 sm:pb-4">
      {/* ── TOP GROUP HEADER (WHATSAPP STYLE) ────────────────────────────────── */}
      <Card className="rounded-3xl border border-gray-200/80 dark:border-gray-800 shadow-md bg-white/95 dark:bg-gray-900/95 backdrop-blur-md mb-3 flex-shrink-0">
        <CardBody className="p-3 sm:p-4 flex flex-row items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Link
              href="/groups"
              className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 transition-all flex-shrink-0"
            >
              <FaArrowLeft />
            </Link>

            <Avatar
              src={group?.image || undefined}
              name={group?.name || 'Group'}
              className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-500 text-white font-bold flex-shrink-0 shadow-sm"
            />

            <div className="min-w-0">
              <h1 className="font-extrabold text-sm sm:text-base text-gray-900 dark:text-white truncate">
                {group?.name || 'Loading group...'}
              </h1>
              <p className="text-xs text-gray-400 truncate">
                {group?.members?.length || 1} members • Active now
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            <Button
              size="sm"
              variant="flat"
              className="bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 font-bold rounded-2xl text-xs"
              startContent={<FaUserPlus className="text-xs text-purple-500" />}
              onClick={() => setIsInviteModalOpen(true)}
            >
              Invite
            </Button>

            <Button
              as={Link}
              href={`/groups/call/${groupId}`}
              size="sm"
              className="bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white font-bold rounded-2xl text-xs shadow-md shadow-pink-500/20"
              startContent={<FaVideo className="text-xs animate-pulse" />}
            >
              Video Call
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* ── CHAT MESSAGES CONTAINER ──────────────────────────────────────────── */}
      <Card className="flex-1 rounded-3xl border border-gray-200/80 dark:border-gray-800 shadow-md bg-white/95 dark:bg-gray-900/95 backdrop-blur-md overflow-hidden flex flex-col min-h-0">
        <CardBody className="flex-1 overflow-hidden p-0 flex flex-col">
          <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {loading ? (
            <div className="text-center py-12 space-y-2">
              <div className="w-8 h-8 border-3 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-gray-400">Loading conversation...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-xs">
              No messages yet. Send a greeting to start the conversation!
            </div>
          ) : (
            messages.map((msg, index) => {
              const timeStr = new Date(msg.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <motion.div
                  key={msg.id || index}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-2.5 max-w-[85%] sm:max-w-[70%]"
                >
                  <Avatar
                    src={msg.senderImage || undefined}
                    name={msg.senderName}
                    className="w-7 h-7 text-[10px] flex-shrink-0 mt-0.5"
                  />
                  <div className="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-3 rounded-2xl rounded-tl-sm text-xs space-y-1 shadow-sm">
                    <div className="font-bold text-[11px] text-pink-600 dark:text-pink-400">
                      {msg.senderName}
                    </div>

                    <p className="whitespace-pre-line leading-relaxed text-xs">{msg.text}</p>

                    {msg.mediaUrl && (
                      <div className="rounded-xl overflow-hidden mt-2 max-h-60 border border-gray-200 dark:border-gray-700">
                        <img src={msg.mediaUrl} alt="Attached" className="w-full h-full object-cover" />
                      </div>
                    )}

                    <div className="text-[10px] text-gray-400 text-right pt-0.5">
                      {timeStr}
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
          </div>
        </CardBody>

        {/* ── INPUT BOX (WHATSAPP STYLE) ───────────────────────────────────────── */}
        <div className="p-3 bg-gray-50/90 dark:bg-gray-850 border-t border-gray-200/80 dark:border-gray-800">
          {showMediaInput && (
            <div className="mb-2">
              <Input
                size="sm"
                variant="bordered"
                placeholder="Paste photo link (https://...)"
                value={mediaUrl}
                onValueChange={setMediaUrl}
                startContent={<FaImage className="text-pink-500 text-xs" />}
                className="rounded-xl"
              />
            </div>
          )}

          <form onSubmit={handleSendMessage} className="flex items-center gap-2">
            <Button
              isIconOnly
              size="sm"
              variant="flat"
              className="rounded-xl text-gray-500 bg-white dark:bg-gray-800"
              onClick={() => setShowMediaInput(!showMediaInput)}
              type="button"
            >
              <FaImage className="text-pink-500" />
            </Button>

            <Input
              placeholder="Type a message to group..."
              value={inputText}
              onValueChange={setInputText}
              variant="bordered"
              size="sm"
              classNames={{
                inputWrapper: 'bg-white dark:bg-gray-800 rounded-2xl border-gray-200 dark:border-gray-700',
              }}
            />

            <Button
              type="submit"
              size="sm"
              isIconOnly
              disabled={!inputText.trim() || sending}
              className="bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-2xl flex-shrink-0 shadow-md shadow-pink-500/20"
            >
              <FaPaperPlane className="text-xs" />
            </Button>
          </form>
        </div>
      </Card>

      {/* ── INVITE MEMBERS MODAL ─────────────────────────────────────────────── */}
      <Modal isOpen={isInviteModalOpen} onClose={() => setIsInviteModalOpen(false)} size="md">
        <ModalContent className="rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-2">
          <ModalHeader className="font-extrabold text-base flex items-center gap-2">
            <FaUserPlus className="text-purple-600" />
            Invite Friends to {group?.name || 'Group'}
          </ModalHeader>
          <ModalBody className="space-y-4">
            <p className="text-xs text-gray-500 leading-relaxed">
              Anyone with this link can join this group, chat with members, and participate in live group video calls.
            </p>

            {/* Link Box */}
            <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <Input
                isReadOnly
                size="sm"
                value={getInviteUrl()}
                variant="flat"
                className="text-xs"
              />
              <Button
                size="sm"
                className={`font-bold rounded-xl text-xs ${
                  copiedLink ? 'bg-emerald-600 text-white' : 'bg-purple-600 text-white'
                }`}
                onClick={handleCopyInviteLink}
                startContent={copiedLink ? <FaCheck /> : <FaCopy />}
              >
                {copiedLink ? 'Copied!' : 'Copy'}
              </Button>
            </div>

            {/* WhatsApp Share Button */}
            <Button
              size="md"
              fullWidth
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs shadow-md shadow-emerald-600/30"
              startContent={<FaWhatsapp className="text-base" />}
              onClick={handleShareWhatsApp}
            >
              Share via WhatsApp
            </Button>
          </ModalBody>
          <ModalFooter>
            <Button size="sm" variant="light" onClick={() => setIsInviteModalOpen(false)}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
