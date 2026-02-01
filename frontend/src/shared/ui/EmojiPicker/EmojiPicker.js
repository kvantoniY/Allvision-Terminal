'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './EmojiPicker.module.css';

const DEFAULT_EMOJIS = [
  '😀','😁','😂','🤣','😊','😍','😉','😎','🤝','🙏',
  '👍','👎','🔥','💯','✨','❤️','🖤','💙','💚','💛',
  '😢','😭','😡','🤯','😴','🙃','🤔','😅','😇','🥳',
  '⚽','🎮','🎯','🏆','💸','📈','📉','✅','❌','⭐',
];

export default function EmojiPicker({
  onSelect,
  disabled,
  className,
  buttonTitle = 'Эмоджи',
  emojis,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const list = useMemo(() => (Array.isArray(emojis) && emojis.length ? emojis : DEFAULT_EMOJIS), [emojis]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (!rootRef.current) return;
      if (rootRef.current.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('touchstart', onDoc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('touchstart', onDoc);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`${styles.root} ${className || ''}`}>
      <button
        type="button"
        className={styles.btn}
        aria-label={buttonTitle}
        title={buttonTitle}
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((v) => !v);
        }}
      >
        🙂
      </button>

      {open ? (
        <div className={styles.pop} role="dialog" aria-label="emoji picker">
          {list.map((e) => (
            <button
              key={e}
              type="button"
              className={styles.emoji}
              onClick={() => {
                onSelect?.(e);
                setOpen(false);
              }}
            >
              {e}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
