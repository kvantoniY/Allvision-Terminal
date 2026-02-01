import styles from './Spinner.module.css';

export default function Spinner({ size = 18, className = '' }) {
  return (
    <span
      className={`${styles.spinner} ${className}`}
      style={{ width: size, height: size }}
      aria-label="Загрузка"
    />
  );
}
