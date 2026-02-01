'use client';

import Link from 'next/link';
import styles from './messages.module.css';

import Card from '@/shared/ui/Card/Card';
import Spinner from '@/shared/ui/Spinner/Spinner';
import Avatar from '@/shared/ui/Avatar/Avatar';
import { useGetDialogsQuery, useDeleteDialogMutation } from '@/shared/lib/api/messagesApi';
import { useMeQuery } from '@/shared/lib/api/authApi';

function lastPreview(last) {
  if (!last) return 'Нет сообщений';
  if (last.sharedPostId && !last.text) return 'Поделился постом';
  return (last.text || '').slice(0, 120) || 'Сообщение';
}

export default function MessagesPage() {
  const { data: meData } = useMeQuery();
  const me = meData?.user || meData || null;
  const q = useGetDialogsQuery();
  const [deleteDialog, delState] = useDeleteDialogMutation();

  if (q.isLoading) {
    return (
      <div className={styles.root}>
        <Card className={styles.state}>
          <Spinner size={18} />
          <span>Загрузка диалогов…</span>
        </Card>
      </div>
    );
  }

  if (q.error) {
    return (
      <div className={styles.root}>
        <Card className={styles.state}>Не удалось загрузить диалоги</Card>
      </div>
    );
  }

  const dialogs = Array.isArray(q.data?.items)
    ? q.data.items
    : Array.isArray(q.data?.dialogs)
      ? q.data.dialogs
      : [];

  return (
    <div className={styles.root}>
      <div className={styles.title}>Сообщения</div>

      {dialogs.length === 0 ? (
        <Card className={styles.state}>Диалогов пока нет</Card>
      ) : (
        <div className={styles.list}>
          {dialogs.map((d) => {
            const dialogId = d?.id || d?.dialogId;
            const members = Array.isArray(d?.Members)
              ? d.Members
              : Array.isArray(d?.members)
                ? d.members
                : [];
            const peer = d?.peer
              || (me?.id ? members.find((u) => u?.id !== me.id) : members[0])
              || members[0]
              || {};
            const last = d?.lastMessage || null;
            const unread = Number(d?.unreadCount || 0);

            return (
              <div key={dialogId} className={styles.item}>
                <Link href={`/messages/dialogs/${dialogId}`} className={styles.linkArea}>
                  <Avatar size={46} user={peer} src={peer?.avatarUrl || null} />

                  <div className={styles.meta}>
                    <div className={styles.row}>
                      <div className={styles.name}>{peer.username || 'Пользователь'}</div>
                      {unread > 0 ? <div className={styles.badge}>{unread}</div> : null}
                    </div>

                    <div className={styles.last}>{lastPreview(last)}</div>
                  </div>
                </Link>

                <button
                  type="button"
                  className={styles.del}
                  title="Удалить диалог"
                  disabled={delState.isLoading}
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!dialogId) return;
                    if (!confirm('Удалить диалог?')) return;
                    try {
                      await deleteDialog(dialogId).unwrap();
                    } catch (_) {}
                  }}
                >
                  🗑
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
