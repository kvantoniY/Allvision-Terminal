import clsx from 'clsx';
import styles from './Input.module.css';

export default function Input({ className, ...props }) {
  return <input className={clsx(styles.input, className)} {...props} />;
}
