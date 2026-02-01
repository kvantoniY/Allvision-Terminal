import { db } from '../../db/index.js';

function isUuid(v) {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function parseRangeDays(range) {
  const r = String(range || 'all');
  if (r === '7d') return 7;
  if (r === '30d') return 30;
  if (r === '90d') return 90;
  return null;
}

function parseDateOnly(s) {
  // YYYY-MM-DD -> Date at 00:00:00 local
  const str = String(s || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  const d = new Date(str + 'T00:00:00');
  return Number.isNaN(d.getTime()) ? null : d;
}

function getTimeFilter(req) {
  const fromQ = parseDateOnly(req.query.from);
  const toQ = parseDateOnly(req.query.to);

  if (fromQ || toQ) {
    const from = fromQ || new Date('1970-01-01T00:00:00');
    const to = toQ || new Date('2999-12-31T00:00:00');
    return { from, to };
  }

  const days = parseRangeDays(req.query.range);
  if (!days) return null;

  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const to = new Date('2999-12-31T00:00:00');
  return { from, to };
}

function bucketKey(d, bucket) {
  const dt = new Date(d);
  if (bucket === 'bet') return dt.toISOString();

  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dt.getUTCDate()).padStart(2, '0');

  if (bucket === 'day') return `${y}-${m}-${day}`;

  if (bucket === 'month') return `${y}-${m}`;

  // week: ISO-like week key (approx; sufficient for chart buckets)
  const tmp = new Date(Date.UTC(y, dt.getUTCMonth(), dt.getUTCDate()));
  const dayNum = (tmp.getUTCDay() + 6) % 7; // Mon=0
  tmp.setUTCDate(tmp.getUTCDate() - dayNum + 3); // Thu
  const firstThu = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThu.getUTCDay() + 6) % 7;
  firstThu.setUTCDate(firstThu.getUTCDate() - firstDayNum + 3);
  const week = 1 + Math.round((tmp - firstThu) / (7 * 24 * 60 * 60 * 1000));
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

async function loadMySettledBets(req, { sessionId }) {
  if (sessionId && !isUuid(sessionId)) {
    const err = new Error('Invalid sessionId');
    err.status = 400;
    throw err;
  }

  const timeFilter = getTimeFilter(req);

  const whereBet = {
    status: { [db.Sequelize.Op.in]: ['WIN', 'LOSE'] }
  };
  if (sessionId) whereBet.sessionId = sessionId;

  // фильтр времени применяем по settledAt если есть, иначе по createdAt
  if (timeFilter) {
    whereBet[db.Sequelize.Op.or] = [
      { settledAt: { [db.Sequelize.Op.between]: [timeFilter.from, timeFilter.to] } },
      {
        settledAt: null,
        createdAt: { [db.Sequelize.Op.between]: [timeFilter.from, timeFilter.to] }
      }
    ];
  }

  const bets = await db.models.Bet.findAll({
    where: whereBet,
    include: [{
      model: db.models.BankSession,
      as: 'Session',
      attributes: ['id', 'initialBank', 'userId'],
      where: { userId: req.user.id }
    }],
    attributes: [
      'id', 'sessionId', 'status',
      'stake', 'recommendedStake', 'profit',
      'createdAt', 'settledAt'
    ],
    order: [['settledAt', 'ASC'], ['createdAt', 'ASC']]
  });

  return bets;
}

async function loadMySessions(req, { sessionId }) {
  const where = { userId: req.user.id };
  if (sessionId) where.id = sessionId;

  const sessions = await db.models.BankSession.findAll({
    where,
    attributes: ['id', 'initialBank', 'createdAt']
  });
  return sessions;
}

/**
 * 1) Equity: points of bank over time.
 * mode:
 *  - total (default): start = sum(initialBank of included sessions), bank += profit
 *  - session: start = initialBank of session only (requires sessionId)
 */
export async function equityChart(req, res, next) {
  try {
    const sessionId = req.query.sessionId ? String(req.query.sessionId) : null;
    const mode = String(req.query.mode || (sessionId ? 'session' : 'total'));
    const bucket = String(req.query.bucket || 'day');

    const sessions = await loadMySessions(req, { sessionId });
    if (sessionId && sessions.length === 0) return res.status(404).json({ message: 'Session not found' });

    const bets = await loadMySettledBets(req, { sessionId });

    let bankStart = 0;
    if (mode === 'session') {
      if (!sessionId) return res.status(400).json({ message: 'mode=session requires sessionId' });
      bankStart = Number(sessions[0].initialBank || 0);
    } else {
      // total
      bankStart = sessions.reduce((acc, s) => acc + Number(s.initialBank || 0), 0);
    }

    let bank = bankStart;

    // bucket aggregation: last point per bucket
    const map = new Map();
    for (const b of bets) {
      const t = b.settledAt || b.createdAt;
      bank += Number(b.profit || 0);

      const key = bucketKey(t, bucket);
      map.set(key, { t: key, bank: Number(bank.toFixed(6)) });
    }

    const points = Array.from(map.values());
    res.json({
      chart: 'equity',
      mode,
      bucket,
      sessionId,
      bankStart: Number(bankStart.toFixed(6)),
      points
    });
  } catch (e) { next(e); }
}

/**
 * 2) Profit/Loss:
 * mode:
 *  - cumulative (default): cumulativeProfit over time
 *  - period: profit per bucket (net)
 */
export async function profitChart(req, res, next) {
  try {
    const sessionId = req.query.sessionId ? String(req.query.sessionId) : null;
    const mode = String(req.query.mode || 'cumulative'); // cumulative | period
    const bucket = String(req.query.bucket || 'day');

    const bets = await loadMySettledBets(req, { sessionId });

    const map = new Map();
    let cum = 0;

    for (const b of bets) {
      const t = b.settledAt || b.createdAt;
      const key = bucketKey(t, bucket);
      const p = Number(b.profit || 0);

      if (mode === 'period') {
        const prev = map.get(key) || { t: key, profit: 0 };
        prev.profit = Number((prev.profit + p).toFixed(6));
        map.set(key, prev);
      } else {
        cum += p;
        map.set(key, { t: key, profit: Number(cum.toFixed(6)) });
      }
    }

    res.json({
      chart: 'profit',
      mode,
      bucket,
      sessionId,
      points: Array.from(map.values())
    });
  } catch (e) { next(e); }
}

/**
 * 3) Stake deviation vs recommendation:
 * mode:
 *  - bet (default): one point per bet (t=bet time)
 *  - avg: average deviation per bucket
 */
export async function stakeDeviationChart(req, res, next) {
  try {
    const sessionId = req.query.sessionId ? String(req.query.sessionId) : null;
    const mode = String(req.query.mode || 'avg'); // bet | avg
    const bucket = String(req.query.bucket || 'day');

    const bets = await loadMySettledBets(req, { sessionId });

    if (mode === 'bet') {
      const points = bets.map((b) => {
        const t = (b.settledAt || b.createdAt).toISOString();
        const stake = Number(b.stake || 0);
        const rec = Number(b.recommendedStake || 0);
        const devAbs = stake - rec;
        const devPct = rec > 0 ? devAbs / rec : 0;

        return {
          t,
          stake: Number(stake.toFixed(6)),
          recommended: Number(rec.toFixed(6)),
          deviationAbs: Number(devAbs.toFixed(6)),
          deviationPct: Number(devPct.toFixed(6))
        };
      });

      return res.json({ chart: 'stakeDeviation', mode, bucket: 'bet', sessionId, points });
    }

    // avg per bucket
    const map = new Map();
    for (const b of bets) {
      const t = b.settledAt || b.createdAt;
      const key = bucketKey(t, bucket);

      const stake = Number(b.stake || 0);
      const rec = Number(b.recommendedStake || 0);
      const devAbs = stake - rec;
      const devPct = rec > 0 ? devAbs / rec : 0;

      const agg = map.get(key) || { t: key, n: 0, devPctSum: 0, devAbsSum: 0 };
      agg.n += 1;
      agg.devPctSum += devPct;
      agg.devAbsSum += devAbs;
      map.set(key, agg);
    }

    const points = Array.from(map.values()).map((x) => ({
      t: x.t,
      avgDeviationPct: Number((x.n ? x.devPctSum / x.n : 0).toFixed(6)),
      avgDeviationAbs: Number((x.n ? x.devAbsSum / x.n : 0).toFixed(6)),
      n: x.n
    }));

    res.json({ chart: 'stakeDeviation', mode, bucket, sessionId, points });
  } catch (e) { next(e); }
}

/**
 * 4) Winrate chart:
 * mode:
 *  - period (default): winrate per bucket (wins/(wins+losses) in that bucket)
 *  - cumulative: cumulative winrate over time
 *  - rolling: rolling winrate over last N settled bets (window param)
 */
export async function winrateChart(req, res, next) {
  try {
    const sessionId = req.query.sessionId ? String(req.query.sessionId) : null;
    const mode = String(req.query.mode || 'period'); // period | cumulative | rolling
    const bucket = String(req.query.bucket || 'day');
    const window = Math.max(2, Math.min(200, Number(req.query.window || 20)));

    const bets = await loadMySettledBets(req, { sessionId });

    if (mode === 'rolling') {
      const points = [];
      const buf = []; // store 1 for win, 0 for lose

      for (const b of bets) {
        const t = b.settledAt || b.createdAt;
        buf.push(b.status === 'WIN' ? 1 : 0);
        if (buf.length > window) buf.shift();

        const wr = buf.reduce((a, v) => a + v, 0) / buf.length;
        points.push({ t: bucketKey(t, 'bet'), winrate: Number(wr.toFixed(6)), n: buf.length });
      }

      return res.json({ chart: 'winrate', mode, bucket: 'bet', window, sessionId, points });
    }

    const map = new Map();
    let cumW = 0, cumL = 0;

    for (const b of bets) {
      const t = b.settledAt || b.createdAt;
      const key = bucketKey(t, bucket);

      if (mode === 'cumulative') {
        if (b.status === 'WIN') cumW++; else cumL++;
        const denom = cumW + cumL;
        const wr = denom ? cumW / denom : 0;
        map.set(key, { t: key, winrate: Number(wr.toFixed(6)), wins: cumW, losses: cumL });
      } else {
        // period
        const agg = map.get(key) || { t: key, wins: 0, losses: 0 };
        if (b.status === 'WIN') agg.wins++; else agg.losses++;
        const denom = agg.wins + agg.losses;
        agg.winrate = Number((denom ? agg.wins / denom : 0).toFixed(6));
        map.set(key, agg);
      }
    }

    res.json({ chart: 'winrate', mode, bucket, sessionId, points: Array.from(map.values()) });
  } catch (e) { next(e); }
}
export async function drawdownChart(req, res, next) {
  try {
    const sessionId = req.query.sessionId ? String(req.query.sessionId) : null;
    const mode = String(req.query.mode || (sessionId ? 'session' : 'total'));
    const bucket = String(req.query.bucket || 'day');

    const sessions = await loadMySessions(req, { sessionId });
    if (sessionId && sessions.length === 0) return res.status(404).json({ message: 'Session not found' });

    const bets = await loadMySettledBets(req, { sessionId });

    let bankStart = 0;
    if (mode === 'session') {
      if (!sessionId) return res.status(400).json({ message: 'mode=session requires sessionId' });
      bankStart = Number(sessions[0].initialBank || 0);
    } else {
      bankStart = sessions.reduce((acc, s) => acc + Number(s.initialBank || 0), 0);
    }

    let bank = bankStart;
    let peak = bankStart;

    const map = new Map();
    for (const b of bets) {
      const t = b.settledAt || b.createdAt;
      bank += Number(b.profit || 0);
      if (bank > peak) peak = bank;

      const ddAbs = bank - peak;               // <= 0
      const ddPct = peak > 0 ? ddAbs / peak : 0; // <= 0

      const key = bucketKey(t, bucket);
      map.set(key, {
        t: key,
        drawdownAbs: Number(ddAbs.toFixed(6)),
        drawdownPct: Number(ddPct.toFixed(6)),
        peak: Number(peak.toFixed(6)),
        bank: Number(bank.toFixed(6))
      });
    }

    res.json({
      chart: 'drawdown',
      mode,
      bucket,
      sessionId,
      bankStart: Number(bankStart.toFixed(6)),
      points: Array.from(map.values())
    });
  } catch (e) { next(e); }
}
