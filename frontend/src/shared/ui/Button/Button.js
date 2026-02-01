import clsx from 'clsx';
import styles from './Button.module.css';

export default function Button({ className, variant = 'primary', ...props }) {
  return <button className={clsx(styles.btn, styles[variant], className)} {...props} />;
}
