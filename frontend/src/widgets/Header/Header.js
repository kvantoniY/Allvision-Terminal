'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import styles from './Header.module.css';

import Input from '@/shared/ui/Input/Input';
import Avatar from '@/shared/ui/Avatar/Avatar';
import Spinner from '@/shared/ui/Spinner/Spinner';

import { clearToken } from '@/shared/lib/auth/authCookie';
import { useMeQuery } from '@/shared/lib/api/authApi';
import { useGetMyProfileQuery } from '@/shared/lib/api/userApi';

import {
  useGetNotificationsQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
} from '@/shared/lib/api/notificationsApi';

import { useSearchUsersQuery, useSearchPostsQuery } from '@/shared/lib/api/socialApi';
import { assetUrl, defaultAvatarUrl } from '@/shared/lib/assetUrl';

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M13.73 21a2 2 0 0 1-3.46 0"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChevronDown() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path
        d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CommentIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 5h16v11H7l-3 3V5z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RepostIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path
        d="M17 2l4 4-4 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M21 6H10a4 4 0 0 0-4 4v1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M7 22l-4-4 4-4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 18h11a4 4 0 0 0 4-4v-1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function notifText(n) {
  const actor = n?.ActorUser?.username || n?.Actor?.username || 'Пользователь';
  const type = n?.type;

  if (type === 'FOLLOW') return `${actor} подписался на тебя`;
  if (type === 'LIKE_POST') return `${actor} лайкнул твой пост`;
  if (type === 'COMMENT_POST') return `${actor} прокомментировал твой пост`;
  if (type === 'REPOST_POST') return `${actor} сделал репост`;
  return `${actor}: уведомление`;
}

export default function Header() {
  const router = useRouter();
  const { data: meAuth } = useMeQuery();
  const meFromAuth = useMemo(() => meAuth?.user || meAuth || null, [meAuth]);

  const myQ = useGetMyProfileQuery();
  const me = useMemo(() => myQ.data?.user || myQ.data || meFromAuth || null, [myQ.data, meFromAuth]);

  const username = me?.username || '...';
  const myProfileHref = (me?.publicId || meFromAuth?.publicId)
    ? `/profile/u/${me?.publicId || meFromAuth?.publicId}`
    : null;

  // search
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef(null);
  const q = search.trim();

  const usersQ = useSearchUsersQuery({ q, limit: 6 }, { skip: q.length === 0 });
  const postsQ = useSearchPostsQuery({ q, limit: 4, offset: 0 }, { skip: q.length === 0 });

  const users = useMemo(() => {
    const d = usersQ.data;
    if (!d) return [];
    if (Array.isArray(d)) return d;
    if (Array.isArray(d.users)) return d.users;
    return [];
  }, [usersQ.data]);

  const posts = useMemo(() => {
    const d = postsQ.data;
    if (!d) return [];
    if (Array.isArray(d.items)) return d.items;
    if (Array.isArray(d.posts)) return d.posts;
    if (Array.isArray(d)) return d;
    return [];
  }, [postsQ.data]);

  const goSearch = () => {
    const qq = search.trim();
    if (!qq) return;
    setSearchOpen(false);
    router.push(`/search?q=${encodeURIComponent(qq)}`);
  };

  // notifications
  const notifsQ = useGetNotificationsQuery({ limit: 20, offset: 0 });
  const [markRead] = useMarkNotificationReadMutation();
  const [markAllRead, markAllState] = useMarkAllNotificationsReadMutation();

  const notificationsRaw = Array.isArray(notifsQ.data?.notifications) ? notifsQ.data.notifications : [];
  const notifications = notificationsRaw.filter((n) => n.type !== 'MESSAGE');
  const unread = notifications.filter((n) => !n.isRead).length;

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserMenuOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
      if (searchRef.current && !searchRef.current.contains(e.target)) setSearchOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const onLogout = () => {
    clearToken();
    router.replace('/login');
  };

  return (
    <header className={styles.root}>
      <div className={styles.left}>
        <Link href="/feed" className={styles.logo}>Allvision Terminal</Link>
      </div>

      <div className={styles.center}>
        <div className={styles.searchWrap} ref={searchRef}>
          <Input
            className={styles.search}
            placeholder="Поиск пользователей или постов"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setSearchOpen(true); }}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') goSearch();
              if (e.key === 'Escape') setSearchOpen(false);
            }}
          />

          {searchOpen && q.length > 0 ? (
            <div className={styles.searchDropdown}>
              <div className={styles.searchTop}>
                <div className={styles.searchTitle}>Результаты</div>
                <button className={styles.searchAll} onClick={goSearch} type="button">Открыть всё</button>
              </div>

              <div className={styles.searchSection}>
                <div className={styles.searchSectionTitle}>Пользователи</div>

                {usersQ.isLoading ? (
                  <div className={styles.searchState}><Spinner size={14} /> Загрузка…</div>
                ) : users.length === 0 ? (
                  <div className={styles.searchState}>Ничего</div>
                ) : (
                  users.map((u) => {
                    const ava = u?.avatarUrl ? assetUrl(u.avatarUrl) : defaultAvatarUrl();
                    return (
                      <button
                        key={u?.publicId || u?.id}
                        className={styles.searchItem}
                        type="button"
                        onClick={() => {
                          setSearchOpen(false);
                          router.push(`/profile/u/${u?.publicId}`);
                        }}
                      >
                        <img className={styles.searchAva} src={ava} alt="" />
                        <div className={styles.searchMeta}>
                          <div className={styles.searchName}>{u?.username || 'Пользователь'}</div>
                          <div className={styles.searchSub}>/u/{u?.publicId}</div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              <div className={styles.searchSection}>
                <div className={styles.searchSectionTitle}>Посты</div>

                {postsQ.isLoading ? (
                  <div className={styles.searchState}><Spinner size={14} /> Загрузка…</div>
                ) : posts.length === 0 ? (
                  <div className={styles.searchState}>Ничего</div>
                ) : (
                  posts.map((it) => {
                    const post = it?.post || {};
                    const author = post?.Author || {};
                    const text = post?.text || '';
                    const ava = author?.avatarUrl ? assetUrl(author.avatarUrl) : defaultAvatarUrl();

                    const likes = post?.likesCount ?? post?.likes ?? post?.LikesCount ?? null;
                    const comments = post?.commentsCount ?? post?.comments ?? post?.CommentsCount ?? null;
                    const reposts = post?.repostsCount ?? post?.reposts ?? post?.RepostsCount ?? null;

                    return (
                      <button
                        key={post?.id || it?.basePostId}
                        className={styles.searchItem}
                        type="button"
                        onClick={() => {
                          setSearchOpen(false);
                          router.push(`/search?q=${encodeURIComponent(q)}&tab=posts`);
                        }}
                      >
                        <img className={styles.searchAva} src={ava} alt="" />

                        <div className={styles.searchMeta}>
                          <div className={styles.searchPostName}>{author?.username || 'Пользователь'}</div>
                          <div className={styles.searchPostText}>{text ? text.trim() : 'Пост'}</div>

                          <div className={styles.searchPostRow}>
                            <span>{post?.createdAt ? new Date(post.createdAt).toLocaleString() : ''}</span>

                            {likes != null ? (
                              <span className={styles.searchStat}><HeartIcon /> {likes}</span>
                            ) : null}

                            {comments != null ? (
                              <span className={styles.searchStat}><CommentIcon /> {comments}</span>
                            ) : null}

                            {reposts != null ? (
                              <span className={styles.searchStat}><RepostIcon /> {reposts}</span>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className={styles.right}>
        <div className={styles.showOnDesktop}>
          <div className={styles.notifWrap} ref={notifRef}>
            <button
              className={styles.iconBtn}
              aria-label="Уведомления"
              onClick={() => setNotifOpen(v => !v)}
              type="button"
            >
              <BellIcon />
              {unread > 0 ? <span className={styles.badge}>{unread}</span> : null}
            </button>

            {notifOpen ? (
              <div className={styles.notifDropdown}>
                <div className={styles.notifTop}>
                  <div className={styles.notifTitle}>Уведомления</div>
                  <button
                    className={styles.notifAction}
                    onClick={() => markAllRead()}
                    disabled={markAllState.isLoading}
                    type="button"
                  >
                    {markAllState.isLoading ? <Spinner size={14} /> : null}
                    Прочитать все
                  </button>
                </div>

                {notifsQ.isLoading ? (
                  <div className={styles.notifState}><Spinner size={16} /> Загрузка…</div>
                ) : null}

                {!notifsQ.isLoading && notifications.length === 0 ? (
                  <div className={styles.notifState}>Пока нет уведомлений</div>
                ) : null}

                {notifications.length > 0 ? (
                  <div className={styles.notifList}>
                    {notifications.map((n) => (
                      <button
                        key={n.id}
                        className={`${styles.notifItem} ${n.isRead ? styles.notifRead : styles.notifUnread}`}
                        type="button"
                        onClick={async () => {
                          try {
                            if (!n.isRead) await markRead(n.id).unwrap();
                          } catch (_) {}
                          setNotifOpen(false);
                          router.push('/notifications');
                        }}
                      >
                        <div className={styles.notifLine}>
                          <div className={styles.notifText}>{notifText(n)}</div>
                          <div className={styles.notifDate}>
                            {n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className={styles.user} ref={userMenuRef}>
          <button className={styles.userBtn} type="button" onClick={() => setUserMenuOpen(v => !v)}>
            <Avatar user={me} src={me?.avatarUrl ? assetUrl(me.avatarUrl) : defaultAvatarUrl()} size={28} />
            <span className={styles.username}>{username}</span>
            <span className={styles.chev}><ChevronDown /></span>
          </button>

          {userMenuOpen ? (
            <div className={styles.dropdown}>
              {myProfileHref ? (
                <Link
                  href={myProfileHref}
                  className={styles.ddItem}
                  onClick={() => setUserMenuOpen(false)}
                >
                  Профиль
                </Link>
              ) : null}

              <Link href="/settings" className={styles.ddItem} onClick={() => setUserMenuOpen(false)}>
                Настройки
              </Link>

              <button className={styles.ddItemBtn} type="button" onClick={onLogout}>
                Выйти
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
