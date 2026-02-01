function toMs(d) {
  if (!d) return null;
  const t = new Date(d).getTime();
  return Number.isFinite(t) ? t : null;
}

function betSortKey(b) {
  return toMs(b.createdAt) ?? toMs(b.settledAt) ?? 0;
}

function isSettled(b) {
  return b.status === 'WIN' || b.status === 'LOSE';
}

function num(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

export function buildSessionSeries(session) {
  const start = num(session?.initialBank) ?? 0;
  const bets = (session?.Bets || session?.bets || []).slice().sort((a, b) => betSortKey(a) - betSortKey(b));

  let bank = start;
  let cumProfit = 0;

  const equity = [];
  const profit = [];
  const stakeUser = [];
  const stakeRec = [];

  for (let i = 0; i < bets.length; i++) {
    const b = bets[i];

    const p = num(b.profit) ?? 0;
    if (isSettled(b)) {
      bank += p;
      cumProfit += p;
    }

    equity.push({ x: i, y: bank, label: b.tournament || `${b.team1 || ''} vs ${b.team2 || ''}`.trim() });
    profit.push({ x: i, y: cumProfit });

    const st = num(b.stake);
    const rec = num(b.recommendedStake);

    stakeUser.push({ x: i, y: st, label: b.tournament || '' });
    stakeRec.push({ x: i, y: rec, label: b.tournament || '' });
  }


  let peak = equity.length ? equity[0].y : start;
  const drawdownPct = equity.map((p) => {
    if (p.y > peak) peak = p.y;
    const dd = peak > 0 ? ((peak - p.y) / peak) * 100 : 0;
    return { x: p.x, y: dd, label: p.label };
  });

  return {
    equity,
    profit,
    drawdownPct,
    stakeUser,
    stakeRec,
    bankStart: start,
    betsCount: bets.length,
  };
}

export function buildTotalSeries({ sessions = [], bets = [] }) {
  const start = sessions.reduce((acc, s) => acc + (num(s.initialBank) ?? 0), 0);
  const list = (bets || []).slice().sort((a, b) => betSortKey(a) - betSortKey(b));

  let bank = start;
  let cumProfit = 0;

  const equity = [];
  const profit = [];
  const stakeUser = [];
  const stakeRec = [];

  for (let i = 0; i < list.length; i++) {
    const b = list[i];

    const p = num(b.profit) ?? 0;
    if (isSettled(b)) {
      bank += p;
      cumProfit += p;
    }

    equity.push({ x: i, y: bank });
    profit.push({ x: i, y: cumProfit });

    stakeUser.push({ x: i, y: num(b.stake) });
    stakeRec.push({ x: i, y: num(b.recommendedStake) });
  }

  let peak = equity.length ? equity[0].y : start;
  const drawdownPct = equity.map((p) => {
    if (p.y > peak) peak = p.y;
    const dd = peak > 0 ? ((peak - p.y) / peak) * 100 : 0;
    return { x: p.x, y: dd };
  });

  return { equity, profit, drawdownPct, stakeUser, stakeRec, bankStart: start };
}
