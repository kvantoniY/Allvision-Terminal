'use client';

import { useState } from 'react';
import Modal from '@/shared/ui/Modal/Modal';
import Button from '@/shared/ui/Button/Button';
import Spinner from '@/shared/ui/Spinner/Spinner';
import Composer from '@/shared/ui/Composer/Composer';
import styles from './SendMessageModal.module.css';

export default function SendMessageModal({ isOpen, onClose, onSend, loading }) {
  const [text, setText] = useState('');

  const submit = async () => {
    const v = text.trim();
    if (!v) return;
    await onSend(v);
    setText('');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Новое сообщение">
      <div className={styles.wrap}>
        <div className={styles.topHint}>Напиши первое сообщение — диалог создастся автоматически.</div>
        <div className={styles.composerRow}>
          <Composer
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Напиши первое сообщение…"
            onSend={submit}
            disabled={loading}
            rows={2}
          />
        </div>

        <div className={styles.footer}>
          <Button variant="secondary" onClick={onClose}>Закрыть</Button>
          {loading ? <span className={styles.loading}><Spinner size={14} /> Отправка…</span> : null}
        </div>
      </div>
    </Modal>
  );
}
