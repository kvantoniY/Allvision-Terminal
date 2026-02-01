'use client';

import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import styles from './Dropdown.module.css';

export default function Dropdown({
  trigger,
  children,
  align = 'right',
  menuClassName,
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };

    const onMouseDown = (e) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target)) setOpen(false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onMouseDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onMouseDown);
    };
  }, [open]);

  const toggle = () => {
    if (disabled) return;
    setOpen((v) => !v);
  };

  return (
    <div ref={rootRef} className={styles.root}>
      <button
        type="button"
        className={styles.trigger}
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
      >
        {trigger}
      </button>

      {open ? (
        <div
          role="menu"
          className={clsx(styles.menu, styles[align], menuClassName)}
        >
          {typeof children === 'function' ? children({ close: () => setOpen(false) }) : children}
        </div>
      ) : null}
    </div>
  );
}
