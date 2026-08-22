import { useCallback, useEffect, useRef } from 'react';
import usePresenceStore from './usePresenceStore';
import { Channel, Members } from 'pusher-js';
import { pusherClient } from '@/lib/pusher';
import { updateLastActive } from '@/app/actions/memberActions';

export const usePresenceChannel = (userId: string | null, profileComplete: boolean) => {
  const { set, add, remove } = usePresenceStore((state) => ({
    set: state.set,
    add: state.add,
    remove: state.remove,
  }));
  const channelRef = useRef<Channel | null>(null);

  const handleSetMembers = useCallback(
    (memberIds: string[]) => {
      set(memberIds);
    },
    [set]
  );

  const handleAddMember = useCallback(
    (memberId: string) => {
      add(memberId);
    },
    [add]
  );

  const handleRemoveMember = useCallback(
    (memberId: string) => {
      remove(memberId);
    },
    [remove]
  );

  // 1. Pusher Presence Channel
  useEffect(() => {
    if (!userId || !profileComplete) return;

    try {
      if (!channelRef.current) {
        channelRef.current = pusherClient.subscribe('presence-friends-maker');

        channelRef.current.bind('pusher:subscription_succeeded', async (members: Members) => {
          handleSetMembers(Object.keys(members.members));
          await updateLastActive();
        });

        channelRef.current.bind('pusher:member_added', (member: Record<string, any>) => {
          handleAddMember(member.id);
        });

        channelRef.current.bind('pusher:member_removed', (member: Record<string, any>) => {
          handleRemoveMember(member.id);
        });
      }
    } catch (_) {}

    return () => {
      if (channelRef.current) {
        try {
          channelRef.current.unsubscribe();
          channelRef.current.unbind('pusher:subscription_succeeded', handleSetMembers);
          channelRef.current.unbind('pusher:member_added', handleAddMember);
          channelRef.current.unbind('pusher:member_removed', handleRemoveMember);
        } catch (_) {}
      }
    };
  }, [handleAddMember, handleRemoveMember, handleSetMembers, userId, profileComplete]);

  // 2. Fallback DB Presence Heartbeat + Polling (100% Reliable across all devices)
  useEffect(() => {
    if (!userId) return;

    // Send initial heartbeat
    fetch('/api/presence', { method: 'POST' }).catch(() => {});

    // Poll online users
    const pollOnlineUsers = async () => {
      try {
        const res = await fetch('/api/presence');
        const data = await res.json();
        if (data.success && Array.isArray(data.onlineUserIds)) {
          // Always ensure current logged-in user is included in online list
          const combined = Array.from(new Set([...data.onlineUserIds, userId]));
          handleSetMembers(combined);
        }
      } catch (_) {}
    };

    pollOnlineUsers();

    // Heartbeat every 30 seconds
    const heartbeatTimer = setInterval(() => {
      fetch('/api/presence', { method: 'POST' }).catch(() => {});
    }, 30000);

    // Online poll every 15 seconds
    const pollTimer = setInterval(pollOnlineUsers, 15000);

    return () => {
      clearInterval(heartbeatTimer);
      clearInterval(pollTimer);
    };
  }, [userId, handleSetMembers]);
};