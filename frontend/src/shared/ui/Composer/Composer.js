import clsx from 'clsx';
import { useRef } from 'react';
import styles from './Composer.module.css';
import EmojiPicker from '@/shared/ui/EmojiPicker/EmojiPicker';

function SendIcon({ className }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3.4 20.6 21 12 3.4 3.4l1.6 6.2L14 12 5 10.4 3.4 20.6Z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * Minimal, modern composer: textarea + send icon inside.
 *
 * Props:
 * - value, onChange
 * - placeholder
 * - onSend
 * - disabled
 * - loading
 * - rows (default 1)
 */
export default function Composer({
  className,
  value,
  onChange,
  placeholder,
  onSend,
  disabled,
  loading,
  rows = 1,
  onKeyDown,
}) {
  const canSend = !disabled && !loading && String(value || '').trim().length > 0;
  const textareaRef = useRef(null);

  const insertEmoji = (emoji) => {
    if (!emoji) return;
    const el = textareaRef.current;
    const cur = String(value || '');

    // if caller uses onChange(e) -> setState(e.target.value)
    const apply = (next) => {
      onChange?.({ target: { value: next } });
    };

    if (!el) {
      apply(cur + emoji);
      return;
    }

    const start = Number(el.selectionStart ?? cur.length);
    const end = Number(el.selectionEnd ?? cur.length);
    const next = cur.slice(0, start) + emoji + cur.slice(end);
    apply(next);

    // restore caret after render
    requestAnimationFrame(() => {
      try {
        el.focus();
        const pos = start + emoji.length;
        el.setSelectionRange(pos, pos);
      } catch (_) {}
    });
  };

  return (
    <div className={clsx(styles.wrap, className)}>
      <div className={styles.leftTools}>
        <EmojiPicker disabled={disabled || loading} onSelect={insertEmoji} />
      </div>
      <textarea
        className={styles.input}
        ref={textareaRef}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          // Enter to send, Shift+Enter for newline
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (canSend) onSend?.();
          }
        }}
      />

      <button
        type="button"
        className={clsx(styles.sendBtn, !canSend && styles.sendBtnDisabled)}
        aria-label="Отправить"
        onClick={() => {
          if (canSend) onSend?.();
        }}
        disabled={!canSend}
      >
        <SendIcon className={styles.icon} />
      </button>
    </div>
  );
}
