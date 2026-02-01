'use client';

import Modal from '@/shared/ui/Modal/Modal';
import Spinner from '@/shared/ui/Spinner/Spinner';
import Button from '@/shared/ui/Button/Button';
import styles from './UsersListModal.module.css';
import { assetUrl, defaultAvatarUrl } from '@/shared/lib/assetUrl';

function extractUsers(data) {
  if (!data) return [];
  if (Array.isArray(data.followers)) return data.followers;
  if (Array.isArray(data.following)) return data.following;
  return [];
}

export default function UsersListModal({ isOpen, onClose, title, query }) {
  const q = query;
  const users = extractUsers(q.data);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className={styles.list}>
        {q.isLoading && (
          <div className={styles.state}>
            <Spinner size={18} /> Загрузка…
          </div>
        )}

        {q.error && <div className={styles.state}>Ошибка загрузки списка</div>}

        {!q.isLoading && !q.error && users.length === 0 && <div className={styles.state}>Пользователей нет</div>}

        {!q.isLoading &&
          !q.error &&
          users.map((u) => {
            const avatar = u.avatarUrl ? assetUrl(u.avatarUrl) : defaultAvatarUrl();

            return (
              <div key={u.publicId} className={styles.item}>
                <img src={avatar} className={styles.ava} alt="" />
                <div className={styles.meta}>
                  <div className={styles.username}>{u.username}</div>
                  <div className={styles.publicId}>/u/{u.publicId}</div>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    window.location.href = `/profile/u/${u.publicId}`;
                    onClose?.();
                  }}
                >
                  Профиль
                </Button>
              </div>
            );
          })}
      </div>
    </Modal>
  );
}
