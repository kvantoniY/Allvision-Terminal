'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './Modal.module.css';

function getScrollbarWidth() {
  if (typeof window === 'undefined') return 0;
  return window.innerWidth - document.documentElement.clientWidth;
}

export default function Modal({ isOpen, title, children, onClose }) {
  const [mounted, setMounted] = useState(false);
  const [enter, setEnter] = useState(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!isOpen) {
      setEnter(false);
      const t = setTimeout(() => setMounted(false), 160);
      return () => clearTimeout(t);
    }

    setMounted(true);

    const raf = requestAnimationFrame(() => setEnter(true));

    const sbw = getScrollbarWidth();
    const prevOverflow = document.body.style.overflow;
    const prevPad = document.body.style.paddingRight;

    document.body.style.overflow = 'hidden';
    if (sbw > 0) document.body.style.paddingRight = `${sbw}px`;

    const onKey = (e) => {
      if (e.key === 'Escape') closeRef.current?.();
    };
    document.addEventListener('keydown', onKey);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPad;
    };
  }, [isOpen]);

  if (!mounted) return null;

  return createPortal(
    <div
      className={`${styles.backdrop} ${enter ? styles.backdropEnter : ''}`}
      onMouseDown={() => closeRef.current?.()}
    >
      <div
        className={`${styles.modal} ${enter ? styles.modalEnter : ''}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <div className={styles.title}>{title}</div>
          <button className={styles.close} onClick={() => closeRef.current?.()} aria-label="Закрыть">×</button>
        </div>
        <div className={styles.body}>{children}</div>
      </div>
    </div>,
    document.body
  );
}
