'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

import styles from './search.module.css';

import Card from '@/shared/ui/Card/Card';
import Input from '@/shared/ui/Input/Input';
import Spinner from '@/shared/ui/Spinner/Spinner';

import { useSearchUsersQuery, useSearchPostsQuery } from '@/shared/lib/api/socialApi';
import { assetUrl, defaultAvatarUrl } from '@/shared/lib/assetUrl';

import PostCard from '@/widgets/Posts/PostCard/PostCard';

function pickUsers(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.users)) return data.users;
  if (Array.isArray(data.items)) return data.items;
  return [];
}

function pickPosts(data) {
  if (!data) return [];
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.posts)) return data.posts;
  if (Array.isArray(data)) return data;
  return [];
}

export default function SearchPage() {
  const sp = useSearchParams();
  const initialQ = sp.get('q') || '';
  const initialTab = sp.get('tab') || 'users';

  const [q, setQ] = useState(initialQ);
  const [tab, setTab] = useState(initialTab === 'posts' ? 'posts' : 'users');

  const qTrim = q.trim();

  const usersQ = useSearchUsersQuery(
    { q: qTrim, limit: 25 },
    { skip: qTrim.length === 0 || tab !== 'users' }
  );

  const postsQ = useSearchPostsQuery(
    { q: qTrim, limit: 10, offset: 0 },
    { skip: qTrim.length === 0 || tab !== 'posts' }
  );

  const users = useMemo(() => pickUsers(usersQ.data), [usersQ.data]);
  const posts = useMemo(() => pickPosts(postsQ.data), [postsQ.data]);

  const activeQ = tab === 'users' ? usersQ : postsQ;

  return (
    <div className={styles.root}>
      <div className={styles.top}>
        <div className={styles.title}>Поиск</div>

        <div className={styles.searchRow}>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск пользователей или постов…"
          />
        </div>

        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${tab === 'users' ? styles.tabActive : ''}`}
            onClick={() => setTab('users')}
            type="button"
          >
            Пользователи
          </button>
          <button
            className={`${styles.tab} ${tab === 'posts' ? styles.tabActive : ''}`}
            onClick={() => setTab('posts')}
            type="button"
          >
            Посты
          </button>
        </div>
      </div>

      {qTrim.length === 0 ? (
        <Card className={styles.state}>Введи запрос для поиска</Card>
      ) : (
        <>
          {activeQ.isLoading ? (
            <Card className={styles.state}><Spinner size={18} /> Загрузка…</Card>
          ) : null}

          {activeQ.error ? (
            <Card className={styles.state}>Ошибка поиска</Card>
          ) : null}

          {tab === 'users' && !usersQ.isLoading && !usersQ.error ? (
            <div className={styles.list}>
              {users.length === 0 ? (
                <Card className={styles.state}>Ничего не найдено</Card>
              ) : (
                <Card className={styles.card}>
                  <div className={styles.users}>
                    {users.map((u) => {
                      const avatar = u?.avatarUrl ? assetUrl(u.avatarUrl) : defaultAvatarUrl();
                      return (
                        <div key={u?.publicId || u?.id} className={styles.userRow}>
                          <img className={styles.ava} src={avatar} alt="" />
                          <div className={styles.meta}>
                            <div className={styles.username}>{u?.username || 'Пользователь'}</div>
                            <div className={styles.publicId}>/u/{u?.publicId}</div>
                          </div>
                          <Link className={styles.openBtn} href={`/profile/u/${u?.publicId}`}>
                            Открыть
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}
            </div>
          ) : null}

          {tab === 'posts' && !postsQ.isLoading && !postsQ.error ? (
            <div className={styles.posts}>
              {posts.length === 0 ? (
                <Card className={styles.state}>Ничего не найдено</Card>
              ) : (
                posts.map((it) => (
                  <PostCard key={it?.post?.id || it?.basePostId} item={it} />
                ))
              )}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
