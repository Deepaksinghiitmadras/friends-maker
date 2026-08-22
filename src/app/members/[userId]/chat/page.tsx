import CardInnerWrapper from "@/components/CardInnerWrapper";
import React from "react";
import ChatForm from "./ChatForm";
import { getMessageThread } from "@/app/actions/messageActions";
import { getAuthUserId } from "@/app/actions/authActions";
import MessageList from "./MessageList";
import { createChatId } from "@/lib/util";

export default async function ChatPage({
  params,
}: {
  params: { userId: string };
}) {
  const messages = await getMessageThread(
    params.userId
  );
  const userId = await getAuthUserId();

  const chatId = createChatId(
    userId,
    params.userId
  );

  const chatHeader = (
    <div className="flex items-center justify-between w-full">
      <span className="font-bold text-lg text-gray-900 dark:text-white">Chat</span>
      <a
        href={`/dating/call/${params.userId}`}
        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white font-bold text-xs shadow-md shadow-pink-500/20 transition-all hover:scale-105"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
        </svg>
        <span>Start Video Call</span>
      </a>
    </div>
  );

  return (
    <CardInnerWrapper
      header={chatHeader}
      body={
        <MessageList
          initialMessages={messages}
          currentUserId={userId}
          chatId={chatId}
          recipientId={params.userId}
        />
      }
      footer={<ChatForm />}
    />
  );
}
