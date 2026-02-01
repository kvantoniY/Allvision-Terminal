'use client';

import { useRef, useState } from 'react';
import Modal from '@/shared/ui/Modal/Modal';
import Button from '@/shared/ui/Button/Button';
import Spinner from '@/shared/ui/Spinner/Spinner';
import EmojiPicker from '@/shared/ui/EmojiPicker/EmojiPicker';
import styles from './CreatePostModal.module.css';
import { assetUrl } from '@/shared/lib/assetUrl';

import { useCreatePostMutation } from '@/shared/lib/api/socialApi';
import { useUploadImageMutation } from '@/shared/lib/api/uploadsApi';

export default function CreatePostModal({ isOpen, onClose }) {
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);

  const textareaRef = useRef(null);

  const insertEmoji = (emoji) => {
    if (!emoji) return;
    const el = textareaRef.current;
    const cur = String(text || '');
    if (!el) {
      setText(cur + emoji);
      return;
    }
    const start = Number(el.selectionStart ?? cur.length);
    const end = Number(el.selectionEnd ?? cur.length);
    const next = cur.slice(0, start) + emoji + cur.slice(end);
    setText(next);
    requestAnimationFrame(() => {
      try {
        el.focus();
        const pos = start + emoji.length;
        el.setSelectionRange(pos, pos);
      } catch (_) {}
    });
  };
  const [uploadImage, uploadState] = useUploadImageMutation();
  const [createPost, createState] = useCreatePostMutation();

  const onSubmit = async () => {
    const clean = text.trim();
if (!clean && !file) return;
    let imageUrl = null;

    if (file) {
      const fd = new FormData();
      fd.append('file', file);
      const up = await uploadImage(fd).unwrap();
      const u = up?.url || null;
    imageUrl = u ? assetUrl(u) : null;

    }

    await createPost({ text: text.trim(), imageUrl }).unwrap();
    setText('');
    setFile(null);
    onClose?.();
  };


  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Новый пост">
      <div className={styles.wrap}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
          <EmojiPicker onSelect={insertEmoji} disabled={createState.isLoading || uploadState.isLoading} />
        </div>
        <textarea
          className={styles.textarea}
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Напиши что-нибудь…"
        />

        <div className={styles.row}>
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          {file ? <div className={styles.file}>Файл: <b>{file.name}</b></div> : <div className={styles.fileMuted}>Картинка необязательна</div>}
        </div>

        <div className={styles.footer}>
          <Button variant="secondary" onClick={onClose}>Отмена</Button>
          <Button onClick={onSubmit} disabled={createState.isLoading || uploadState.isLoading}>
            {(createState.isLoading || uploadState.isLoading) ? <Spinner size={16} /> : null}
            Опубликовать
          </Button>
        </div>
      </div>
    </Modal>
  );
}
