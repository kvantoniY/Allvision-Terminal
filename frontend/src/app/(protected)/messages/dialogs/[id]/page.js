'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import styles from './chat.module.css';

import Card from '@/shared/ui/Card/Card';
import Spinner from '@/shared/ui/Spinner/Spinner';
import Avatar from '@/shared/ui/Avatar/Avatar';
import Composer from '@/shared/ui/Composer/Composer';

import { assetUrl, defaultAvatarUrl } from '@/shared/lib/assetUrl';

import { usePresence } from '@/shared/lib/presence/usePresence';

import { useMeQuery } from '@/shared/lib/api/authApi';
import {
  useGetDialogQuery,
  useGetMessagesQuery,
  useSendMessageMutation,
  useMarkDialogReadMutation,
  useDeleteMessageMutation,
  useEditMessageMutation,
} from '@/shared/lib/api/messagesApi';

function toAsc(descArr) {
  const a = Array.isArray(descArr) ? descArr : [];
  return [...a].reverse();
}

function uniqByIdAsc(arr) {
  const out = [];
  const seen = new Set();
  for (const m of Array.isArray(arr) ? arr : []) {
    const id = m?.id;
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(m);
  }
  return out;
}

function formatLastSeen(v) {
  if (!v) return '';
  const ts = typeof v === 'string' ? Date.parse(v) : (v instanceof Date ? v.getTime() : Number(v));
  if (!Number.isFinite(ts)) return '';
  const d = new Date(ts);
  return d.toLocaleString([], { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function DialogPage() {
  const params = useParams();
  const router = useRouter();
  const dialogId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const { data: meData } = useMeQuery();
  const me = useMemo(() => meData?.user || meData || null, [meData]);

  const dialogQ = useGetDialogQuery(dialogId, { skip: !dialogId });

  // Pagination: offset counts from newest (backend convention in this project).
  // We keep a merged ascending list locally to support "scroll up to load older".
  const limit = 30;
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [messagesAsc, setMessagesAsc] = useState([]);

  const messagesQ = useGetMessagesQuery({ dialogId, limit, offset }, { skip: !dialogId });

  const [sendMessage, sendState] = useSendMessageMutation();
  const [markRead] = useMarkDialogReadMutation();
  const [deleteMessage, deleteState] = useDeleteMessageMutation();
  const [editMessage, editState] = useEditMessageMutation();

  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState('');

  const [text, setText] = useState('');

  const listRef = useRef(null);
  const topSentinelRef = useRef(null);

  // scroll behaviour
  const firstScrollRef = useRef(true);
  const autoScrollEnabledRef = useRef(true);
  const lastMsgIdRef = useRef(null);

  // when we prepend older messages, preserve scroll position
  const pendingPrependRef = useRef({ active: false, prevHeight: 0, prevTop: 0 });

  const [locallyReadAt, setLocallyReadAt] = useState(null);

  // Reset when opening another dialog
  useEffect(() => {
    setOffset(0);
    setHasMore(true);
    setMessagesAsc([]);
    setText('');
    setEditingId(null);
    setEditingText('');
    firstScrollRef.current = true;
    autoScrollEnabledRef.current = true;
    lastMsgIdRef.current = null;
    pendingPrependRef.current = { active: false, prevHeight: 0, prevTop: 0 };
  }, [dialogId]);

  const members = useMemo(() => {
    if (Array.isArray(dialogQ.data?.Members)) return dialogQ.data.Members;
    const m = Array.isArray(dialogQ.data?.members) ? dialogQ.data.members : [];
    return m.map((x) => x?.User).filter(Boolean);
  }, [dialogQ.data]);

  const peer = useMemo(() => {
    if (!me?.id) return members[0] || null;
    return members.find((u) => u?.id !== me.id) || members[0] || null;
  }, [members, me?.id]);

  const peerPresence = usePresence({
    userId: peer?.id,
    fallbackIsOnline: typeof peer?.isOnline === 'boolean' ? peer.isOnline : undefined,
    fallbackLastSeenAt: peer?.lastSeenAt || null,
  });

  // Avatar now resolves URL internally

  const unreadByPeer = useMemo(() => {
    if (Array.isArray(dialogQ.data?.Members)) return 0;
    const arr = Array.isArray(dialogQ.data?.members) ? dialogQ.data.members : [];
    const peerMember = arr.find((m) => m?.userId && m.userId === peer?.id);
    return Number(peerMember?.unreadCount || 0);
  }, [dialogQ.data, peer?.id]);

  const peerLastReadAt = useMemo(() => {
    if (Array.isArray(dialogQ.data?.Members)) return null;
    const arr = Array.isArray(dialogQ.data?.members) ? dialogQ.data.members : [];
    const peerMember = arr.find((m) => m?.userId && m.userId === peer?.id);
    return peerMember?.lastReadAt || null;
  }, [dialogQ.data, peer?.id]);

  // Merge pages into local list.
  useEffect(() => {
    if (!dialogId) return;
    if (!messagesQ.data) return;

    const pageItemsAsc = toAsc(messagesQ.data?.items);

    // hasMore: if returned less than limit, we reached the beginning
    setHasMore(pageItemsAsc.length === limit);

    setMessagesAsc((prev) => {
      if (offset === 0) {
        return uniqByIdAsc(pageItemsAsc);
      }
      // Prepend older messages to the top.
      return uniqByIdAsc([...pageItemsAsc, ...prev]);
    });
  }, [dialogId, messagesQ.data, offset]);

  // Mark dialog as read on open
  useEffect(() => {
    if (!dialogId) return;
    (async () => {
      try {
        await markRead(dialogId).unwrap?.();
      } catch (_) {}
      setLocallyReadAt(Date.now());
    })();
  }, [dialogId, markRead]);

  // If a new last message is from peer -> mark read
  useEffect(() => {
    if (!dialogId) return;
    if (!messagesAsc.length) return;

    const last = messagesAsc[messagesAsc.length - 1];
    const senderId = last?.Sender?.id;

    if (me?.id && senderId && senderId !== me.id) {
      (async () => {
        try {
          await markRead(dialogId).unwrap?.();
        } catch (_) {}
        setLocallyReadAt(Date.now());
      })();
    }
  }, [messagesAsc, dialogId, me?.id, markRead]);

  // Track user position: if user is near bottom -> enable auto scroll
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    const onScroll = () => {
      const nearBottom = el.scrollHeight - (el.scrollTop + el.clientHeight) < 140;
      autoScrollEnabledRef.current = nearBottom;
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // IntersectionObserver: load older when scrolling near top
  useEffect(() => {
    const rootEl = listRef.current;
    const sentinel = topSentinelRef.current;
    if (!rootEl || !sentinel) return;

    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (!e?.isIntersecting) return;
        if (!hasMore) return;
        if (messagesQ.isFetching) return;
        if (!messagesAsc.length) return;

        // preserve current scroll position before prepend
        const prevHeight = rootEl.scrollHeight;
        const prevTop = rootEl.scrollTop;
        pendingPrependRef.current = { active: true, prevHeight, prevTop };
        setOffset((v) => v + limit);
      },
      {
        root: rootEl,
        rootMargin: '200px 0px 0px 0px',
        threshold: 0,
      }
    );

    io.observe(sentinel);
    return () => io.disconnect();
  }, [hasMore, messagesQ.isFetching, messagesAsc.length, limit]);

  // Apply scroll adjustments after messages update
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;

    // 1) After prepending older messages, keep viewport stable
    if (pendingPrependRef.current.active) {
      const { prevHeight, prevTop } = pendingPrependRef.current;
      const nextHeight = el.scrollHeight;
      const delta = nextHeight - prevHeight;
      el.scrollTop = prevTop + delta;
      pendingPrependRef.current = { active: false, prevHeight: 0, prevTop: 0 };
      return;
    }

    // 2) First open: scroll to bottom
    if (firstScrollRef.current && messagesAsc.length > 0 && offset === 0) {
      el.scrollTop = el.scrollHeight;
      firstScrollRef.current = false;
      lastMsgIdRef.current = messagesAsc[messagesAsc.length - 1]?.id || null;
      return;
    }

    // 3) New message appended: if user is near bottom, scroll down
    const lastId = messagesAsc[messagesAsc.length - 1]?.id || null;
    const prevLastId = lastMsgIdRef.current;
    lastMsgIdRef.current = lastId;

    if (lastId && prevLastId && lastId !== prevLastId && autoScrollEnabledRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messagesAsc, offset]);

  const onSend = async () => {
    const v = text.trim();
    if (!v || !peer?.publicId) return;

    setText('');

    try {
      await sendMessage({ toPublicId: peer.publicId, text: v, sharedPostId: null }).unwrap();
      // we just sent -> keep stick to bottom
      autoScrollEnabledRef.current = true;
    } catch (_) {
      setText(v);
    }
  };

  if (dialogQ.isLoading) {
    return (
      <div className={styles.root}>
        <Card className={styles.state}><Spinner size={18} /> Загрузка диалога…</Card>
      </div>
    );
  }

  if (dialogQ.error) {
    return (
      <div className={styles.root}>
        <Card className={styles.state}>Диалог недоступен</Card>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.top}>
        <div
          className={styles.peerClickable}
          role="button"
          tabIndex={0}
          onClick={() => {
            if (peer?.publicId) router.push(`/profile/u/${peer.publicId}`);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && peer?.publicId) router.push(`/profile/u/${peer.publicId}`);
          }}
        >
          <Avatar size={36} user={peer} />
          <div className={styles.peer}>
            <div className={styles.peerName}>{peer?.username || 'Диалог'}</div>
            <div className={styles.peerHint}>
              {peerPresence?.isOnline
                ? 'В сети'
                : peerPresence?.lastSeenAt
                  ? `Был(а) в сети: ${formatLastSeen(peerPresence.lastSeenAt)}`
                  : 'Не в сети'
              }
            </div>
          </div>
        </div>
      </div>

      <div className={styles.chat}>
        <div className={styles.list} ref={listRef}>
          <div ref={topSentinelRef} className={styles.topSentinel} />

          {messagesQ.isFetching && offset > 0 ? (
            <div className={styles.loadingMore}><Spinner size={14} /> Загружаем ещё…</div>
          ) : null}

          {messagesQ.isLoading && offset === 0 ? (
            <div className={styles.loading}><Spinner size={18} /> Загрузка сообщений…</div>
          ) : null}

          {messagesAsc.map((m, idx) => {
            const sender = m?.Sender || {};
            const isMine = !!me?.id && sender?.id === me.id;
            const shared = m?.SharedPost || null;
            const peerReadTs = peerLastReadAt ? Date.parse(peerLastReadAt) : null;
            const msgTs = m?.createdAt ? Date.parse(m.createdAt) : null;
            const isReadByPeer =
              isMine &&
              Number.isFinite(peerReadTs) &&
              Number.isFinite(msgTs) &&
              msgTs <= peerReadTs;

            return (
              <div key={m.id} className={`${styles.msgRow} ${isMine ? styles.mineRow : styles.theirRow}`}>
                <div className={`${styles.msg} ${isMine ? styles.mine : styles.their}`}>
                  <div className={styles.msgText}>
                    {editingId === m.id ? (
                      <textarea
                        className={styles.editInput}
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        rows={2}
                      />
                    ) : (
                      <>{m.text ? m.text : ''}</>
                    )}
                  </div>

                  {m.sharedPostId ? (
                    <div className={styles.sharedBox} role="button" tabIndex={0}>
                      <div className={styles.sharedTitle}>Репост поста</div>
                      {shared?.text ? <div className={styles.sharedText}>{shared.text}</div> : <div className={styles.sharedText}>—</div>}
                      {shared?.imageUrl ? (
                        <img className={styles.sharedImg} src={assetUrl(shared.imageUrl)} alt="" />
                      ) : null}
                    </div>
                  ) : null}

                  <div className={styles.msgMeta}>
                    <span className={styles.time}>
                      {m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>

                    {isMine ? (
                      <>
                        <span className={styles.read}>{isReadByPeer ? '✓✓' : '✓'}</span>

                        {editingId === m.id ? (
                          <>
                            <button
                              type="button"
                              className={styles.miniBtn}
                              title="Сохранить"
                              disabled={editState.isLoading}
                              onClick={async () => {
                                try {
                                  const next = (editingText || '').trim();
                                  if (!m.sharedPostId && !next) return;

                                  await editMessage({ messageId: m.id, dialogId, text: next }).unwrap();
                                  setEditingId(null);
                                  setEditingText('');
                                  // allow cache to update, but refetch keeps current page fresh
                                  messagesQ.refetch?.();
                                } catch (_) {}
                              }}
                            >
                              💾
                            </button>
                            <button
                              type="button"
                              className={styles.miniBtn}
                              title="Отмена"
                              disabled={editState.isLoading}
                              onClick={() => {
                                setEditingId(null);
                                setEditingText('');
                              }}
                            >
                              ✖
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className={styles.miniBtn}
                            title="Редактировать"
                            disabled={editState.isLoading}
                            onClick={() => {
                              setEditingId(m.id);
                              setEditingText(m.text || '');
                            }}
                          >
                            ✏️
                          </button>
                        )}

                        <button
                          type="button"
                          className={styles.delBtn}
                          title="Удалить сообщение"
                          disabled={deleteState.isLoading}
                          onClick={async () => {
                            try {
                              await deleteMessage(m.id).unwrap();
                              messagesQ.refetch?.();
                            } catch (_) {}
                          }}
                        >
                          🗑
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}

          {!messagesQ.isFetching && !messagesQ.isLoading && messagesAsc.length === 0 ? (
            <div className={styles.empty}>Сообщений пока нет</div>
          ) : null}

          {!hasMore && messagesAsc.length > 0 ? (
            <div className={styles.reachedTop}>Начало диалога</div>
          ) : null}
        </div>

        <div className={styles.inputRow}>
          <Composer
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Напиши сообщение…"
            onSend={onSend}
            disabled={sendState.isLoading}
            rows={1}
          />
        </div>
      </div>
    </div>
  );
}
