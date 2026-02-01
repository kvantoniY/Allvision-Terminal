'use client';

import { useMemo, useState } from 'react';
import Modal from '@/shared/ui/Modal/Modal';
import Button from '@/shared/ui/Button/Button';
import Spinner from '@/shared/ui/Spinner/Spinner';
import Composer from '@/shared/ui/Composer/Composer';
import styles from './CommentsModal.module.css';

import { useGetPostCommentsQuery, useAddCommentMutation } from '@/shared/lib/api/socialApi';
import { assetUrl, defaultAvatarUrl } from '@/shared/lib/assetUrl';

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function asArray(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.rows)) return data.rows;
  if (Array.isArray(data.comments)) return data.comments;
  return [];
}

export default function CommentsModal({ isOpen, onClose, postId, authorPublicId = null }) {
  const [offset, setOffset] = useState(0);
  const [text, setText] = useState('');

  const params = useMemo(() => ({ limit: 10, offset }), [offset]);

  const q = useGetPostCommentsQuery(
    { postId, params },
    { skip: !isOpen || !postId }
  );

  const [addComment, addState] = useAddCommentMutation();

  const items = asArray(q.data);

  const onSend = async () => {
    const body = text.trim();
    if (!body) return;
    await addComment({ postId, body, authorPublicId }).unwrap();
    setText('');
    q.refetch?.();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Комментарии">
      <div className={styles.wrap}>
        <div className={styles.list}>
          {q.isLoading ? (
            <div className={styles.state}><Spinner size={18} /> Загрузка…</div>
          ) : null}

          {q.error ? (
            <div className={styles.state}>Не удалось загрузить комментарии</div>
          ) : null}

          {!q.isLoading && !q.error && items.length === 0 ? (
            <div className={styles.state}>Пока нет комментариев</div>
          ) : null}

          {!q.isLoading && !q.error && items.map((c) => {
            const a = c?.Author || c?.author || {};
            const ava = a?.avatarUrl ? assetUrl(a.avatarUrl) : defaultAvatarUrl();
            return (
              <div key={c.id} className={styles.item}>
                <img className={styles.ava} src={ava} alt="" />
                <div className={styles.body}>
                  <div className={styles.top}>
                    <div className={styles.user}>{a.username || 'Пользователь'}</div>
                    <div className={styles.time}>{fmtDate(c.createdAt)}</div>
                  </div>
                  <div className={styles.text}>{c.body}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div className={styles.pager}>
          <Button variant="secondary" disabled={offset === 0 || q.isFetching} onClick={() => setOffset((v) => Math.max(0, v - 10))}>
            Назад
          </Button>
          <Button variant="secondary" disabled={items.length < 10 || q.isFetching} onClick={() => setOffset((v) => v + 10)}>
            Дальше
          </Button>
        </div>

        <div className={styles.compose}>
          <Composer
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Написать комментарий…"
            onSend={onSend}
            disabled={addState.isLoading}
          />
        </div>
      </div>
    </Modal>
  );
}
