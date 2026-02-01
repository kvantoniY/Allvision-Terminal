'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import styles from './terminal.module.css';

import Card from '@/shared/ui/Card/Card';
import Button from '@/shared/ui/Button/Button';
import Input from '@/shared/ui/Input/Input';
import Spinner from '@/shared/ui/Spinner/Spinner';
import Skeleton from '@/shared/ui/Skeleton/Skeleton';

import LineChart from '@/shared/ui/Chart/LineChart';
import MultiLineChart from '@/shared/ui/Chart/MultiLineChart';

import { buildTotalSeries } from '@/shared/lib/charts/calc';

import {
  useCreateSessionMutation,
  useGetSessionsQuery,
  useGetSummaryQuery,
  useGetBetsQuery,
  useDeleteSessionMutation,
} from '@/shared/lib/api/terminalApi';

function fmt(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  return Math.round(Number(n) * 100) / 100;
}

function pct(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  // API иногда отдаёт winrate/roi как долю (0.53), иногда как процент (53).
  // Нормализуем: если значение похоже на долю, переводим в проценты.
  const v0 = Number(n);
  const v = Math.abs(v0) <= 1.0001 ? v0 * 100 : v0;
  return `${Math.round(v * 100) / 100}%`;
}

function kpiClassByValue(type, value) {
  const v = Number(value);
  if (!Number.isFinite(v)) return '';

  if (type === 'profit' || type === 'roi') {
    if (v > 0) return styles.valueGood;
    if (v < 0) return styles.valueBad;
    return styles.valueWarn;
  }

  if (type === 'winrate') {
    if (v >= 55) return styles.valueGood;
    if (v < 45) return styles.valueBad;
    return styles.valueWarn;
  }

  return '';
}

function betLabel(b) {
  if (!b) return '—';
  const teams = [b.team1, b.team2].filter(Boolean).join(' vs ');
  const odds = b.odds != null ? `кэф ${Math.round(Number(b.odds) * 100) / 100}` : '';
  return [teams || 'Ставка', odds].filter(Boolean).join(' • ');
}

export default function TerminalPage() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('createdAt');
  const [order, setOrder] = useState('desc');
  const [showCharts, setShowCharts] = useState(false);

  const sessionsParams = useMemo(() => {
    const p = { limit: 50, offset: 0, sort, order };
    if (q) p.q = q;
    if (status) p.status = status;
    return p;
  }, [q, status, sort, order]);

  const sessionsQ = useGetSessionsQuery(sessionsParams);
  const summaryQ = useGetSummaryQuery({});
  const betsQ = useGetBetsQuery({ limit: 5000, offset: 0 });

  const [createSession, { isLoading: creating }] = useCreateSessionMutation();
  const [deleteSession, { isLoading: deletingSession }] = useDeleteSessionMutation();
  const [title, setTitle] = useState('');
  const [initialBank, setInitialBank] = useState('');

  const onCreate = async (e) => {
    e.preventDefault();
    const bank = Number(initialBank);
    if (!title.trim()) return;
    if (!Number.isFinite(bank) || bank <= 0) return;

    await createSession({ title: title.trim(), initialBank: bank }).unwrap();
    setTitle('');
    setInitialBank('');
  };

  const sessions = sessionsQ.data?.items || [];
  const allBets = betsQ.data?.items || [];

  const bankTotals = useMemo(() => {
    const initialSum = sessions.reduce((acc, s) => acc + (Number(s.initialBank) || 0), 0);
    const currentSum = sessions.reduce((acc, s) => acc + (Number(s.currentBank) || 0), 0);
    const delta = currentSum - initialSum;
    return { initialSum, currentSum, delta };
  }, [sessions]);

  const computed = useMemo(() => buildTotalSeries({ sessions, bets: allBets }), [sessions, allBets]);

  const bestTeamObj = summaryQ.data?.highlights?.bestTeam;
  const bestTeamLabel =
    !bestTeamObj ? '—' : typeof bestTeamObj === 'string' ? bestTeamObj : (bestTeamObj.team || '—');

  const bestOddsBet = summaryQ.data?.highlights?.bestOddsBet;
  const biggestWin = summaryQ.data?.highlights?.biggestWinBet;
  const biggestLoss = summaryQ.data?.highlights?.biggestLossBet;

  const winrate = summaryQ.data?.totals?.winrate;
  const roi = summaryQ.data?.totals?.roi;
  const profitSum = summaryQ.data?.totals?.profitSum;

  const loadingTop = summaryQ.isLoading || sessionsQ.isLoading;

  return (
    <div className={styles.root}>
      <div className={styles.top}>
        <div className={styles.topLeft}>
          <h1 className={styles.h1}>Терминал</h1>

          <div className={styles.summaryRow}>
            <Card className={styles.kpiWide}>
              <div className={styles.kpiLabel}>Банк (суммарно по сессиям)</div>
              <div className={styles.bankLine}>
                <div className={styles.bankNow}>
                  {sessionsQ.isLoading ? <Skeleton height={18} width={120} /> : fmt(bankTotals.currentSum)}
                </div>
                <div className={`${styles.bankDelta} ${kpiClassByValue('profit', bankTotals.delta)}`}>
                  {sessionsQ.isLoading ? null : `Δ ${fmt(bankTotals.delta)}`}
                </div>
              </div>
              <div className={styles.kpiSub}>
                {sessionsQ.isLoading ? <Skeleton height={12} width={160} /> : `Старт: ${fmt(bankTotals.initialSum)}`}
              </div>
            </Card>

            <Card className={styles.kpi}>
              <div className={styles.kpiLabel}>Ставок</div>
              <div className={styles.kpiValue}>
                {loadingTop ? <Skeleton height={18} width={70} /> : (summaryQ.data?.totals?.betsTotal ?? '—')}
              </div>
            </Card>

            <Card className={styles.kpi}>
              <div className={styles.kpiLabel}>Винрейт</div>
              <div className={`${styles.kpiValue} ${kpiClassByValue('winrate', winrate)}`}>
                {loadingTop ? <Skeleton height={18} width={90} /> : pct(winrate)}
              </div>
            </Card>

            <Card className={styles.kpi}>
              <div className={styles.kpiLabel}>Прибыль</div>
              <div className={`${styles.kpiValue} ${kpiClassByValue('profit', profitSum)}`}>
                {loadingTop ? <Skeleton height={18} width={90} /> : fmt(profitSum)}
              </div>
            </Card>

            <Card className={styles.kpi}>
              <div className={styles.kpiLabel}>ROI</div>
              <div className={`${styles.kpiValue} ${kpiClassByValue('roi', roi)}`}>
                {loadingTop ? <Skeleton height={18} width={90} /> : pct(roi)}
              </div>
            </Card>
          </div>

          <div className={styles.highlights}>
            <Card className={styles.hl}>
              <div className={styles.hlTitle}>Лучшие метрики</div>

              <div className={styles.bestGrid}>
                <div className={styles.bestItem}>
                  <div className={styles.bestLabel}>Лучшая команда</div>
                  <div className={styles.bestValue}>
                    {loadingTop ? <Skeleton height={18} width={160} /> : bestTeamLabel}
                  </div>
                  {!loadingTop && bestTeamObj && typeof bestTeamObj === 'object' && (
                    <div className={styles.bestSub}>
                      {bestTeamObj.n ?? '—'} ставок • прибыль {bestTeamObj.profitSum ?? '—'}
                    </div>
                  )}
                </div>

                <div className={styles.bestItem}>
                  <div className={styles.bestLabel}>Лучший кэф</div>
                  <div className={styles.bestValue}>
                    {loadingTop ? <Skeleton height={18} width={80} /> : (bestOddsBet?.odds != null ? fmt(bestOddsBet.odds) : '—')}
                  </div>
                  <div className={styles.bestSub}>{loadingTop ? <Skeleton height={12} /> : betLabel(bestOddsBet)}</div>
                </div>

                <div className={styles.bestItem}>
                  <div className={styles.bestLabel}>Максимальный выигрыш</div>
                  <div className={`${styles.bestValue} ${styles.valueGood}`}>
                    {loadingTop ? <Skeleton height={18} width={90} /> : (biggestWin?.profit ?? '—')}
                  </div>
                  <div className={styles.bestSub}>{loadingTop ? <Skeleton height={12} /> : betLabel(biggestWin)}</div>
                </div>

                <div className={styles.bestItem}>
                  <div className={styles.bestLabel}>Максимальный проигрыш</div>
                  <div className={`${styles.bestValue} ${styles.valueBad}`}>
                    {loadingTop ? <Skeleton height={18} width={90} /> : (biggestLoss?.profit ?? '—')}
                  </div>
                  <div className={styles.bestSub}>{loadingTop ? <Skeleton height={12} /> : betLabel(biggestLoss)}</div>
                </div>
              </div>
            </Card>
          </div>
        </div>

        <div className={styles.topRight}>
          <Button variant="secondary" onClick={() => setShowCharts((v) => !v)}>
            {showCharts ? 'Скрыть графики' : 'Графики'}
          </Button>
        </div>
      </div>

      {showCharts && (
        <div className={styles.charts}>
          <Card className={styles.chartCard}>
            <div className={styles.chartHead}>
              <div className={styles.chartTitle}>Общая кривая капитала (по ставкам)</div>
              {betsQ.isFetching && <Spinner size={16} />}
            </div>
            {betsQ.isLoading ? <Skeleton height={190} radius={14} /> : <LineChart points={computed.equity} />}
          </Card>

          <Card className={styles.chartCard}>
            <div className={styles.chartHead}>
              <div className={styles.chartTitle}>Общая прибыль (cumulative)</div>
              {betsQ.isFetching && <Spinner size={16} />}
            </div>
            {betsQ.isLoading ? <Skeleton height={190} radius={14} /> : <LineChart points={computed.profit} />}
          </Card>

          <Card className={styles.chartCard}>
            <div className={styles.chartHead}>
              <div className={styles.chartTitle}>Общая просадка</div>
              {betsQ.isFetching && <Spinner size={16} />}
            </div>
            {betsQ.isLoading ? <Skeleton height={190} radius={14} /> : <LineChart points={computed.drawdownPct} valueSuffix="%" />}
          </Card>

          <Card className={styles.chartCard}>
            <div className={styles.chartHead}>
              <div className={styles.chartTitle}>Ставка: рекомендовано vs фактически</div>
              {betsQ.isFetching && <Spinner size={16} />}
            </div>
            {betsQ.isLoading ? (
              <Skeleton height={190} radius={14} />
            ) : (
              <MultiLineChart
                series={[
                  { name: 'Рекомендовано', points: computed.stakeRec },
                  { name: 'Фактически', points: computed.stakeUser },
                ]}
              />
            )}
          </Card>
        </div>
      )}

      <div className={styles.main}>
        <Card className={styles.sessions}>
          <div className={styles.sectionTitle}>
            Сессии {sessionsQ.isFetching && <span className={styles.inlineSpin}><Spinner size={14} /></span>}
          </div>

          <div className={styles.filters}>
            <Input placeholder="Поиск по названию" value={q} onChange={(e) => setQ(e.target.value)} />

            <select className={styles.select} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Все</option>
              <option value="OPEN">Открытые</option>
              <option value="CLOSED">Закрытые</option>
            </select>

            <select className={styles.select} value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="createdAt">Дата</option>
              <option value="currentBank">Текущий банк</option>
              <option value="profit">Прибыль</option>
            </select>

            <select className={styles.select} value={order} onChange={(e) => setOrder(e.target.value)}>
              <option value="desc">↓</option>
              <option value="asc">↑</option>
            </select>
          </div>

          {sessionsQ.isLoading && (
            <div className={styles.list}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className={styles.item}>
                  <Skeleton height={14} width={120} />
                  <div style={{ marginTop: 10 }}>
                    <Skeleton height={12} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {sessionsQ.error && <div className={styles.state}>Ошибка загрузки сессий</div>}

          {!sessionsQ.isLoading && (
            <div className={styles.list}>
              {sessions.map((s) => {
                const p = Number(s.currentBank) - Number(s.initialBank);
                const profitSign = p > 0 ? styles.profitPlus : p < 0 ? styles.profitMinus : styles.profitZero;
                const statusLabel = s.status === 'OPEN' ? 'ОТКРЫТА' : 'ЗАКРЫТА';

                return (
                  <div key={s.id} className={styles.item}>
                    <Link href={`/terminal/session/${s.id}`} className={styles.itemLink}>
                      <div className={styles.itemTop}>
                        <div className={styles.itemTitle}>{s.title}</div>
                        <span className={styles.badge}>{statusLabel}</span>
                      </div>

                      <div className={styles.itemBanks}>
                        <div className={styles.bankBlock}>
                          <div className={styles.bankLabel}>Старт</div>
                          <div className={styles.bankNum}>{fmt(s.initialBank)}</div>
                        </div>
                        <div className={styles.bankBlock}>
                          <div className={styles.bankLabel}>Сейчас</div>
                          <div className={styles.bankNum}>{fmt(s.currentBank)}</div>
                        </div>
                        <div className={styles.bankBlock}>
                          <div className={styles.bankLabel}>P/L</div>
                          <div className={`${styles.bankNum} ${profitSign}`}>{fmt(p)}</div>
                        </div>
                      </div>
                    </Link>

                    <button
                      type="button"
                      className={styles.itemDel}
                      title="Удалить сессию"
                      disabled={deletingSession}
                      onClick={async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!confirm('Удалить сессию и все ставки внутри?')) return;
                        try {
                          await deleteSession(s.id).unwrap();
                        } catch (_) {}
                      }}
                    >
                      🗑
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className={styles.create}>
          <div className={styles.sectionTitle}>Создать сессию</div>
          <form onSubmit={onCreate} className={styles.form}>
            <Input placeholder="Название" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Input placeholder="Начальный банк" value={initialBank} onChange={(e) => setInitialBank(e.target.value)} />
            <Button type="submit" disabled={creating}>
              {creating ? <Spinner size={16} /> : null}
              Создать
            </Button>
          </form>

          <div className={styles.hint}>
            Удаление сессии удаляет и все ставки внутри.
          </div>
        </Card>
      </div>
    </div>
  );
}
