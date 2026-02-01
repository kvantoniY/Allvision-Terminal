import { db } from '../../db/index.js';

function parseRange(range) {
  const r = String(range || 'all');
  if (r === '7d') return 7;
  if (r === '30d') return 30;
  if (r === '90d') return 90;
  return null; // all
}

function isUuid(v) {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

async function isBlockedEitherWay(a, b) {
  const row = await db.models.Blacklist.findOne({
    where: {
      [db.Sequelize.Op.or]: [
        { ownerId: a, blockedId: b },
        { ownerId: b, blockedId: a }
      ]
    }
  });
  return !!row;
}

async function computeStats({ ownerUserId, rangeDays, sessionId }) {
  const whereBet = {};
  // join to session to filter by owner
  const include = [{
    model: db.models.BankSession,
    as: 'Session',
    attributes: [],
    where: { userId: ownerUserId }
  }];

  if (sessionId) whereBet.sessionId = sessionId;

  if (rangeDays) {
    const from = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000);
    whereBet.createdAt = { [db.Sequelize.Op.gte]: from };
  }

  const rows = await db.models.Bet.findAll({
    where: whereBet,
    include,
    attributes: [
      'status',
      'stake',
      'profit',
      'odds',
      'risk',
      'createdAt'
    ],
    raw: true
  });

  let betsTotal = rows.length;
  let wins = 0, losses = 0, pending = 0;

  let stakeSum = 0;
  let profitSum = 0;

  let oddsSum = 0, oddsCnt = 0;
  let riskSum = 0, riskCnt = 0;

  let updatedAt = null;

  for (const r of rows) {
    if (!updatedAt || new Date(r.createdAt) > new Date(updatedAt)) updatedAt = r.createdAt;

    if (r.status === 'WIN') wins++;
    else if (r.status === 'LOSE') losses++;
    else pending++;

    const stake = Number(r.stake || 0);
    const profit = Number(r.profit || 0);

    stakeSum += stake;
    profitSum += profit;

    const odds = Number(r.odds || 0);
    if (odds > 0) { oddsSum += odds; oddsCnt++; }

    const risk = Number(r.risk || 0);
    if (risk > 0) { riskSum += risk; riskCnt++; }
  }

  const winrate = (wins + losses) > 0 ? wins / (wins + losses) : 0;
  const roi = stakeSum > 0 ? profitSum / stakeSum : 0;
  const avgOdds = oddsCnt ? oddsSum / oddsCnt : 0;
  const avgRisk = riskCnt ? riskSum / riskCnt : 0;

  return {
    betsTotal,
    wins,
    losses,
    pending,
    winrate,
    stakeSum,
    profitSum,
    roi,
    avgOdds,
    avgRisk,
    updatedAt
  };
}

export async function myStats(req, res, next) {
  try {
    const rangeDays = parseRange(req.query.range);
    const sessionId = req.query.sessionId ? String(req.query.sessionId) : null;
    if (sessionId && !isUuid(sessionId)) return res.status(400).json({ message: 'Invalid sessionId' });

    const stats = await computeStats({ ownerUserId: req.user.id, rangeDays, sessionId });
    res.json({ range: String(req.query.range || 'all'), sessionId, stats });
  } catch (e) { next(e); }
}

export async function userStatsByPublicId(req, res, next) {
  try {
    const publicId = String(req.params.publicId || '').trim();
    if (!/^[A-Za-z0-9_-]{8,16}$/.test(publicId)) return res.status(400).json({ message: 'Invalid publicId' });

    const user = await db.models.User.findOne({
      where: { publicId },
      attributes: ['id', 'publicId', 'username'],
      include: [{ model: db.models.PrivacySettings, as: 'Privacy' }]
    });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const blocked = await isBlockedEitherWay(req.user.id, user.id);
    if (blocked) return res.status(404).json({ message: 'User not found' });

    const showStats = user.Privacy?.showStats ?? true;
    if (!showStats && req.user.id !== user.id) {
      return res.status(403).json({ message: 'Stats are private' });
    }

    const rangeDays = parseRange(req.query.range);
    const sessionId = req.query.sessionId ? String(req.query.sessionId) : null;
    if (sessionId && !isUuid(sessionId)) return res.status(400).json({ message: 'Invalid sessionId' });

    // Важно: если sessionId передан — убедимся, что сессия принадлежит этому пользователю
    if (sessionId) {
      const s = await db.models.BankSession.findOne({ where: { id: sessionId, userId: user.id } });
      if (!s) return res.status(404).json({ message: 'Session not found' });
    }

    const stats = await computeStats({ ownerUserId: user.id, rangeDays, sessionId });
    res.json({ user: { publicId: user.publicId, username: user.username }, range: String(req.query.range || 'all'), sessionId, stats });
  } catch (e) { next(e); }
}

export async function terminalSummary(req, res, next) {
  try {
    const rangeDays = parseRange(req.query.range);

    // сюда можно позже добавить advanced: bestTeam, bestOdds, bestBet и т.д.
    const stats = await computeStats({ ownerUserId: req.user.id, rangeDays, sessionId: null });

    res.json({ range: String(req.query.range || 'all'), stats });
  } catch (e) { next(e); }
}
