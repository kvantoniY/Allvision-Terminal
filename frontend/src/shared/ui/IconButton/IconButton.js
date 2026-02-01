import clsx from 'clsx';
import styles from './IconButton.module.css';

export default function IconButton({ className, ...props }) {
  return <button className={clsx(styles.btn, className)} {...props} />;
}
