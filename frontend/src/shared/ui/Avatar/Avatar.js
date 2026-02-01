import clsx from 'clsx';
import styles from './Avatar.module.css';
import { toApiUrl } from '@/shared/lib/api/baseUrl';
import { usePresence } from '@/shared/lib/presence/usePresence';

function formatLastSeen(v) {
  if (!v) return '';
  const ts = typeof v === 'string' ? Date.parse(v) : (v instanceof Date ? v.getTime() : Number(v));
  if (!Number.isFinite(ts)) return '';
  const d = new Date(ts);
  return d.toLocaleString([], {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });
}

export default function Avatar({
  user,
  src,
  avatarUrl,
  userId,
  isOnline,
  lastSeenAt,
  alt = 'avatar',
  size = 36,
  radius,
  className,
}) {
  const resolvedSrc = user?.avatarUrl ?? avatarUrl ?? src ?? null;
  const resolved = resolvedSrc ? toApiUrl(resolvedSrc) : toApiUrl('/public/default-avatar.png');

  const presence = usePresence({
    userId: user?.id || userId,
    fallbackIsOnline: typeof user?.isOnline === 'boolean' ? user.isOnline : isOnline,
    fallbackLastSeenAt: user?.lastSeenAt || lastSeenAt,
  });

  const title = presence?.isOnline
    ? 'В сети'
    : presence?.lastSeenAt
      ? `Был(а) в сети: ${formatLastSeen(presence.lastSeenAt)}`
      : '';

  return (
    <div className={clsx(styles.wrap, className)} style={{ width: size, height: size }} title={title}>
      <img
        className={styles.avatar}
        src={resolved}
        alt={alt}
        width={size}
        height={size}
        style={{ width: size, height: size, borderRadius: radius ?? undefined }}
        loading="lazy"
      />

      {user?.id || userId ? (
        <span
          className={clsx(styles.presenceDot, presence?.isOnline ? styles.online : styles.offline)}
          aria-label={presence?.isOnline ? 'online' : 'offline'}
        />
      ) : null}
    </div>
  );
}
