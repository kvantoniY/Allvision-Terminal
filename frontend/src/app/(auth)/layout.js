import styles from './layout.module.css';

export default function AuthLayout({ children }) {
  return <div className={styles.root}>{children}</div>;
}
