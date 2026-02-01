import { db } from '../../db/index.js';

/**
 * Helpers
 */

function isUuid(v) {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function parseDateOnly(s) {
  const str = String(s || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  const d = new Date(str + 'T00:00:00');
  return Number.isNaN(d.getTime()) ? null : d;
}

function safeEnum(v, allowed) {
  const s = String(v || '').trim();
  return allowed.includes(s) ? s : null;
}

function safeIntEnum(v, allowed) {
  const n = Number(v);
  return Number.isInteger(n) && allowed.includes(n) ? n : null;
}

function isPublicId(v) {
  return typeof v === 'string' && /^[A-Za-z0-9_-]{8,16}$/.test(v);
}

async function findUserByPublicId(publicId) {
  return db.models.User.findOne({
    where: { publicId },
    attributes: ['id', 'publicId', 'username', 'avatarUrl', 'bio', 'lastSeenAt'],
    include: [{ model: db.models.PrivacySettings, as: 'Privacy' }]
  });
}

async function isBlockedEitherWay(viewerId, ownerId) {
  const row = await db.models.Blacklist.findOne({
    where: {
      [db.Sequelize.Op.or]: [
        { ownerId: viewerId, blockedId: ownerId },
        { ownerId: ownerId, blockedId: viewerId }
      ]
    }
  });
  return !!row;
}

function clamp(x, min, max) {
  return Math.max(min, Math.min(max, x));
}

function calcRecommendation({ bank, odds, bo, tier, risk }) {
  const o = Number(odds);
  const B = Number(bank);

  if (!(B > 0) || !(o > 1)) {
    return { recommendedPct: 0, recommendedStake: 0, stakingModel: 'kvantonium v3' };
  }

  // ---- Base (stronger for low odds) ----
  // We map odds into [1.2..3.0] for stability and use a mild non-linear decay.
  // Target behavior (before multipliers):
  // odds 1.40 -> ~2.2%
  // odds 1.60 -> ~1.9%
  // odds 2.00 -> ~1.5%
  // odds 2.50 -> ~1.2%
  const oClamped = clamp(o, 1.2, 3.0);
  const t = (oClamped - 1.2) / (3.0 - 1.2); // 0..1
  const base = 0.022 - 0.010 * Math.pow(t, 0.9); // ~2.2% down to ~1.2%

  // ---- BO adjustment (stronger cuts for BO1/BO2) ----
  const boFactor =
    bo === 1 ? 0.78 :
    bo === 2 ? 0.88 :
    bo === 3 ? 1.00 :
    1.06; // bo5+

  // ---- Tier adjustment (tier2-3 stronger cut) ----
  const tierFactor =
    tier === 1 ? 1.00 :
    tier === 2 ? 0.78 :
    0.62;

  // ---- Risk adjustment (risk=1 slightly higher; others cut more) ----
  const riskFactor =
    risk === 1 ? 1.12 :
    risk === 2 ? 0.82 :
    risk === 3 ? 0.64 :
    risk === 4 ? 0.47 :
    0.34;

  let pct = base * boFactor * tierFactor * riskFactor;

  // ---- Safety clamps ----
  // Keep floor small and allow higher ceiling (you asked higher %). Adjust if needed.
  pct = clamp(pct, 0.001, 0.07); // 0.1% .. 7%

  const stake = pct * B;

  return {
    recommendedPct: pct,
    recommendedStake: stake,
    stakingModel: 'kvantonium v3',
  };
}

async function mustGetMySession(sessionId, userId, { transaction } = {}) {
  const s = await db.models.BankSession.findOne({
    where: { id: sessionId, userId },
    transaction
  });
  return s;
}

/**
 * Sessions
 */

export async function createSession(req, res, next) {
  try {
    const title = String(req.body.title || '').trim();
    const initialBank = Number(req.body.initialBank);

    if (!title || title.length > 80) return res.status(400).json({ message: 'Invalid title' });
    if (!(initialBank > 0)) return res.status(400).json({ message: 'Invalid initialBank' });

    const session = await db.models.BankSession.create({
      userId: req.user.id,
      title,
      initialBank,
      currentBank: initialBank,
      status: 'OPEN'
    });

    res.status(201).json({ session });
  } catch (e) {
    next(e);
  }
}

export async function listSessions(req, res, next) {
  try {
    const { Op } = db.Sequelize;

    const q = String(req.query.q || '').trim();
    const status = safeEnum(req.query.status, ['OPEN', 'CLOSED']);
    const profit = safeEnum(req.query.profit, ['plus', 'minus']);

    const sort = safeEnum(req.query.sort, ['createdAt', 'currentBank', 'profit']) || 'createdAt';
    const order = safeEnum(req.query.order, ['asc', 'desc']) || 'desc';

    const limit = Math.max(1, Math.min(100, Number(req.query.limit || 20)));
    const offset = Math.max(0, Number(req.query.offset || 0));

    const where = { userId: req.user.id };
    if (status) where.status = status;

    if (q.length >= 2) {
      where.title = { [Op.iLike]: `%${q}%` };
    }

    // виртуальное поле profit = currentBank - initialBank
    const profitLiteral = db.sequelize.literal(`("current_bank" - "initial_bank")`);

    if (profit === 'plus') {
      where[Op.and] = db.sequelize.where(profitLiteral, { [Op.gt]: 0 });
    }

    if (profit === 'minus') {
      where[Op.and] = db.sequelize.where(profitLiteral, { [Op.lt]: 0 });
    }

    const orderBy =
      sort === 'profit'
        ? [[profitLiteral, order.toUpperCase()]]
        : [[sort, order.toUpperCase()]];

    const sessions = await db.models.BankSession.findAll({
      where,
      order: orderBy,
      limit,
      offset,
      attributes: [
        'id', 'title', 'status',
        'initialBank', 'currentBank',
        'createdAt', 'closedAt',
        [profitLiteral, 'profit']
      ]
    });

    res.json({
      items: sessions,
      page: { limit, offset }
    });
  } catch (e) {
    next(e);
  }
}

export async function getSession(req, res, next) {
  try {
    const id = String(req.params.id || '');
    if (!isUuid(id)) return res.status(400).json({ message: 'Invalid id' });

    const session = await db.models.BankSession.findOne({
      where: { id, userId: req.user.id },
      include: [{ model: db.models.Bet, as: 'Bets' }],
      order: [[{ model: db.models.Bet, as: 'Bets' }, 'createdAt', 'DESC']]
    });

    if (!session) return res.status(404).json({ message: 'Session not found' });

    res.json({ session });
  } catch (e) {
    next(e);
  }
}

/**
 * Bets
 */

export async function addBetToSession(req, res, next) {
  const t = await db.sequelize.transaction();
  try {
    const sessionId = String(req.params.id || '');
    if (!isUuid(sessionId)) {
      await t.rollback();
      return res.status(400).json({ message: 'Invalid session id' });
    }

    const session = await db.models.BankSession.findOne({
      where: { id: sessionId, userId: req.user.id },
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (!session) {
      await t.rollback();
      return res.status(404).json({ message: 'Session not found' });
    }
    if (session.status !== 'OPEN') {
      await t.rollback();
      return res.status(409).json({ message: 'Session closed' });
    }

    const game = safeEnum(req.body.game, ['DOTA2', 'CS2']);
    const tournament = String(req.body.tournament || '').trim();
    const team1 = String(req.body.team1 || '').trim();
    const team2 = String(req.body.team2 || '').trim();
    const pickTeam = req.body.pickTeam ? String(req.body.pickTeam).trim() : null;

    const betType = safeEnum(req.body.betType, ['HANDICAP', 'MAP_WIN', 'MATCH_WIN']);
    const bo = safeIntEnum(req.body.bo, [1, 2, 3, 5]);
    const tier = safeIntEnum(req.body.tier, [1, 2, 3]);
    const risk = safeIntEnum(req.body.risk, [1, 2, 3, 4, 5]);

    const odds = Number(req.body.odds);
    const stake = Number(req.body.stake);

    if (!game) { await t.rollback(); return res.status(400).json({ message: 'Invalid game' }); }
    if (!tournament) { await t.rollback(); return res.status(400).json({ message: 'Invalid tournament' }); }
    if (!team1 || !team2) { await t.rollback(); return res.status(400).json({ message: 'Invalid teams' }); }
    if (!betType) { await t.rollback(); return res.status(400).json({ message: 'Invalid betType' }); }
    if (!bo) { await t.rollback(); return res.status(400).json({ message: 'Invalid bo' }); }
    if (!tier) { await t.rollback(); return res.status(400).json({ message: 'Invalid tier' }); }
    if (!risk) { await t.rollback(); return res.status(400).json({ message: 'Invalid risk' }); }
    if (!(odds > 1)) { await t.rollback(); return res.status(400).json({ message: 'Invalid odds' }); }
    if (!(stake > 0)) { await t.rollback(); return res.status(400).json({ message: 'Invalid stake' }); }

    // ---- Key change ----
    // Bank for recommendation = currentBank minus stakes already in PENDING.
    const pendingSum = Number(await db.models.Bet.sum('stake', {
      where: { sessionId: session.id, status: 'PENDING' },
      transaction: t
    }) || 0);

    const bankAvailable = Number(session.currentBank || 0) - pendingSum;

    if (!(bankAvailable > 0)) {
      await t.rollback();
      return res.status(409).json({ message: 'Insufficient bank' });
    }

    if (!(stake <= bankAvailable)) {
      await t.rollback();
      return res.status(409).json({ message: 'Insufficient bank' });
    }

    const rec = calcRecommendation({
      bank: bankAvailable,
      odds,
      bo,
      tier,
      risk
    });

    const bet = await db.models.Bet.create({
      sessionId: session.id,
      game,
      tournament,
      team1,
      team2,
      pickTeam,
      betType,
      bo,
      tier,
      risk,
      odds,
      recommendedPct: rec.recommendedPct,
      recommendedStake: rec.recommendedStake,
      stake,
      status: 'PENDING',
      profit: 0,
      stakingModel: rec.stakingModel
    }, { transaction: t });

    await t.commit();
    res.status(201).json({
      bet,
      recommendation: {
        recommendedPct: rec.recommendedPct,
        recommendedStake: rec.recommendedStake,
        stakingModel: rec.stakingModel
      },
      // Keep existing contract: sessionBank is the session currentBank (not "availableBank")
      sessionBank: String(session.currentBank)
    });
  } catch (e) {
    try { await t.rollback(); } catch {}
    next(e);
  }
}

export async function settleBet(req, res, next) {
  const t = await db.sequelize.transaction();
  try {
    const betId = String(req.params.id || '');
    if (!isUuid(betId)) {
      await t.rollback();
      return res.status(400).json({ message: 'Invalid bet id' });
    }

    const result = safeEnum(req.body.result, ['WIN', 'LOSE']);
    if (!result) {
      await t.rollback();
      return res.status(400).json({ message: 'Invalid result' });
    }

    const bet = await db.models.Bet.findOne({
      where: { id: betId },
      include: [{
        model: db.models.BankSession,
        as: 'Session',
        where: { userId: req.user.id }
      }],
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (!bet) {
      await t.rollback();
      return res.status(404).json({ message: 'Bet not found' });
    }

    if (bet.Session.status !== 'OPEN') {
      await t.rollback();
      return res.status(409).json({ message: 'Session closed' });
    }

    if (bet.status !== 'PENDING') {
      await t.rollback();
      return res.status(409).json({ message: 'Bet already settled' });
    }

    const stake = Number(bet.stake || 0);
    const odds = Number(bet.odds || 0);

    let profit = 0;
    if (result === 'WIN') profit = stake * (odds - 1);
    else profit = -stake;

    // update bet
    await bet.update({
      status: result,
      profit,
      settledAt: new Date()
    }, { transaction: t });

    // update session bank (original behavior): only profit is applied to currentBank
    const session = bet.Session;
    const newBank = Number(session.currentBank || 0) + profit;

    await session.update({
      currentBank: newBank
    }, { transaction: t });

    await t.commit();

    res.json({
      bet,
      session: { id: session.id, currentBank: newBank }
    });
  } catch (e) {
    try { await t.rollback(); } catch {}
    next(e);
  }
}

/**
 * Unified bets list for Terminal
 * GET /terminal/bets?... (filters, pagination, sorting)
 */
export async function listBets(req, res, next) {
  try {
    const { Op } = db.Sequelize;

    const sessionId = req.query.sessionId ? String(req.query.sessionId) : null;
    if (sessionId && !isUuid(sessionId)) return res.status(400).json({ message: 'Invalid sessionId' });

    const status = safeEnum(req.query.status, ['PENDING', 'WIN', 'LOSE']);
    const game = safeEnum(req.query.game, ['DOTA2', 'CS2']);
    const tier = safeIntEnum(req.query.tier, [1, 2, 3]);
    const risk = safeIntEnum(req.query.risk, [1, 2, 3, 4, 5]);

    const from = parseDateOnly(req.query.from);
    const to = parseDateOnly(req.query.to);
    const q = String(req.query.q || '').trim();

    const limit = Math.max(1, Math.min(100, Number(req.query.limit || 20)));
    const offset = Math.max(0, Number(req.query.offset || 0));

    const sort = safeEnum(req.query.sort, ['createdAt', 'odds', 'profit', 'stake', 'risk', 'tier']) || 'createdAt';
    const order = safeEnum(req.query.order, ['asc', 'desc']) || 'desc';

    const whereBet = {};
    if (sessionId) whereBet.sessionId = sessionId;
    if (status) whereBet.status = status;
    if (game) whereBet.game = game;
    if (tier) whereBet.tier = tier;
    if (risk) whereBet.risk = risk;

    if (from || to) {
      const a = from || new Date('1970-01-01T00:00:00');
      const b = to ? new Date(to.getTime() + 24 * 60 * 60 * 1000 - 1) : new Date('2999-12-31T23:59:59');
      whereBet.createdAt = { [Op.between]: [a, b] };
    }

    if (q.length >= 2) {
      whereBet[Op.or] = [
        { team1: { [Op.iLike]: `%${q}%` } },
        { team2: { [Op.iLike]: `%${q}%` } },
        { tournament: { [Op.iLike]: `%${q}%` } }
      ];
    }

    const includeSession = {
      model: db.models.BankSession,
      as: 'Session',
      attributes: ['id', 'title', 'status', 'initialBank', 'currentBank', 'createdAt', 'closedAt'],
      where: { userId: req.user.id }
    };

    const orderBy = [[sort, order.toUpperCase()], ['id', 'DESC']];

    const bets = await db.models.Bet.findAll({
      where: whereBet,
      include: [includeSession],
      order: orderBy,
      limit,
      offset
    });

    // summary по текущей странице (удобно для UI, но не заменяет /terminal/summary)
    let wins = 0, losses = 0, pending = 0;
    let stakeSum = 0, profitSum = 0;

    for (const b of bets) {
      if (b.status === 'WIN') wins++;
      else if (b.status === 'LOSE') losses++;
      else pending++;

      stakeSum += Number(b.stake || 0);
      profitSum += Number(b.profit || 0);
    }

    const winrate = (wins + losses) ? wins / (wins + losses) : 0;
    const roi = stakeSum > 0 ? profitSum / stakeSum : 0;

    res.json({
      items: bets,
      page: { limit, offset },
      summary: {
        wins,
        losses,
        pending,
        winrate: Number(winrate.toFixed(6)),
        stakeSum: Number(stakeSum.toFixed(6)),
        profitSum: Number(profitSum.toFixed(6)),
        roi: Number(roi.toFixed(6))
      },
      query: {
        sessionId,
        status,
        game,
        tier,
        risk,
        from: req.query.from || null,
        to: req.query.to || null,
        q: q || null,
        sort,
        order
      }
    });
  } catch (e) {
    next(e);
  }
}

/**
 * Terminal summary (aggregations over the whole filtered dataset)
 * GET /terminal/summary?... (same filters as /terminal/bets)
 */
export async function terminalSummary(req, res, next) {
  try {
    const { Op } = db.Sequelize;

    const sessionId = req.query.sessionId ? String(req.query.sessionId) : null;
    if (sessionId && !isUuid(sessionId)) return res.status(400).json({ message: 'Invalid sessionId' });

    const status = safeEnum(req.query.status, ['PENDING', 'WIN', 'LOSE']);
    const game = safeEnum(req.query.game, ['DOTA2', 'CS2']);
    const tier = safeIntEnum(req.query.tier, [1, 2, 3]);
    const risk = safeIntEnum(req.query.risk, [1, 2, 3, 4, 5]);

    const from = parseDateOnly(req.query.from);
    const to = parseDateOnly(req.query.to);
    const q = String(req.query.q || '').trim();

    const whereBet = {};
    if (sessionId) whereBet.sessionId = sessionId;
    if (status) whereBet.status = status;
    if (game) whereBet.game = game;
    if (tier) whereBet.tier = tier;
    if (risk) whereBet.risk = risk;

    if (from || to) {
      const a = from || new Date('1970-01-01T00:00:00');
      const b = to ? new Date(to.getTime() + 24 * 60 * 60 * 1000 - 1) : new Date('2999-12-31T23:59:59');
      whereBet.createdAt = { [Op.between]: [a, b] };
    }

    if (q.length >= 2) {
      whereBet[Op.or] = [
        { team1: { [Op.iLike]: `%${q}%` } },
        { team2: { [Op.iLike]: `%${q}%` } },
        { tournament: { [Op.iLike]: `%${q}%` } }
      ];
    }

    const includeSession = {
      model: db.models.BankSession,
      as: 'Session',
      attributes: ['id', 'title', 'status', 'initialBank', 'currentBank', 'createdAt', 'closedAt'],
      where: { userId: req.user.id }
    };

    const bets = await db.models.Bet.findAll({
      where: whereBet,
      include: [includeSession],
      order: [['createdAt', 'DESC'], ['id', 'DESC']]
    });

    let betsTotal = 0;
    let wins = 0;
    let losses = 0;
    let pending = 0;

    let stakeSum = 0;
    let profitSum = 0;

    let bestOddsBet = null;
    let biggestWinBet = null;
    let biggestLossBet = null;

    const teamProfit = new Map();

    let deviationAbsSumPct = 0;
    let deviationCount = 0;
    let deviationOver10 = 0;

    for (const b of bets) {
      betsTotal++;

      if (b.status === 'WIN') wins++;
      else if (b.status === 'LOSE') losses++;
      else pending++;

      const stake = Number(b.stake || 0);
      const profit = Number(b.profit || 0);
      const odds = Number(b.odds || 0);

      stakeSum += stake;
      profitSum += profit;

      if (!bestOddsBet || odds > Number(bestOddsBet.odds || 0)) bestOddsBet = b;

      if (b.status === 'WIN') {
        if (!biggestWinBet || profit > Number(biggestWinBet.profit || 0)) biggestWinBet = b;
      }
      if (b.status === 'LOSE') {
        if (!biggestLossBet || profit < Number(biggestLossBet.profit || 0)) biggestLossBet = b;
      }

      const key = b.pickTeam || b.team1 || '';
      if (key) {
        teamProfit.set(key, (teamProfit.get(key) || 0) + profit);
      }

      const recStake = Number(b.recommendedStake || 0);
      if (recStake > 0) {
        const devPct = (stake - recStake) / recStake;
        deviationAbsSumPct += Math.abs(devPct);
        deviationCount += 1;
        if (Math.abs(devPct) > 0.1) deviationOver10 += 1;
      }
    }

    const settled = wins + losses;
    const winrate = settled ? wins / settled : 0;
    const roi = stakeSum > 0 ? profitSum / stakeSum : 0;

    let bestTeam = null;
    for (const [team, p] of teamProfit.entries()) {
      if (!bestTeam || p > bestTeam.profit) bestTeam = { team, profit: p };
    }

    const avgDeviationPct = deviationCount > 0 ? deviationAbsSumPct / deviationCount : 0;
    const deviationOver10Share = deviationCount > 0 ? deviationOver10 / deviationCount : 0;

    res.json({
      totals: {
        betsTotal,
        wins,
        losses,
        pending,
        winrate: Number(winrate.toFixed(6)),
        stakeSum: Number(stakeSum.toFixed(6)),
        profitSum: Number(profitSum.toFixed(6)),
        roi: Number(roi.toFixed(6))
      },
      highlights: {
        bestOddsBet,
        biggestWinBet,
        biggestLossBet,
        bestTeam
      },
      discipline: {
        avgDeviationPct: Number(avgDeviationPct.toFixed(6)),
        deviationOver10Share: Number(deviationOver10Share.toFixed(6))
      }
    });
  } catch (e) {
    next(e);
  }
}

export async function closeSession(req, res, next) {
  const t = await db.sequelize.transaction();
  try {
    const sessionId = String(req.params.id || '');
    if (!isUuid(sessionId)) { await t.rollback(); return res.status(400).json({ message: 'Invalid session id' }); }

    const session = await mustGetMySession(sessionId, req.user.id, { transaction: t });
    if (!session) { await t.rollback(); return res.status(404).json({ message: 'Session not found' }); }

    if (session.status === 'CLOSED') { await t.rollback(); return res.status(409).json({ message: 'Already closed' }); }

    await session.update({ status: 'CLOSED', closedAt: new Date() }, { transaction: t });

    await t.commit();
    res.json({ session });
  } catch (e) {
    await t.rollback();
    next(e);
  }
}

export async function deleteSession(req, res, next) {
  const t = await db.sequelize.transaction();
  try {
    const sessionId = String(req.params.id || '');
    if (!isUuid(sessionId)) { await t.rollback(); return res.status(400).json({ message: 'Invalid session id' }); }

    const session = await mustGetMySession(sessionId, req.user.id, { transaction: t });
    if (!session) { await t.rollback(); return res.status(404).json({ message: 'Session not found' }); }

    const bets = await db.models.Bet.findAll({ where: { sessionId: session.id }, transaction: t });

    // Unlink bets from posts
    const betIds = bets.map(b => b.id);
    if (betIds.length) {
      await db.models.Post.update(
        { attachedBetId: null },
        { where: { attachedBetId: { [db.Sequelize.Op.in]: betIds } }, transaction: t }
      );
    }

    // Delete bets and session (force delete)
    await db.models.Bet.destroy({ where: { sessionId: session.id }, transaction: t });
    await session.destroy({ transaction: t });

    await t.commit();
    res.json({ ok: true });
  } catch (e) {
    await t.rollback();
    next(e);
  }
}

export async function deleteBet(req, res, next) {
  const t = await db.sequelize.transaction();
  try {
    const id = String(req.params.id || '');
    if (!isUuid(id)) { await t.rollback(); return res.status(400).json({ message: 'Invalid bet id' }); }

    const bet = await db.models.Bet.findOne({
      where: { id },
      include: [{
        model: db.models.BankSession,
        as: 'Session',
        where: { userId: req.user.id }
      }],
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (!bet) { await t.rollback(); return res.status(404).json({ message: 'Bet not found' }); }

    // If bet already settled, rollback its profit from session bank
    if (bet.status === 'WIN' || bet.status === 'LOSE') {
      const profit = Number(bet.profit || 0);
      await bet.Session.update({ currentBank: Number(bet.Session.currentBank) - profit }, { transaction: t });
    }

    // Unlink bet from posts
    await db.models.Post.update(
      { attachedBetId: null },
      { where: { attachedBetId: bet.id }, transaction: t }
    );

    await bet.destroy({ transaction: t });

    await t.commit();
    res.json({ ok: true });
  } catch (e) {
    await t.rollback();
    next(e);
  }
}

/**
 * List bets of a specific user (public)
 * GET /terminal/bets/user/u/:publicId
 */
export async function listUserBets(req, res, next) {
  try {
    const { Op } = db.Sequelize;

    const publicId = String(req.params.publicId || '').trim();
    if (!isPublicId(publicId)) return res.status(400).json({ message: 'Invalid publicId' });

    const owner = await findUserByPublicId(publicId);
    if (!owner) return res.status(404).json({ message: 'User not found' });

    // NOTE: privacy showBets is intentionally not checked
    const blocked = await isBlockedEitherWay(req.user.id, owner.id);
    if (blocked) return res.status(404).json({ message: 'User not found' });

    const sessionId = req.query.sessionId ? String(req.query.sessionId) : null;
    if (sessionId && !isUuid(sessionId)) return res.status(400).json({ message: 'Invalid sessionId' });

    const status = safeEnum(req.query.status, ['PENDING', 'WIN', 'LOSE']);
    const game = safeEnum(req.query.game, ['DOTA2', 'CS2']);
    const tier = safeIntEnum(req.query.tier, [1, 2, 3]);
    const risk = safeIntEnum(req.query.risk, [1, 2, 3, 4, 5]);

    const from = parseDateOnly(req.query.from);
    const to = parseDateOnly(req.query.to);
    const q = String(req.query.q || '').trim();

    const limit = Math.max(1, Math.min(100, Number(req.query.limit || 20)));
    const offset = Math.max(0, Number(req.query.offset || 0));

    const sort = safeEnum(req.query.sort, ['createdAt', 'odds', 'profit', 'stake', 'risk', 'tier']) || 'createdAt';
    const order = safeEnum(req.query.order, ['asc', 'desc']) || 'desc';

    const whereBet = {};
    if (sessionId) whereBet.sessionId = sessionId;
    if (status) whereBet.status = status;
    if (game) whereBet.game = game;
    if (tier) whereBet.tier = tier;
    if (risk) whereBet.risk = risk;

    if (from || to) {
      const a = from || new Date('1970-01-01T00:00:00');
      const b = to ? new Date(to.getTime() + 24 * 60 * 60 * 1000 - 1) : new Date('2999-12-31T23:59:59');
      whereBet.createdAt = { [Op.between]: [a, b] };
    }

    if (q.length >= 2) {
      whereBet[Op.or] = [
        { team1: { [Op.iLike]: `%${q}%` } },
        { team2: { [Op.iLike]: `%${q}%` } },
        { tournament: { [Op.iLike]: `%${q}%` } }
      ];
    }

    const includeSession = {
      model: db.models.BankSession,
      as: 'Session',
      attributes: ['id', 'title', 'status', 'initialBank', 'currentBank', 'createdAt', 'closedAt'],
      where: { userId: owner.id }
    };

    const orderBy = [[sort, order.toUpperCase()], ['id', 'DESC']];

    const bets = await db.models.Bet.findAll({
      where: whereBet,
      include: [includeSession],
      order: orderBy,
      limit,
      offset
    });

    let wins = 0, losses = 0, pending = 0;
    let stakeSum = 0, profitSum = 0;

    for (const b of bets) {
      if (b.status === 'WIN') wins++;
      else if (b.status === 'LOSE') losses++;
      else pending++;

      stakeSum += Number(b.stake || 0);
      profitSum += Number(b.profit || 0);
    }

    const winrate = (wins + losses) ? wins / (wins + losses) : 0;
    const roi = stakeSum > 0 ? profitSum / stakeSum : 0;

    res.json({
      items: bets,
      page: { limit, offset },
      summary: {
        wins,
        losses,
        pending,
        winrate: Number(winrate.toFixed(6)),
        stakeSum: Number(stakeSum.toFixed(6)),
        profitSum: Number(profitSum.toFixed(6)),
        roi: Number(roi.toFixed(6))
      }
    });
  } catch (e) {
    next(e);
  }
}

/**
 * Get recommendation for session (no bet creation)
 * POST /terminal/sessions/:id/recommend
 */
export async function recommendBet(req, res, next) {
  try {
    const sessionId = String(req.params.id || '');
    if (!isUuid(sessionId)) return res.status(400).json({ message: 'Invalid session id' });

    const session = await db.models.BankSession.findOne({
      where: { id: sessionId, userId: req.user.id }
    });
    if (!session) return res.status(404).json({ message: 'Session not found' });

    // банк для расчёта = currentBank минус сумма ставок в PENDING
    const pendingSum = Number(await db.models.Bet.sum('stake', {
      where: { sessionId: session.id, status: 'PENDING' }
    }) || 0);

    const bank = Number(session.currentBank ?? session.initialBank) - pendingSum;
    if (!(bank > 0)) return res.status(409).json({ message: 'Session bank must be > 0' });

    const odds = Number(req.body?.odds);
    const bo = Number(req.body?.bo);
    const tier = Number(req.body?.tier);
    const risk = Number(req.body?.risk);

    if (!(odds > 1)) return res.status(400).json({ message: 'Invalid odds' });
    if (![1, 2, 3, 5].includes(bo)) return res.status(400).json({ message: 'Invalid bo' });
    if (![1, 2, 3].includes(tier)) return res.status(400).json({ message: 'Invalid tier' });
    if (![1, 2, 3, 4, 5].includes(risk)) return res.status(400).json({ message: 'Invalid risk' });

    const rec = calcRecommendation({ bank, odds, bo, tier, risk });

    res.json({
      bank: Number(bank),
      recommendedPct: rec.recommendedPct,
      recommendedStake: rec.recommendedStake,
      stakingModel: rec.stakingModel
    });
  } catch (e) {
    next(e);
  }
}
