'use client';

import { useEffect, useState } from 'react';

export function useUsersMe() {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setErr] = useState(null);

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
    const ac = new AbortController();

    (async () => {
      try {
        setLoading(true);

        const res = await fetch(`${base}/users/me`, {
          method: 'GET',
          credentials: 'include', 
          headers: { accept: 'application/json' },
          signal: ac.signal,
        });

        if (!res.ok) {
          setMe(null);
          setLoading(false);
          return;
        }

        const data = await res.json();
        setMe(data?.user || null);
        setLoading(false);
      } catch (e) {
        if (e.name !== 'AbortError') {
          setErr(e);
          setMe(null);
          setLoading(false);
        }
      }
    })();

    return () => ac.abort();
  }, []);

  return { me, loading, error };
}
