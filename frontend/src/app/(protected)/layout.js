'use client';

import Header from '@/widgets/Header/Header';
import Sidebar from '@/widgets/Sidebar/Sidebar';
import BottomNav from '@/widgets/BottomNav/BottomNav';
import styles from './layout.module.css';

import useRealtime from '@/shared/lib/realtime/useRealtime';

function RealtimeGate() {
  useRealtime();
  return null;
}

export default function ProtectedLayout({ children }) {
  return (
    <div className={styles.root}>
      <RealtimeGate />

      <Header />
      <div className={styles.body}>
        <aside className={styles.sidebar}>
          <Sidebar />
        </aside>

        <main className={styles.content}>{children}</main>
      </div>

      <nav className={styles.bottomNav}>
        <BottomNav />
      </nav>
    </div>
  );
}
