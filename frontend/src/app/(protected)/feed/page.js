'use client';

import { useMemo, useState } from 'react';
import styles from './feed.module.css';

import Card from '@/shared/ui/Card/Card';
import Button from '@/shared/ui/Button/Button';
import Spinner from '@/shared/ui/Spinner/Spinner';
import Skeleton from '@/shared/ui/Skeleton/Skeleton';

import { useGetFeedQuery } from '@/shared/lib/api/socialApi';
import PostCard from '@/widgets/Posts/PostCard/PostCard';
import CreatePostModal from '@/widgets/Posts/CreatePostModal/CreatePostModal';

export default function FeedPage() {
  const [scope, setScope] = useState('all'); // all | following
  const [offset, setOffset] = useState(0);
  const [isCreateOpen, setCreateOpen] = useState(false);

  const params = useMemo(() => ({ scope, limit: 10, offset }), [scope, offset]);
  const q = useGetFeedQuery(params);

  const items = q.data?.items || [];

  return (
    <div className={styles.root}>
      <div className={styles.top}>
        <div className={styles.title}>Лента</div>

        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${scope === 'all' ? styles.tabActive : ''}`}
            onClick={() => { setScope('all'); setOffset(0); }}
          >
            Вся лента
          </button>
          <button
            className={`${styles.tab} ${scope === 'following' ? styles.tabActive : ''}`}
            onClick={() => { setScope('following'); setOffset(0); }}
          >
            Подписки
          </button>
        </div>

        <Button onClick={() => setCreateOpen(true)}>Новый пост</Button>
      </div>

      <CreatePostModal isOpen={isCreateOpen} onClose={() => setCreateOpen(false)} />

      <div className={styles.list}>
        {q.isLoading && Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className={styles.skel}><Skeleton height={120} /></Card>
        ))}

        {q.error && <div className={styles.state}>Ошибка загрузки ленты</div>}

        {!q.isLoading && !q.error && items.map((it) => (
          <PostCard key={it?.post?.id || it?.basePostId} item={it} />
        ))}

        {!q.isLoading && items.length === 0 && <div className={styles.state}>Пока нет постов</div>}
      </div>

      <div className={styles.pager}>
        <Button
          variant="secondary"
          disabled={offset === 0 || q.isFetching}
          onClick={() => setOffset((v) => Math.max(0, v - 10))}
        >
          Назад
        </Button>

        <div className={styles.pageInfo}>
          {q.isFetching ? <Spinner size={14} /> : null}
          <span>Страница: {Math.floor(offset / 10) + 1}</span>
        </div>

        <Button
          variant="secondary"
          disabled={items.length < 10 || q.isFetching}
          onClick={() => setOffset((v) => v + 10)}
        >
          Дальше
        </Button>
      </div>
    </div>
  );
}
