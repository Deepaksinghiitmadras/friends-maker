"use client";

import { MessageDto } from "@/types";
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import MessageBox from "./MessageBox";
import { pusherClient } from "@/lib/pusher";
import { formatShortDateTime } from "@/lib/util";
import useMessageStore from "@/hooks/useMessageStore";

type Props = {
  initialMessages: {
    messages: MessageDto[];
    readCount: number;
  };
  currentUserId: string;
  chatId: string;
  recipientId?: string;
};

export default function MessageList({
  initialMessages,
  currentUserId,
  chatId,
  recipientId,
}: Props) {
  const [messages, setMessages] = useState(
    initialMessages.messages
  );

  useEffect(() => {
    setMessages(initialMessages.messages);
  }, [initialMessages.messages]);

  const setReadCount = useRef(false);

  const { updateUnreadCount } = useMessageStore(
    (state) => ({
      updateUnreadCount: state.updateUnreadCount,
    })
  );

  useEffect(() => {
    if (!setReadCount.current) {
      updateUnreadCount(
        -initialMessages.readCount
      );
      setReadCount.current = true;
    }
  }, [
    initialMessages.readCount,
    updateUnreadCount,
  ]);

  const handleNewMessage = useCallback(
    (message: MessageDto) => {
      setMessages((prevState) => {
        if (prevState.some((m) => m.id === message.id)) return prevState;
        return [...prevState, message];
      });
    },
    []
  );

  const handleReadMessages = useCallback(
    (messageIds: string[]) => {
      setMessages((prevState) =>
        prevState.map((message) =>
          messageIds.includes(message.id)
            ? {
                ...message,
                dateRead: formatShortDateTime(
                  new Date()
                ),
              }
            : message
        )
      );
    },
    []
  );

  useEffect(() => {
    try {
      const channel = pusherClient.subscribe(chatId);
      channel.bind("message:new", handleNewMessage);
      channel.bind("messages:read", handleReadMessages);

      return () => {
        channel.unsubscribe();
        channel.unbind("message:new", handleNewMessage);
        channel.unbind("messages:read", handleReadMessages);
      };
    } catch (_) {}
  }, [chatId, handleNewMessage, handleReadMessages]);

  // Live polling synchronization (guarantees delivery on both devices even if Pusher is offline)
  useEffect(() => {
    if (!recipientId) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/messages/thread?recipientId=${recipientId}`);
        const data = await res.json();
        if (data.success && Array.isArray(data.messages)) {
          setMessages(data.messages);
        }
      } catch (_) {}
    }, 2500);

    return () => clearInterval(pollInterval);
  }, [recipientId]);

  return (
    <div>
      {messages.length === 0 ? (
        "No messages to display"
      ) : (
        <>
          {messages.map((message) => (
            <MessageBox
              key={message.id}
              message={message}
              currentUserId={currentUserId}
            />
          ))}
        </>
      )}
    </div>
  );
}
