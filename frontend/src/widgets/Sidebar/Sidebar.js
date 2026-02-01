'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './Sidebar.module.css';

import { useGetDialogsQuery } from '@/shared/lib/api/messagesApi';

function Icon({ name }) {
  // Small, semantic icons (stroke only) to match the UI style
  if (name === 'feed') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === 'terminal') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M4 5h16v14H4z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M7 9l2 2-2 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M11 13h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === 'messages') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M4 5h16v11H7l-3 3V5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M7 9h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M7 12h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === 'subs') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path
          d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" stroke="currentColor" strokeWidth="2" />
        <path d="M20 8v6M17 11h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  return null;
}

function NavItem({ href, label, icon, isActive, badge }) {
  return (
    <Link href={href} className={`${styles.item} ${isActive ? styles.active : ''}`}>
      <span className={styles.icon} aria-hidden>
        <Icon name={icon} />
      </span>

      <span className={styles.label}>{label}</span>

      {badge > 0 && (
        <span className={styles.badge}>
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </Link>
  );
}

export default function Sidebar() {
  const pathname = usePathname();

  const { data } = useGetDialogsQuery();

  const unreadDialogs = (data?.dialogs || []).reduce(
    (sum, d) => sum + (d?.unreadCount || 0),
    0
  );

  return (
    <div className={styles.root}>
      <div className={styles.title}>Навигация</div>

      <div className={styles.list}>
        <NavItem
          href="/feed"
          label="Лента"
          icon="feed"
          isActive={pathname.startsWith('/feed')}
        />

        <NavItem
          href="/terminal"
          label="Терминал"
          icon="terminal"
          isActive={pathname.startsWith('/terminal')}
        />

        <NavItem
          href="/messages"
          label="Сообщения"
          icon="messages"
          isActive={pathname.startsWith('/messages')}
          badge={unreadDialogs}
        />

        <NavItem
          href="/subscriptions"
          label="Подписки"
          icon="subs"
          isActive={pathname.startsWith('/subscriptions')}
        />
      </div>

      <div className={styles.hint}>
        Настройки профиля доступны в меню пользователя справа сверху.
      </div>
    </div>
  );
}
