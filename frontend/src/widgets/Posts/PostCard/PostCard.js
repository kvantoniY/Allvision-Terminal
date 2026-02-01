'use client';

import Link from 'next/link';
import { useState } from 'react';
import styles from './PostCard.module.css';

import Card from '@/shared/ui/Card/Card';
import IconButton from '@/shared/ui/IconButton/IconButton';
import Spinner from '@/shared/ui/Spinner/Spinner';

import { assetUrl, defaultAvatarUrl } from '@/shared/lib/assetUrl';
import { useMeQuery } from '@/shared/lib/api/authApi';
import { useLikePostMutation, useUnlikePostMutation, useDeletePostMutation } from '@/shared/lib/api/socialApi';

import RepostModal from '@/widgets/Posts/RepostModal/RepostModal';
import PostModal from '@/widgets/Posts/PostModal/PostModal';

function fmtDate(iso) {
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

export default function PostCard({ item, disableOpen = false }) {
  const [isRepostOpen, setRepostOpen] = useState(false);
  const [isPostOpen, setPostOpen] = useState(false);

  const post = item?.post || {};
  const author = post?.Author || {};
  const counts = item?.counts || {};

  const basePostId = item?.basePostId || post?.id;

  const liked = !!item?.meLiked;
  const likesCount = counts.likes ?? 0;
  const commentsCount = counts.comments ?? 0;
  const repostsCount = counts.reposts ?? 0;

  const [like] = useLikePostMutation();
  const [unlike] = useUnlikePostMutation();

  const meQ = useMeQuery();
  const me = meQ.data?.user || null;
  const isMine = !!me?.id && !!author?.id && me.id === author.id;

  const [deletePost, delPostState] = useDeletePostMutation();

  const onDelete = async () => {
    const deleteId = post?.type === 'REPOST' ? post?.id : basePostId;
    if (!deleteId) return;
    if (!confirm('Удалить пост?')) return;
    try {
      await deletePost({ postId: deleteId }).unwrap();
    } catch (_) {}
  };

  const avatar = author?.avatarUrl ? assetUrl(author.avatarUrl) : defaultAvatarUrl();
  const profileHref = author?.publicId ? `/profile/u/${author.publicId}` : '#';

  const onLike = async () => {
    if (!basePostId) return;
    const args = { postId: basePostId, authorPublicId: author?.publicId || null };
    if (liked) await unlike(args).unwrap();
    else await like(args).unwrap();
  };

  const isRepost = post?.type === 'REPOST';
  const original = post?.OriginalPost || null;
  const attachedBet = post?.AttachedBet || null;

  return (
    <>
      <PostModal
        isOpen={isPostOpen}
        onClose={() => setPostOpen(false)}
        item={item}
      />
      <RepostModal
        isOpen={isRepostOpen}
        onClose={() => setRepostOpen(false)}
        postId={basePostId}
        authorPublicId={author?.publicId || null}
      />

      <Card className={styles.card}>
        <div
          className={styles.openArea}
          role={disableOpen ? undefined : 'button'}
          tabIndex={disableOpen ? -1 : 0}
          onClick={() => {
            if (disableOpen) return;
            setPostOpen(true);
          }}
          onKeyDown={(e) => {
            if (disableOpen) return;
            if (e.key === 'Enter') setPostOpen(true);
          }}
        >
          <div className={styles.head}>
            <img className={styles.ava} src={avatar} alt="" />
            <div className={styles.meta}>
              {author?.publicId ? (
                <Link className={styles.user} href={profileHref} onClick={(e) => e.stopPropagation()}>
                  {author.username || 'Пользователь'}
                </Link>
              ) : (
                <div className={styles.user}>{author?.username || 'Пользователь'}</div>
              )}
              <div className={styles.time}>{fmtDate(post?.createdAt)}</div>
            </div>
          </div>

          {isRepost ? <div className={styles.repostBadge}>Репост</div> : null}

          {post?.text ? <div className={styles.text}>{post.text}</div> : null}

          {post?.imageUrl ? (
            <div className={styles.media}>
              <img className={styles.img} src={assetUrl(post.imageUrl)} alt="" />
            </div>
          ) : null}

          {attachedBet ? (
            <div className={styles.betBox}>
              <div className={styles.betTitle}>Прикреплённая ставка</div>
              <div className={styles.betMeta}>
                {attachedBet.team1} vs {attachedBet.team2} · {attachedBet.game} · BO{attachedBet.bo} · Tier {attachedBet.tier} · Кф {attachedBet.odds}
              </div>
            </div>
          ) : null}

          {original ? (
            <div className={styles.original}>
              <div className={styles.originalTitle}>Оригинал</div>
              {original.text ? <div className={styles.originalText}>{original.text}</div> : <div className={styles.originalText}>—</div>}
              {original.imageUrl ? (
                <div className={styles.originalMedia}>
                  <img className={styles.img} src={assetUrl(original.imageUrl)} alt="" />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className={styles.actions}>
          <div className={styles.actionGroup}>
            <IconButton
              className={styles.actionBtn}
              aria-label={liked ? 'Убрать лайк' : 'Лайк'}
              onClick={(e) => {
                e.stopPropagation();
                onLike();
              }}
              type="button"
            >
              {liked ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 21s-6.716-4.35-9.33-7.57C.73 11.27 1.23 7.99 3.74 6.2c2.02-1.44 4.74-1.05 6.35.74L12 9.06l1.91-2.12c1.61-1.79 4.33-2.18 6.35-.74 2.51 1.79 3.01 5.07 1.07 7.23C18.716 16.65 12 21 12 21z" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 21s-6.716-4.35-9.33-7.57C.73 11.27 1.23 7.99 3.74 6.2c2.02-1.44 4.74-1.05 6.35.74L12 9.06l1.91-2.12c1.61-1.79 4.33-2.18 6.35-.74 2.51 1.79 3.01 5.07 1.07 7.23C18.716 16.65 12 21 12 21z" stroke="currentColor" strokeWidth="2" />
                </svg>
              )}
            </IconButton>
            <span className={styles.actionCount}>{likesCount}</span>
          </div>

          <div className={styles.actionGroup}>
            <IconButton
              className={styles.actionBtn}
              aria-label="Комментарии"
              onClick={(e) => {
                e.stopPropagation();
                setPostOpen(true);
              }}
              type="button"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              </svg>
            </IconButton>
            <span className={styles.actionCount}>{commentsCount}</span>
          </div>

          <div className={styles.actionGroup}>
            <IconButton
              className={styles.actionBtn}
              aria-label="Репост"
              onClick={(e) => {
                e.stopPropagation();
                setRepostOpen(true);
              }}
              type="button"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M7 7h11v11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M18 7l-14 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </IconButton>
            <span className={styles.actionCount}>{repostsCount}</span>
          </div>

          {isMine ? (
            <IconButton
              className={styles.actionBtnDanger}
              aria-label="Удалить"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              disabled={delPostState.isLoading}
              type="button"
            >
              {delPostState.isLoading ? (
                <Spinner size={14} />
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M3 6h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M8 6V4h8v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M6 6l1 16h10l1-16" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                </svg>
              )}
            </IconButton>
          ) : null}
        </div>
      </Card>
    </>
  );
}