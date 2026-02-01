'use client';

import styles from './BetCard.module.css';

function fmt(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  return Math.round(Number(n) * 100) / 100;
}

function statusLabel(s) {
  if (s === 'WIN') return 'WIN';
  if (s === 'LOSE') return 'LOSS';
  return 'PENDING';
}

export default function BetCard({ bet, isOpen, onSettle, onDelete }) {
  const st = bet.status;
  const profit = Number(bet.profit);

  const border =
    st === 'WIN' ? styles.win :
    st === 'LOSE' ? styles.lose :
    styles.pending;

  const profitCls =
    st === 'WIN' ? styles.profitPlus :
    st === 'LOSE' ? styles.profitMinus :
    styles.profitZero;

  const title = `${bet.team1 || '—'} vs ${bet.team2 || '—'}`;

  const canDelete = typeof onDelete === 'function';
  const canSettle = typeof onSettle === 'function' && isOpen && st === 'PENDING';


  const meta = [
    bet.pickTeam ? `Pick: ${bet.pickTeam}` : null,
    bet.betType === 'MAP_WIN' ? 'Map' : bet.betType === 'HANDICAP' ? 'Handicap' : 'Match',
    bet.bo ? `BO${bet.bo}` : null,
    bet.odds != null ? `Odds: ${fmt(bet.odds)}` : null,
    bet.stake != null ? `Stake: $${fmt(bet.stake)}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <div className={`${styles.card} ${border}`}>
      <div className={styles.left}>
        <div className={styles.title}>{title}</div>
        <div className={styles.meta}>{meta}</div>
      </div>

      <div className={styles.right}>
        <div className={`${styles.badge} ${st === 'WIN' ? styles.badgeWin : st === 'LOSE' ? styles.badgeLose : styles.badgePending}`}>
          {statusLabel(st)}
        </div>

        <div className={`${styles.profit} ${profitCls}`}>
          {st === 'PENDING' ? '—' : `${profit >= 0 ? '+' : ''}$${fmt(profit)}`}
        </div>

        {canSettle || canDelete ? (
          <div className={styles.actions}>
            {canSettle ? (
              <>
                <button className={styles.mini} onClick={() => onSettle(bet.id, 'WIN')}>WIN</button>
                <button className={styles.mini} onClick={() => onSettle(bet.id, 'LOSE')}>LOSE</button>
              </>
            ) : null}

            {canDelete ? (
              <button className={styles.miniDanger} onClick={() => onDelete(bet.id)}>Удалить</button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}