import styles from './Skeleton.module.css';

export default function Skeleton({ height = 12, width = '100%', radius = 12, className = '' }) {
  return (
    <div
      className={`${styles.skeleton} ${className}`}
      style={{ height, width, borderRadius: radius }}
      aria-hidden="true"
    />
  );
}
