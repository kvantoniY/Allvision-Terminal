'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './BottomNav.module.css';

function Icon({ name }) {
  if (name === 'feed') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    );
  }
  if (name === 'terminal') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M4 5h16v14H4z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M7 9l3 3-3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 15h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === 'messages') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M4 5h16v11H7l-3 3V5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
        <path d="M7 9h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M7 12h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === 'subs') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" stroke="currentColor" strokeWidth="2"/>
        <path d="M20 8v6M17 11h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    );
  }
  return null;
}

function Item({ href, active, icon, ariaLabel }) {
  return (
    <Link href={href} className={`${styles.item} ${active ? styles.active : ''}`} aria-label={ariaLabel}>
      <Icon name={icon} />
    </Link>
  );
}

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <div className={styles.root}>
      <Item href="/feed" icon="feed" ariaLabel="Лента" active={pathname.startsWith('/feed')} />
      <Item href="/terminal" icon="terminal" ariaLabel="Терминал" active={pathname.startsWith('/terminal')} />
      <Item href="/messages" icon="messages" ariaLabel="Сообщения" active={pathname.startsWith('/messages')} />
      <Item href="/subscriptions" icon="subs" ariaLabel="Подписки" active={pathname.startsWith('/subscriptions')} />
    </div>
  );
}
