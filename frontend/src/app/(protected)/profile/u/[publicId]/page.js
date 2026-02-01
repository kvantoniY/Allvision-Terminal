'use client';

import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState, useEffect } from 'react';
import styles from './profile.module.css';

import Card from '@/shared/ui/Card/Card';
import Button from '@/shared/ui/Button/Button';
import Spinner from '@/shared/ui/Spinner/Spinner';
import Skeleton from '@/shared/ui/Skeleton/Skeleton';
import Avatar from '@/shared/ui/Avatar/Avatar';

import { assetUrl, defaultAvatarUrl } from '@/shared/lib/assetUrl';

import { useMeQuery } from '@/shared/lib/api/authApi';
import { useGetProfileBundleQuery, useGetUserStatsQuery } from '@/shared/lib/api/profileApi';
import {
  useFollowMutation,
  useUnfollowMutation,
  useGetFollowersQuery,
  useGetFollowingQuery,
  useGetUserPostsQuery,
} from '@/shared/lib/api/socialApi';

import UsersListModal from '@/widgets/Profile/UsersListModal/UsersListModal';
import PostCard from '@/widgets/Posts/PostCard/PostCard';
import SendMessageModal from '@/widgets/Profile/SendMessageModal/SendMessageModal';
import BetCard from '@/widgets/Terminal/BetCard/BetCard';
import { useSendMessageMutation, useGetDialogsQuery } from '@/shared/lib/api/messagesApi';
import { useGetUserBetsQuery, useDeleteBetMutation } from '@/shared/lib/api/terminalApi';

import { usePresence } from '@/shared/lib/presence/usePresence';

function errStatus(err) {
  return err?.status || err?.originalStatus || err?.data?.status || null;
}

function formatLastSeen(v) {
  if (!v) return '';
  const ts = typeof v === 'string' ? Date.parse(v) : (v instanceof Date ? v.getTime() : Number(v));
  if (!Number.isFinite(ts)) return '';
  const d = new Date(ts);
  return d.toLocaleString([], { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function ProfilePage() {
  const router = useRouter();
  const params = useParams();
  const publicIdRaw = params?.publicId ?? params?.id;
  const publicId = Array.isArray(publicIdRaw) ? publicIdRaw[0] : publicIdRaw;

  // текущий пользователь: /auth/me
  const { data: meData } = useMeQuery();
  const me = useMemo(() => meData?.user || meData || null, [meData]);

  const [tab, setTab] = useState('posts');
  const [postsOffset, setPostsOffset] = useState(0);
  const [betsOffset, setBetsOffset] = useState(0);

  const [followersOpen, setFollowersOpen] = useState(false);
  const [followingOpen, setFollowingOpen] = useState(false);

  // статистика профиля
  const [statsRange, setStatsRange] = useState('all');

  // профиль bundle: /profile/u/:publicId (user + privacy + meta + relationship)
  const profileQ = useGetProfileBundleQuery(publicId, { skip: !publicId });

  const status = errStatus(profileQ.error);

  const user = profileQ.data?.user || {};
  const meta = profileQ.data?.meta || {};
  const relationship = profileQ.data?.relationship || {};

  const userPresence = usePresence({
    userId: user?.id,
    fallbackIsOnline: typeof user?.isOnline === 'boolean' ? user.isOnline : undefined,
    fallbackLastSeenAt: user?.lastSeenAt || null,
  });

  const isMe = relationship?.isMe ?? (!!me?.id && !!user?.id && me.id === user.id);

  const followersQ = useGetFollowersQuery(
    { publicId, params: { limit: 200 } }, 
    { skip: !publicId }
  );

  const followingQ = useGetFollowingQuery(
    { publicId, params: { limit: 200 } },
    { skip: !publicId }
  );

  const [amFollowingLocal, setAmFollowingLocal] = useState(null);

  const amFollowingFromServer = useMemo(() => {
    if (typeof relationship?.amFollowing === 'boolean') return relationship.amFollowing;
    if (!me?.id) return false;
    const arr = Array.isArray(followersQ.data?.followers) ? followersQ.data.followers : [];
    return arr.some((u) => u?.id === me.id);
  }, [relationship?.amFollowing, followersQ.data, me?.id]);

  const amFollowing = amFollowingLocal === null ? amFollowingFromServer : amFollowingLocal;

  useEffect(() => {
    setAmFollowingLocal(null);
  }, [amFollowingFromServer, publicId]);

  const [follow, followState] = useFollowMutation();
  const [unfollow, unfollowState] = useUnfollowMutation();

  // messages
  const dialogsQ = useGetDialogsQuery(undefined, { skip: !publicId || isMe });
  const [sendMessage, sendState] = useSendMessageMutation();
  const [msgOpen, setMsgOpen] = useState(false);

  const busy = followState.isLoading || unfollowState.isLoading;

  const avatar = user.avatarUrl ? assetUrl(user.avatarUrl) : defaultAvatarUrl();

  const statsQ = useGetUserStatsQuery(
    { publicId, params: { range: statsRange } },
    { skip: !publicId }
  );

  const stats = statsQ.data?.stats || null;
  const winratePct = stats?.winrate != null ? Math.round(Number(stats.winrate) * 1000) / 10 : null;
  const roiPct = stats?.roi != null ? Math.round(Number(stats.roi) * 10000) / 100 : null;

  // посты пользователя
  const postsParams = useMemo(
    () => ({ publicId, params: { filter: 'all', limit: 10, offset: postsOffset } }),
    [publicId, postsOffset]
  );
  const postsQ = useGetUserPostsQuery(postsParams, { skip: !publicId || tab !== 'posts' });

  // ставки профиля (через отдельный эндпоинт бэкенда)
  const canShowBets = (user?.Privacy?.showBets ?? true) || isMe;

  const userBetsParams = useMemo(
    () => ({ publicId, params: { limit: 20, offset: betsOffset, sort: 'createdAt', order: 'desc' } }),
    [publicId, betsOffset]
  );
  const betsQ = useGetUserBetsQuery(userBetsParams, { skip: !publicId || tab !== 'bets' || !canShowBets });

  const [deleteBet, deleteBetState] = useDeleteBetMutation();
  const onDeleteBet = async (betId) => {
    if (!betId) return;
    if (!confirm('Удалить ставку?')) return;
    try {
      await deleteBet({ betId }).unwrap();
    } catch (_) {}
  };

  const bets = useMemo(() => (Array.isArray(betsQ.data?.items) ? betsQ.data.items : []), [betsQ.data]);

  const onToggleFollow = async () => {
    if (!publicId || isMe) return;

    setAmFollowingLocal((prev) => {
      const cur = prev === null ? amFollowingFromServer : prev;
      return !cur;
    });

    try {
      if (amFollowingFromServer) {
        // отписка DELETE /users/u/:publicId/follow
        await unfollow(publicId).unwrap();
      } else {
        // подписка POST /users/u/:publicId/follow
        await follow(publicId).unwrap();
      }
      profileQ.refetch?.();
      followersQ.refetch?.();
      followingQ.refetch?.();
    } catch (e) {
      setAmFollowingLocal(null);
    }
  };

  const onSendFirstMessage = async (text) => {
    if (!publicId) return;
    const res = await sendMessage({ toPublicId: publicId, text, sharedPostId: null }).unwrap();
    const message = res?.message || res; 
    const dialogId = message?.dialogId;
    setMsgOpen(false);
    if (dialogId) router.push(`/messages/dialogs/${dialogId}`);
  };

  if (profileQ.isLoading) {
    return (
      <div className={styles.root}>
        <Card className={styles.headCard}><Skeleton height={140} /></Card>
        <Card className={styles.block}><Skeleton height={220} /></Card>
      </div>
    );
  }

  if (profileQ.error) {
    const msg =
      status === 403 ? 'Скрыто настройками приватности' :
      status === 404 ? 'Пользователь не найден' :
      'Ошибка загрузки профиля';

    return (
      <div className={styles.root}>
        <Card className={styles.state}>
          <div className={styles.stateTitle}>{msg}</div>
          <div className={styles.stateHint}>Попробуй обновить страницу или перейти в ленту.</div>
        </Card>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <SendMessageModal
        isOpen={msgOpen}
        onClose={() => setMsgOpen(false)}
        onSend={onSendFirstMessage}
        loading={sendState.isLoading}
      />
      <UsersListModal
        isOpen={followersOpen}
        onClose={() => setFollowersOpen(false)}
        title="Подписчики"
        query={followersQ}
      />

      <UsersListModal
        isOpen={followingOpen}
        onClose={() => setFollowingOpen(false)}
        title="Подписки"
        query={followingQ}
      />

      <Card className={styles.headCard}>
        <div className={styles.head}>
          <Avatar className={styles.ava} size={92} radius={18} user={user} />

          <div className={styles.main}>
            <div className={styles.rowTop}>
              <div className={styles.usernameLine}>
                <div className={styles.username}>{user.username || 'Пользователь'}</div>
                {isMe ? <span className={styles.meBadge}>Это же ты!</span> : null}
              </div>
              <div className={styles.publicId}>/u/{user.publicId || publicId}</div>
              <div className={styles.lastSeen}>
                {userPresence?.isOnline
                  ? 'В сети'
                  : userPresence?.lastSeenAt
                    ? `Был(а) в сети: ${formatLastSeen(userPresence.lastSeenAt)}`
                    : ''}
              </div>
            </div>

            {user.bio
              ? <div className={styles.bio}>{user.bio}</div>
              : <div className={styles.bioMuted}>Описание профиля не заполнено</div>
            }

            <div className={styles.metaGrid}>
              <button type="button" className={styles.metaItemBtn} onClick={() => setFollowersOpen(true)}>
                <div className={styles.metaLabel}>Подписчики</div>
                <div className={styles.metaValue}>{meta.followersCount ?? 0}</div>
              </button>

              <button type="button" className={styles.metaItemBtn} onClick={() => setFollowingOpen(true)}>
                <div className={styles.metaLabel}>Подписки</div>
                <div className={styles.metaValue}>{meta.followingCount ?? 0}</div>
              </button>
            </div>

            <div className={styles.statsBox}>
              <div className={styles.statsTop}>
                <div className={styles.statsTitle}>Статистика</div>
                <select
                  className={styles.statsSelect}
                  value={statsRange}
                  onChange={(e) => setStatsRange(e.target.value)}
                >
                  <option value="7d">7 дней</option>
                  <option value="30d">30 дней</option>
                  <option value="90d">90 дней</option>
                  <option value="all">Всё время</option>
                </select>
              </div>

              {statsQ.isLoading ? (
                <div className={styles.statsState}><Spinner size={16} /> Загрузка статистики…</div>
              ) : null}

              {statsQ.error ? (
                <div className={styles.statsState}>
                  {errStatus(statsQ.error) === 403 ? 'Скрыто настройками приватности' : 'Не удалось загрузить статистику'}
                </div>
              ) : null}

              {!statsQ.isLoading && !statsQ.error && stats ? (
                <div className={styles.statsGrid}>
                  <div className={styles.statItem}>
                    <div className={styles.statLabel}>Винрейт</div>
                    <div className={styles.statValue}>{winratePct != null ? `${winratePct}%` : '—'}</div>
                  </div>
                  <div className={styles.statItem}>
                    <div className={styles.statLabel}>Ставок</div>
                    <div className={styles.statValue}>{stats.betsTotal ?? 0}</div>
                  </div>
                  <div className={styles.statItem}>
                    <div className={styles.statLabel}>Профит</div>
                    <div className={styles.statValue}>{stats.profitSum != null ? Math.round(Number(stats.profitSum) * 100) / 100 : 0}</div>
                  </div>
                  <div className={styles.statItem}>
                    <div className={styles.statLabel}>ROI</div>
                    <div className={styles.statValue}>{roiPct != null ? `${roiPct}%` : '—'}</div>
                  </div>

                  <div className={styles.statItem}>
                    <div className={styles.statLabel}>Win / Lose</div>
                    <div className={styles.statValue}>{stats.wins ?? 0} / {stats.losses ?? 0}</div>
                  </div>
                  <div className={styles.statItem}>
                    <div className={styles.statLabel}>Pending</div>
                    <div className={styles.statValue}>{stats.pending ?? 0}</div>
                  </div>
                  <div className={styles.statItem}>
                    <div className={styles.statLabel}>Сумма ставок</div>
                    <div className={styles.statValue}>{stats.stakeSum != null ? Math.round(Number(stats.stakeSum) * 100) / 100 : 0}</div>
                  </div>
                  <div className={styles.statItem}>
                    <div className={styles.statLabel}>Средний кф</div>
                    <div className={styles.statValue}>{stats.avgOdds != null ? Math.round(Number(stats.avgOdds) * 100) / 100 : '—'}</div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className={styles.actions}>
            {!isMe ? (
              <>
                <Button onClick={onToggleFollow} disabled={busy || followersQ.isLoading}>
                  {(busy || followersQ.isLoading) ? <Spinner size={16} /> : null}
                  {amFollowing ? 'Отписаться' : 'Подписаться'}
                </Button>

                
                  <Button
                    variant="secondary"
                    onClick={() => {
                      const dialogs = Array.isArray(dialogsQ.data?.items)
                        ? dialogsQ.data.items
                        : Array.isArray(dialogsQ.data?.dialogs)
                          ? dialogsQ.data.dialogs
                          : [];
                      const found = dialogs.find((d) => {
                        const members = Array.isArray(d?.Members)
                          ? d.Members
                          : Array.isArray(d?.members)
                            ? d.members
                            : [];
                        const peer = d?.peer || (me?.id ? members.find((u) => u?.id !== me.id) : members[0]) || members[0] || {};
                        return peer?.publicId === publicId;
                      });
                      const dialogId = found?.id || found?.dialogId;
                      if (dialogId) {
                        router.push(`/messages/dialogs/${dialogId}`);
                        return;
                      }
                      setMsgOpen(true);
                    }}
                    disabled={sendState.isLoading}
                  >
                    Написать сообщение
                  </Button>
                
              </>
            ) : null}
          </div>
        </div>
      </Card>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === 'posts' ? styles.tabActive : ''}`}
          onClick={() => { setTab('posts'); setPostsOffset(0); }}
        >
          Посты
        </button>

        <button
          className={`${styles.tab} ${tab === 'bets' ? styles.tabActive : ''}`}
          onClick={() => { setTab('bets'); setBetsOffset(0); }}
        >
          Ставки
        </button>
      </div>

      {tab === 'posts' ? (
        <div className={styles.block}>
          {postsQ.isLoading ? (
            <Card className={styles.state}><Spinner size={18} /> Загрузка постов…</Card>
          ) : null}

          {postsQ.error ? (
            <Card className={styles.state}>Не удалось загрузить посты</Card>
          ) : null}

          {!postsQ.isLoading && !postsQ.error ? (
            <>
              {(postsQ.data?.items || []).map((it) => (
                <PostCard key={it?.post?.id || it?.basePostId} item={it} />
              ))}

              {(postsQ.data?.items || []).length === 0 ? (
                <Card className={styles.state}>Постов пока нет</Card>
              ) : null}

              <div className={styles.pager}>
                <Button
                  variant="secondary"
                  disabled={postsOffset === 0 || postsQ.isFetching}
                  onClick={() => setPostsOffset((v) => Math.max(0, v - 10))}
                >
                  Назад
                </Button>

                <div className={styles.pageInfo}>
                  {postsQ.isFetching ? <Spinner size={14} /> : null}
                  <span>Страница: {Math.floor(postsOffset / 10) + 1}</span>
                </div>

                <Button
                  variant="secondary"
                  disabled={(postsQ.data?.items || []).length < 10 || postsQ.isFetching}
                  onClick={() => setPostsOffset((v) => v + 10)}
                >
                  Дальше
                </Button>
              </div>
            </>
          ) : null}
        </div>
      ) : (
        <div className={styles.block}>
          {!canShowBets ? (
            <Card className={styles.state}>Ставки скрыты настройками приватности</Card>
          ) : (
            <>
              {betsQ.isLoading ? (
                <Card className={styles.state}><Spinner size={18} /> Загрузка ставок…</Card>
              ) : null}

              {betsQ.error ? (
                <Card className={styles.state}>Не удалось загрузить ставки</Card>
              ) : null}

              {!betsQ.isLoading && !betsQ.error ? (
                <>
                  {bets.map((b) => (
                    <BetCard key={b.id} bet={b} isOpen={false} onDelete={isMe ? onDeleteBet : undefined} />
                  ))}

                  {bets.length === 0 ? (
                    <Card className={styles.state}>Ставок пока нет</Card>
                  ) : null}

                  <div className={styles.pager}>
                    <Button
                      variant="secondary"
                      disabled={betsOffset === 0 || betsQ.isFetching}
                      onClick={() => setBetsOffset((v) => Math.max(0, v - 20))}
                    >
                      Назад
                    </Button>

                    <div className={styles.pageInfo}>
                      {betsQ.isFetching ? <Spinner size={14} /> : null}
                      <span>Страница: {Math.floor(betsOffset / 20) + 1}</span>
                    </div>

                    <Button
                      variant="secondary"
                      disabled={(betsQ.data?.items || []).length < 20 || betsQ.isFetching}
                      onClick={() => setBetsOffset((v) => v + 20)}
                    >
                      Дальше
                    </Button>
                  </div>
                </>
              ) : null}
            </>
          )}
        </div>
      )}
    </div>
  );
}