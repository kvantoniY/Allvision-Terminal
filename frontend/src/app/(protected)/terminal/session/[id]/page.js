'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import styles from './session.module.css';

import Card from '@/shared/ui/Card/Card';
import Button from '@/shared/ui/Button/Button';
import Input from '@/shared/ui/Input/Input';
import Spinner from '@/shared/ui/Spinner/Spinner';
import Skeleton from '@/shared/ui/Skeleton/Skeleton';
import BetCard from '@/widgets/Terminal/BetCard/BetCard';

import LineChart from '@/shared/ui/Chart/LineChart';
import MultiLineChart from '@/shared/ui/Chart/MultiLineChart';

import { buildSessionSeries } from '@/shared/lib/charts/calc';

import {
  useCloseSessionMutation,
  useDeleteBetMutation,
  useDeleteSessionMutation,
  useGetSessionByIdQuery,
  useSettleBetMutation,
} from '@/shared/lib/api/terminalApi';

import AddBetModal from '@/widgets/Terminal/AddBetModal/AddBetModal';

function fmt(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  return Math.round(Number(n) * 100) / 100;
}

function calcStats(bets = [], initialBank, currentBank) {
  const total = bets.length;
  const wins = bets.filter((b) => b.status === 'WIN').length;
  const losses = bets.filter((b) => b.status === 'LOSE').length;
  const pending = bets.filter((b) => b.status === 'PENDING').length;
  const winrate = total - pending > 0 ? (wins / (total - pending)) * 100 : null;

  const profit = Number(currentBank) - Number(initialBank);
  const stakeSum = bets.reduce((acc, b) => acc + (Number(b.stake) || 0), 0);

  return { total, wins, losses, pending, winrate, profit, stakeSum };
}

function clsByProfit(styles, v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  if (n > 0) return styles.good;
  if (n < 0) return styles.bad;
  return styles.warn;
}

function clsByWinrate(styles, v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  if (n >= 55) return styles.good;
  if (n < 45) return styles.bad;
  return styles.warn;
}

function dateToMs(d) {
  if (!d) return null;
  const t = new Date(d).getTime();
  return Number.isFinite(t) ? t : null;
}

export default function SessionPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params?.id;

  const sessionQ = useGetSessionByIdQuery(sessionId, { skip: !sessionId });
  const [closeSession, { isLoading: closing }] = useCloseSessionMutation();
  const [settleBet, { isLoading: settling }] = useSettleBetMutation();
  const [deleteBet, { isLoading: deleting }] = useDeleteBetMutation();
  const [deleteSession, { isLoading: deletingSession }] = useDeleteSessionMutation();

  const [isAddOpen, setAddOpen] = useState(false);
  const [showCharts, setShowCharts] = useState(false);

  // фильтры ставок
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState('createdAt');
  const [order, setOrder] = useState('desc');

  const session = sessionQ.data?.session || sessionQ.data || null;
  const betsAll = session?.Bets || session?.bets || [];
  const isOpen = session?.status === 'OPEN';
  const statusLabel = isOpen ? 'ОТКРЫТА' : 'ЗАКРЫТА';

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const fromMs = from ? new Date(from + 'T00:00:00').getTime() : null;
    const toMs = to ? new Date(to + 'T23:59:59').getTime() : null;

    let list = betsAll.slice();

    if (status) list = list.filter((b) => b.status === status);

    if (qq) {
      list = list.filter((b) => {
        const hay = [b.tournament, b.team1, b.team2, b.pickTeam, b.game, b.betType]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(qq);
      });
    }

    if (fromMs || toMs) {
      list = list.filter((b) => {
        const t = dateToMs(b.createdAt) ?? dateToMs(b.settledAt) ?? null;
        if (t === null) return true;
        if (fromMs && t < fromMs) return false;
        if (toMs && t > toMs) return false;
        return true;
      });
    }

    const dir = order === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      const av =
        sort === 'createdAt' ? (dateToMs(a.createdAt) ?? 0) :
        sort === 'odds' ? Number(a.odds ?? 0) :
        sort === 'profit' ? Number(a.profit ?? 0) :
        sort === 'stake' ? Number(a.stake ?? 0) :
        0;

      const bv =
        sort === 'createdAt' ? (dateToMs(b.createdAt) ?? 0) :
        sort === 'odds' ? Number(b.odds ?? 0) :
        sort === 'profit' ? Number(b.profit ?? 0) :
        sort === 'stake' ? Number(b.stake ?? 0) :
        0;

      if (av === bv) return 0;
      return av > bv ? dir : -dir;
    });

    return list;
  }, [betsAll, q, status, from, to, sort, order]);

  const stats = useMemo(() => {
    if (!session) return null;
    return calcStats(betsAll, session.initialBank, session.currentBank);
  }, [session, betsAll]);

  const series = useMemo(() => {
    if (!session) return null;
    return buildSessionSeries(session);
  }, [session]);

  if (sessionQ.isLoading) {
    return <div className={styles.state}><Spinner size={18} /> Загрузка…</div>;
  }
  if (sessionQ.error) return <div className={styles.state}>Ошибка загрузки сессии</div>;
  if (!session) return <div className={styles.state}>Сессия не найдена</div>;

  const onDeleteSession = async () => {
    if (!sessionId) return;
    if (!confirm('Удалить сессию и все ставки внутри?')) return;
    try {
      await deleteSession(sessionId).unwrap();
      router.push('/terminal');
    } catch (_) {}
  };

  const onCloseSession = async () => {
    await closeSession(sessionId).unwrap();
  };

const onSettle = async (betId, result) => {
  await settleBet({ betId, result, sessionId }).unwrap();
};

  const onDeleteBet = async (betId) => {
    if (!confirm('Удалить ставку?')) return;
    await deleteBet({ betId }).unwrap();
  };

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.titleBlock}>
          <button className={styles.back} onClick={() => router.push('/terminal')}>← Назад</button>
          <h1 className={styles.h1}>{session.title}</h1>

          <div className={styles.sub}>
            <span className={styles.badge}>{statusLabel}</span>

            <div className={styles.bankPill}>
              <div className={styles.bankLabel}>Старт</div>
              <div className={styles.bankValue}>{fmt(session.initialBank)}</div>
            </div>

            <div className={styles.bankPill}>
              <div className={styles.bankLabel}>Сейчас</div>
              <div className={styles.bankValue}>{fmt(session.currentBank)}</div>
            </div>

            <div className={styles.bankPill}>
              <div className={styles.bankLabel}>P/L</div>
              <div className={`${styles.bankValue} ${clsByProfit(styles, stats?.profit)}`}>{fmt(stats?.profit)}</div>
            </div>
          </div>
        </div>

        <div className={styles.actions}>
          <Button variant="secondary" onClick={() => setShowCharts((v) => !v)}>
            {showCharts ? 'Скрыть графики' : 'Графики'}
          </Button>
          <Button variant="secondary" onClick={() => setAddOpen(true)} disabled={!isOpen}>
            Добавить ставку
          </Button>
          <Button onClick={onCloseSession} disabled={!isOpen || closing}>
            {closing ? <Spinner size={16} /> : null}
            Закрыть сессию
          </Button>
          <Button variant="secondary" className={styles.dangerBtn} onClick={onDeleteSession} disabled={deletingSession}>
            {deletingSession ? <Spinner size={16} /> : null}
            Удалить сессию
          </Button>
        </div>
      </div>

      <div className={styles.kpis}>
        <Card className={styles.kpi}>
          <div className={styles.kpiLabel}>Ставок</div>
          <div className={styles.kpiValue}>{stats?.total ?? '—'}</div>
        </Card>

        <Card className={styles.kpi}>
          <div className={styles.kpiLabel}>W / L / Ожид.</div>
          <div className={styles.kpiValue}>{stats ? `${stats.wins} / ${stats.losses} / ${stats.pending}` : '—'}</div>
        </Card>

        <Card className={styles.kpi}>
          <div className={styles.kpiLabel}>Винрейт</div>
          <div className={`${styles.kpiValue} ${clsByWinrate(styles, stats?.winrate)}`}>
            {stats?.winrate == null ? '—' : `${fmt(stats.winrate)}%`}
          </div>
        </Card>

        <Card className={styles.kpi}>
          <div className={styles.kpiLabel}>Сумма ставок</div>
          <div className={styles.kpiValue}>{fmt(stats?.stakeSum)}</div>
        </Card>
      </div>

      {showCharts && (
        <div className={styles.charts}>
          <Card className={styles.chartCard}>
            <div className={styles.chartHead}>Кривая капитала (по ставкам)</div>
            {!series ? <Skeleton height={190} radius={14} /> : <LineChart points={series.equity} />}
          </Card>

          <Card className={styles.chartCard}>
            <div className={styles.chartHead}>Прибыль (cumulative)</div>
            {!series ? <Skeleton height={190} radius={14} /> : <LineChart points={series.profit} />}
          </Card>

          <Card className={styles.chartCard}>
            <div className={styles.chartHead}>Просадка</div>
            {!series ? <Skeleton height={190} radius={14} /> : <LineChart points={series.drawdownPct} valueSuffix="%" />}
          </Card>

          <Card className={styles.chartCard}>
            <div className={styles.chartHead}>Рекомендовано vs фактически (по ставкам)</div>
            {!series ? (
              <Skeleton height={190} radius={14} />
            ) : (
              <MultiLineChart
                series={[
                  { name: 'Рекомендовано', points: series.stakeRec },
                  { name: 'Фактически', points: series.stakeUser },
                ]}
              />
            )}
          </Card>
        </div>
      )}

      <Card className={styles.tableCard}>
        <div className={styles.tableHeader}>
          <div className={styles.tableTitle}>
            Ставки {sessionQ.isFetching && <span className={styles.inlineSpin}><Spinner size={14} /></span>}
          </div>

          <div className={styles.tableFilters}>
            <Input placeholder="Поиск: команда / турнир" value={q} onChange={(e) => setQ(e.target.value)} />

            <select className={styles.select} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Все статусы</option>
              <option value="PENDING">Ожидание</option>
              <option value="WIN">Победа</option>
              <option value="LOSE">Поражение</option>
            </select>

            <div className={styles.dateRow}>
              <label className={styles.dateField}>
                <span>От</span>
                <input className={styles.dateInput} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </label>
              <label className={styles.dateField}>
                <span>До</span>
                <input className={styles.dateInput} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </label>
            </div>

            <div className={styles.sortRow}>
              <select className={styles.select} value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="createdAt">Дата</option>
                <option value="odds">Кэф</option>
                <option value="stake">Ставка</option>
                <option value="profit">P/L</option>
              </select>
              <select className={styles.select} value={order} onChange={(e) => setOrder(e.target.value)}>
                <option value="desc">↓</option>
                <option value="asc">↑</option>
              </select>
            </div>

            <div className={styles.count}>Найдено: <b>{filtered.length}</b></div>
          </div>
        </div>

        <div className={styles.tableWrap}>
          <div className={styles.betList}>
  {filtered.map((b) => (
    <BetCard
      key={b.id}
      bet={b}
      isOpen={isOpen}
      onSettle={onSettle}
      onDelete={onDeleteBet}
    />
  ))}

  {filtered.length === 0 && (
    <div className={styles.empty}>По текущим фильтрам ставок нет</div>
  )}
</div>
        </div>
      </Card>

      <AddBetModal isOpen={isAddOpen} onClose={() => setAddOpen(false)} sessionId={sessionId} />
    </div>
  );
}