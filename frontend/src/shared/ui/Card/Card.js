import clsx from 'clsx';
import styles from './Card.module.css';

export default function Card({ className, children }) {
  return <div className={clsx(styles.card, className)}>{children}</div>;
}
