'use client';

import { useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { usePathname } from 'next/navigation';

import { getSocket, closeSocket } from './socket';
import { api } from '@/shared/lib/api/apiSlice';
import { useMeQuery } from '@/shared/lib/api/authApi';
import { setPresence } from '@/shared/lib/presence/presenceStore';

export default function useRealtime() {
  const dispatch = useDispatch();
  const pathname = usePathname();

  const { data: meData } = useMeQuery();
  const me = meData?.user || meData;

  const msgSoundRef = useRef(null);
  const notifSoundRef = useRef(null);

  useEffect(() => {
    if (!me?.id) return;
    msgSoundRef.current = new Audio('/sounds/message.mp3');
    notifSoundRef.current = new Audio('/sounds/notification.mp3');

    let alive = true;

    (async () => {
      const socket = await getSocket();
      if (!alive) return;

      socket.emit('join', { room: `user:${me.id}` });

      // Seed current user's presence as online locally
      setPresence(me.id, { isOnline: true });

      // ====== MESSAGE ======
      socket.on('message:new', ({ message }) => {
        if (!message) return;
        const inDialog =
          pathname?.startsWith('/messages/dialogs/') &&
          pathname.endsWith(message.dialogId);

        if (!inDialog) {
          msgSoundRef.current?.play().catch(() => {});
        }

        dispatch(
          api.util.invalidateTags([
            { type: 'Messages', id: message.dialogId },
            { type: 'Dialogs', id: 'LIST' },
            { type: 'Dialogs', id: message.dialogId },
          ])
        );
      });

      // ====== MESSAGE EDIT ======
      socket.on('message:edit', ({ message }) => {
        if (!message?.dialogId) return;
        dispatch(
          api.util.invalidateTags([
            { type: 'Messages', id: message.dialogId },
            { type: 'Dialogs', id: 'LIST' },
            { type: 'Dialogs', id: message.dialogId },
          ])
        );
      });

      // ====== DIALOG UPDATE ======
      socket.on('dialog:update', ({ dialogId }) => {
        if (!dialogId) return;

        dispatch(
          api.util.invalidateTags([
            { type: 'Dialogs', id: dialogId },
            { type: 'Dialogs', id: 'LIST' },
            { type: 'Messages', id: dialogId },
          ])
        );
      });

      // ====== NOTIFICATION ======
      socket.on('notification:new', (payload) => {

        if (payload?.type === 'MESSAGE') return;

        notifSoundRef.current?.play().catch(() => {});
        dispatch(api.util.invalidateTags([{ type: 'Notifications', id: 'LIST' }]));
      });

      socket.on('notification:unread', () => {
        dispatch(api.util.invalidateTags([{ type: 'Notifications', id: 'UNREAD' }]));
      });

      // ====== PRESENCE ======
      socket.on('presence:update', (payload) => {
        const userId = payload?.userId;
        if (!userId) return;

        setPresence(userId, {
          isOnline: !!payload?.isOnline,
          lastSeenAt: payload?.lastSeenAt || null,
        });
      });
    })();

    return () => {
      alive = false;
      closeSocket();
    };
  }, [me?.id, pathname, dispatch]);
}
