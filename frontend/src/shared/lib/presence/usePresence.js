'use client';

import { useEffect, useMemo, useState } from 'react';
import { getPresence, setPresence, subscribePresence } from './presenceStore';

export function usePresence({ userId, fallbackIsOnline, fallbackLastSeenAt }) {
  const id = userId ? String(userId) : null;

  // Seed store with initial values from API (so Avatar has something immediately)
  useEffect(() => {
    if (!id) return;
    const seed = {};
    if (typeof fallbackIsOnline === 'boolean') seed.isOnline = fallbackIsOnline;
    if (fallbackLastSeenAt) seed.lastSeenAt = fallbackLastSeenAt;
    if (Object.keys(seed).length) setPresence(id, seed);
  }, [id, fallbackIsOnline, fallbackLastSeenAt]);

  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!id) return;
    return subscribePresence(() => setTick((v) => v + 1));
  }, [id]);

  return useMemo(() => {
    if (!id) return { isOnline: !!fallbackIsOnline, lastSeenAt: fallbackLastSeenAt || null };
    const p = getPresence(id) || {};
    return {
      isOnline: typeof p.isOnline === 'boolean' ? p.isOnline : !!fallbackIsOnline,
      lastSeenAt: p.lastSeenAt || fallbackLastSeenAt || null,
      _tick: tick
    };
  }, [id, fallbackIsOnline, fallbackLastSeenAt, tick]);
}
