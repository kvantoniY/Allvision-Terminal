'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';

export default function NotFound() {
  const router = useRouter();

  useEffect(() => {
    const token = Cookies.get('av_token');
    router.replace(token ? '/feed' : '/login');
  }, [router]);

  return null;
}
