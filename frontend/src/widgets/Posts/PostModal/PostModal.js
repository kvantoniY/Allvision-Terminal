'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Modal from '@/shared/ui/Modal/Modal';
import Button from '@/shared/ui/Button/Button';
import Spinner from '@/shared/ui/Spinner/Spinner';
import Avatar from '@/shared/ui/Avatar/Avatar';
import Card from '@/shared/ui/Card/Card';
import Composer from '@/shared/ui/Composer/Composer';

import styles from './PostModal.module.css';

import { assetUrl } from '@/shared/lib/assetUrl';
import { useMeQuery } from '@/shared/lib/api/authApi';
import {
  useGetPostCommentsQuery,
  useAddCommentMutation,
  useDeleteCommentMutation,
  useDeletePostMutation,
} from '@/shared/lib/api/socialApi';

function fmtDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function PostModal({ isOpen, onClose, item }) {
  const post = item?.post || {};
  const author = post?.Author || {};
  const basePostId = item?.basePostId || post?.id;

  const { data: meData } = useMeQuery();
  const me = meData?.user || meData || null;
    const isMine = !!me?.id && !!author?.id && me.id === author.id;

  const baseAuthor = post?.type === 'REPOST' ? (post?.OriginalPost?.Author || {}) : author;
  const isBaseMine = !!me?.id && !!baseAuthor?.id && me.id === baseAuthor.id;

  const [text, setText] = useState('');

  const commentsQ = useGetPostCommentsQuery(
    { postId: basePostId, params: { limit: 50, offset: 0 } },
    { skip: !isOpen || !basePostId }
  );

  const comments = useMemo(() => {
    const d = commentsQ.data;
    if (!d) return [];
    if (Array.isArray(d.items)) return d.items;
    if (Array.isArray(d.comments)) return d.comments;
    return [];
  }, [commentsQ.data]);

  const [addComment, addState] = useAddCommentMutation();
  const [deleteComment, delCommentState] = useDeleteCommentMutation();
  const [deletePost, delPostState] = useDeletePostMutation();

  const onSubmit = async () => {
    const v = text.trim();
    if (!v || !basePostId) return;
    try {
      await addComment({ postId: basePostId, body: v }).unwrap();
      setText('');
      commentsQ.refetch?.();
    } catch (_) {}
  };

  const onDeletePost = async () => {
    const deleteId = post?.type === 'REPOST' ? post?.id : basePostId;
    if (!deleteId) return;
    if (!confirm('Удалить пост?')) return;
    try {
      await deletePost({ postId: deleteId }).unwrap();
      onClose?.();
    } catch (_) {}
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Пост">
      <div className={styles.wrap}>
        <div className={styles.head}>
          <div className={styles.authorLine}>
            <Avatar size={44} user={author} src={author?.avatarUrl || null} />
            <div className={styles.authorMeta}>
              {author?.publicId ? (
                <Link className={styles.authorName} href={`/profile/u/${author.publicId}`}>
                  {author.username || 'Пользователь'}
                </Link>
              ) : (
                <div className={styles.authorName}>{author?.username || 'Пользователь'}</div>
              )}
              <div className={styles.time}>{fmtDateTime(post?.createdAt)}</div>
            </div>
          </div>

          {isMine ? (
            <Button variant="secondary" onClick={onDeletePost} disabled={delPostState.isLoading}>
              {delPostState.isLoading ? <Spinner size={14} /> : null}
              Удалить пост
            </Button>
          ) : null}
        </div>

        {post?.type === 'REPOST' ? <div className={styles.repostBadge}>Репост</div> : null}

        {post?.text ? <div className={styles.text}>{post.text}</div> : null}

        {post?.imageUrl ? (
          <div className={styles.media}>
            <img className={styles.img} src={assetUrl(post.imageUrl)} alt="" />
          </div>
        ) : null}

        {post?.OriginalPost ? (
          <Card className={styles.original}>
            <div className={styles.originalTitle}>Оригинал</div>
            {post.OriginalPost.text ? <div className={styles.originalText}>{post.OriginalPost.text}</div> : <div className={styles.originalText}>—</div>}
            {post.OriginalPost.imageUrl ? (
              <img className={styles.img} src={assetUrl(post.OriginalPost.imageUrl)} alt="" />
            ) : null}
          </Card>
        ) : null}

        <div className={styles.commentsBlock}>
          <div className={styles.commentsTitle}>Комментарии</div>

          <div className={styles.commentInputRow}>
            <Composer
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Написать комментарий…"
              onSend={onSubmit}
              disabled={addState.isLoading}
              rows={2}
            />
          </div>

          {commentsQ.isLoading ? (
            <div className={styles.state}><Spinner size={14} /> Загрузка…</div>
          ) : null}

          {!commentsQ.isLoading && comments.length === 0 ? (
            <div className={styles.state}>Комментариев пока нет</div>
          ) : null}

          <div className={styles.commentsList}>
            {comments.map((c) => {
              const a = c?.Author || {};
              const mine = !!me?.id && !!a?.id && me.id === a.id;
              return (
                <div key={c.id} className={styles.comment}>
                  <Avatar size={34} user={a} src={a?.avatarUrl || null} />
                  <div className={styles.commentBody}>
                    <div className={styles.commentTop}>
                      {a?.publicId ? (
                        <Link className={styles.commentAuthor} href={`/profile/u/${a.publicId}`}>
                          {a.username || 'Пользователь'}
                        </Link>
                      ) : (
                        <div className={styles.commentAuthor}>{a?.username || 'Пользователь'}</div>
                      )}
                      <div className={styles.commentTime}>{fmtDateTime(c.createdAt)}</div>
                      {(mine || isBaseMine) ? (
                        <button
                          type="button"
                          className={styles.commentDelete}
                          title="Удалить комментарий"
                          disabled={delCommentState.isLoading}
                          onClick={async () => {
                            try {
                              await deleteComment({ postId: basePostId, commentId: c.id }).unwrap();
                              commentsQ.refetch?.();
                            } catch (_) {}
                          }}
                        >
                          Удалить
                        </button>
                      ) : null}
                    </div>
                    <div className={styles.commentText}>{c.body}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}
