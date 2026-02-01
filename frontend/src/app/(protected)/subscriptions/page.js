'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

import styles from './subscriptions.module.css';

import Card from '@/shared/ui/Card/Card';
import Button from '@/shared/ui/Button/Button';
import Input from '@/shared/ui/Input/Input';
import Spinner from '@/shared/ui/Spinner/Spinner';

import { useGetMyProfileQuery } from '@/shared/lib/api/userApi';
import {
  useGetFollowersQuery,
  useGetFollowingQuery,
  useGetMyBlacklistQuery,
  useSearchUsersQuery,
} from '@/shared/lib/api/socialApi';

import { assetUrl, defaultAvatarUrl } from '@/shared/lib/assetUrl';

function statusOf(err) {
  return err?.status || err?.originalStatus || err?.data?.status || null;
}

function extractUsers(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;

  if (Array.isArray(data.followers)) return data.followers;
  if (Array.isArray(data.following)) return data.following;

  if (Array.isArray(data.users)) return data.users;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.blocked)) return data.blocked;

  return [];
}

function UserRow({ u, right }) {
  const avatar = u?.avatarUrl ? assetUrl(u.avatarUrl) : defaultAvatarUrl();
  return (
    <div className={styles.userRow}>
      <img className={styles.ava} src={avatar} alt="" />
      <div className={styles.meta}>
        <div className={styles.username}>{u?.username || 'Пользователь'}</div>
        <div className={styles.publicId}>/u/{u?.publicId}</div>
      </div>
      <div className={styles.actions}>
        {right}
        <Link className={styles.profileBtn} href={`/profile/u/${u?.publicId}`}>Профиль</Link>
      </div>
    </div>
  );
}

export default function SubscriptionsPage() {
  const myQ = useGetMyProfileQuery();
  const me = useMemo(() => myQ.data?.user || myQ.data || null, [myQ.data]);
  const publicId = me?.publicId;

  const [tab, setTab] = useState('following'); 
  const [q, setQ] = useState('');

  const followingQ = useGetFollowingQuery(
    { publicId, params: { limit: 200 } },
    { skip: !publicId || tab !== 'following' || !!q.trim() }
  );

  const followersQ = useGetFollowersQuery(
    { publicId, params: { limit: 200 } },
    { skip: !publicId || tab !== 'followers' || !!q.trim() }
  );

  const blacklistQ = useGetMyBlacklistQuery(undefined, { skip: tab !== 'blacklist' || !!q.trim() });

  const searchQ = useSearchUsersQuery({ q: q.trim(), limit: 30 }, { skip: q.trim().length === 0 });

  const activeQ = q.trim()
    ? searchQ
    : tab === 'following'
      ? followingQ
      : tab === 'followers'
        ? followersQ
        : blacklistQ;

  const list = useMemo(() => extractUsers(activeQ.data), [activeQ.data]);
  const errStatus = statusOf(activeQ.error);

  return (
    <div className={styles.root}>
      <div className={styles.top}>
        <div className={styles.title}>Подписки</div>

        <div className={styles.tabs}>
          <button className={`${styles.tab} ${tab === 'following' ? styles.tabActive : ''}`} onClick={() => setTab('following')} type="button">Подписки</button>
          <button className={`${styles.tab} ${tab === 'followers' ? styles.tabActive : ''}`} onClick={() => setTab('followers')} type="button">Подписчики</button>
          <button className={`${styles.tab} ${tab === 'blacklist' ? styles.tabActive : ''}`} onClick={() => setTab('blacklist')} type="button">Чёрный список</button>
        </div>

        <div className={styles.searchRow}>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск пользователей…" />
          {q.trim() ? <Button variant="secondary" onClick={() => setQ('')}>Очистить</Button> : null}
        </div>
      </div>

      <Card className={styles.card}>
        {!publicId && myQ.isLoading ? <div className={styles.state}><Spinner size={18} /> Загрузка…</div> : null}
        {!publicId && !myQ.isLoading ? <div className={styles.state}>Не удалось определить текущего пользователя</div> : null}

        {activeQ.isLoading ? <div className={styles.state}><Spinner size={18} /> Загрузка…</div> : null}

        {activeQ.error ? (
          <div className={styles.state}>
            {errStatus === 403 ? 'Скрыто приватностью' : errStatus === 404 ? 'Недоступно' : 'Ошибка загрузки'}
          </div>
        ) : null}

        {!activeQ.isLoading && !activeQ.error && list.length === 0 ? (
          <div className={styles.state}>{q.trim() ? 'Ничего не найдено' : 'Пусто'}</div>
        ) : null}

        {!activeQ.isLoading && !activeQ.error && list.length > 0 ? (
          <div className={styles.list}>
            {list.map((u) => (
              <UserRow
                key={u?.publicId || u?.id}
                u={u}
                right={tab === 'blacklist' && !q.trim() ? <span className={styles.badge}>Blocked</span> : null}
              />
            ))}
          </div>
        ) : null}

        <div className={styles.footer}>
          <Button variant="secondary" onClick={() => activeQ.refetch?.()} disabled={activeQ.isFetching}>
            {activeQ.isFetching ? <Spinner size={14} /> : null}
            Обновить
          </Button>
        </div>
      </Card>
    </div>
  );
}
