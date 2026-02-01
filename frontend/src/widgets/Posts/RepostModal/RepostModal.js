'use client';

import { useMemo, useState } from 'react';
import Modal from '@/shared/ui/Modal/Modal';
import Button from '@/shared/ui/Button/Button';
import Spinner from '@/shared/ui/Spinner/Spinner';
import styles from './RepostModal.module.css';

import Input from '@/shared/ui/Input/Input';
import { useRepostMutation, useSearchUsersQuery } from '@/shared/lib/api/socialApi';
import { useSendMessageMutation } from '@/shared/lib/api/messagesApi';
import { assetUrl, defaultAvatarUrl } from '@/shared/lib/assetUrl';

export default function RepostModal({ isOpen, onClose, postId, authorPublicId = null }) {
  const [mode, setMode] = useState('feed'); 

  const [text, setText] = useState('');
  const [repost, repostState] = useRepostMutation();

  const [dmQuery, setDmQuery] = useState('');
  const [toUser, setToUser] = useState(null);
  const [sendMessage, sendState] = useSendMessageMutation();

  const q = dmQuery.trim();
  const usersQ = useSearchUsersQuery({ q, limit: 10 }, { skip: mode !== 'dm' || q.length === 0 });
  const users = useMemo(() => {
    const d = usersQ.data;
    if (!d) return [];
    if (Array.isArray(d)) return d;
    if (Array.isArray(d.users)) return d.users;
    if (Array.isArray(d.items)) return d.items;
    return [];
  }, [usersQ.data]);

  const reset = () => {
    setText('');
    setDmQuery('');
    setToUser(null);
    setMode('feed');
  };

  const onSubmitFeed = async () => {
    await repost({ postId, text: text.trim(), authorPublicId }).unwrap();
    reset();
    onClose?.();
  };

  const onSubmitDm = async () => {
    if (!toUser?.publicId) return;
    await sendMessage({ toPublicId: toUser.publicId, text: text.trim() || null, sharedPostId: postId }).unwrap();
    reset();
    onClose?.();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        reset();
        onClose?.();
      }}
      title={mode === 'feed' ? 'Репост в ленту' : 'Отправить в сообщения'}
    >
      <div className={styles.wrap}>
        <div className={styles.modes}>
          <button
            className={`${styles.modeBtn} ${mode === 'feed' ? styles.modeActive : ''}`}
            onClick={() => setMode('feed')}
            type="button"
          >
            В ленту
          </button>
          <button
            className={`${styles.modeBtn} ${mode === 'dm' ? styles.modeActive : ''}`}
            onClick={() => setMode('dm')}
            type="button"
          >
            В сообщения
          </button>
        </div>

        {mode === 'dm' ? (
          <div className={styles.dmBlock}>
            <Input
              value={dmQuery}
              onChange={(e) => {
                setDmQuery(e.target.value);
                setToUser(null);
              }}
              placeholder="Кому отправить? (поиск по username)"
            />

            {toUser ? (
              <div className={styles.selected}>
                <div className={styles.selLeft}>
                  <img
                    className={styles.selAva}
                    src={toUser.avatarUrl ? assetUrl(toUser.avatarUrl) : defaultAvatarUrl()}
                    alt=""
                  />
                  <div className={styles.selMeta}>
                    <div className={styles.selName}>{toUser.username}</div>
                    <div className={styles.selSub}>/u/{toUser.publicId}</div>
                  </div>
                </div>
                <Button variant="secondary" onClick={() => setToUser(null)}>
                  Изменить
                </Button>
              </div>
            ) : q.length > 0 ? (
              <div className={styles.results}>
                {usersQ.isLoading ? (
                  <div className={styles.state}><Spinner size={14} /> Загрузка…</div>
                ) : users.length === 0 ? (
                  <div className={styles.state}>Ничего не найдено</div>
                ) : (
                  users.map((u) => (
                    <button
                      key={u.publicId || u.id}
                      className={styles.userPick}
                      type="button"
                      onClick={() => setToUser(u)}
                    >
                      <img
                        className={styles.pickAva}
                        src={u.avatarUrl ? assetUrl(u.avatarUrl) : defaultAvatarUrl()}
                        alt=""
                      />
                      <div className={styles.pickMeta}>
                        <div className={styles.pickName}>{u.username || 'Пользователь'}</div>
                        <div className={styles.pickSub}>/u/{u.publicId}</div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            ) : (
              <div className={styles.state}>Начни вводить username</div>
            )}
          </div>
        ) : null}

        <textarea
          className={styles.textarea}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={mode === 'feed'
            ? 'Добавь комментарий к репосту (необязательно)…'
            : 'Сообщение (необязательно)…'}
        />

        <div className={styles.footer}>
          <Button
            variant="secondary"
            onClick={() => {
              reset();
              onClose?.();
            }}
          >
            Отмена
          </Button>

          {mode === 'feed' ? (
            <Button onClick={onSubmitFeed} disabled={repostState.isLoading || !postId}>
              {repostState.isLoading ? <Spinner size={16} /> : null}
              Репостнуть
            </Button>
          ) : (
            <Button onClick={onSubmitDm} disabled={sendState.isLoading || !postId || !toUser?.publicId}>
              {sendState.isLoading ? <Spinner size={16} /> : null}
              Отправить
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
