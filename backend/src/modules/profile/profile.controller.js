import { db } from '../../db/index.js';

function isPublicId(v) {
  return typeof v === 'string' && /^[A-Za-z0-9_-]{8,16}$/.test(v);
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

async function iBlocked(a, b) {
  const row = await db.models.Blacklist.findOne({ where: { ownerId: a, blockedId: b } });
  return !!row;
}

async function blockedMe(a, b) {
  const row = await db.models.Blacklist.findOne({ where: { ownerId: b, blockedId: a } });
  return !!row;
}

async function amFollowing(a, b) {
  const row = await db.models.Follow.findOne({ where: { followerId: a, followingId: b } });
  return !!row;
}

async function isFollowingMe(a, b) {
  const row = await db.models.Follow.findOne({ where: { followerId: b, followingId: a } });
  return !!row;
}

function canMessageByPrivacy({ allowMessages, isMe, amFollowingFlag, isFollowingMeFlag }) {
  if (isMe) return true;
  if (allowMessages === 'ALL') return true;
  if (allowMessages === 'NONE') return false;
  if (allowMessages === 'FOLLOWERS') return isFollowingMeFlag; // он должен быть подписан на меня
  if (allowMessages === 'MUTUAL') return amFollowingFlag && isFollowingMeFlag;
  return true;
}

export async function getProfileByPublicId(req, res, next) {
  try {
    const publicId = String(req.params.publicId || '').trim();
    console.log('sdasd')
    if (!isPublicId(publicId)) return res.status(400).json({ message: 'Invalid publicId' });
    
    const user = await db.models.User.findOne({
      where: { publicId },
      attributes: ['id', 'publicId', 'username', 'avatarUrl', 'bio', 'lastSeenAt'],
      include: [{ model: db.models.PrivacySettings, as: 'Privacy' }]
    });

    if (!user) return res.status(404).json({ message: 'User not found' });

    // blacklist hides existence
    if (await isBlockedEitherWay(req.user.id, user.id)) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMe = req.user.id === user.id;

    // relationship flags
    const [amFollowingFlag, isFollowingMeFlag, iBlockedFlag, blockedMeFlag] = await Promise.all([
      amFollowing(req.user.id, user.id),
      isFollowingMe(req.user.id, user.id),
      iBlocked(req.user.id, user.id),
      blockedMe(req.user.id, user.id)
    ]);

    const isMutual = amFollowingFlag && isFollowingMeFlag;

    const allowMessages = user.Privacy?.allowMessages || 'ALL';
    const canMessage = canMessageByPrivacy({
      allowMessages,
      isMe,
      amFollowingFlag,
      isFollowingMeFlag
    });

    // counts (meta)
    const [followersCount, followingCount, sessionsCount, betsCount] = await Promise.all([
      db.models.Follow.count({ where: { followingId: user.id } }),
      db.models.Follow.count({ where: { followerId: user.id } }),
      db.models.BankSession.count({ where: { userId: user.id } }),
      db.models.Bet.count({
        include: [{
          model: db.models.BankSession,
          as: 'Session',
          attributes: [],
          where: { userId: user.id }
        }]
      })
    ]);

    res.json({
      user: {
        publicId: user.publicId,
        username: user.username,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        privacy: {
          showBets: !!user.Privacy?.showBets,
          showStats: !!user.Privacy?.showStats,
          showFollowers: !!user.Privacy?.showFollowers,
          allowMessages
        }
      },
      meta: { followersCount, followingCount, sessionsCount, betsCount },
      relationship: {
        isMe,
        amFollowing: amFollowingFlag,
        isFollowingMe: isFollowingMeFlag,
        isMutual,
        iBlocked: iBlockedFlag,
        blockedMe: blockedMeFlag,
        canMessage
      }
    });
  } catch (e) { next(e); }
}
import { db } from '../../db/index.js';

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

export async function profileBetsByPublicId(req, res, next) {
  try {
    const publicId = String(req.params.publicId || '').trim();
    if (!isPublicId(publicId)) return res.status(400).json({ message: 'Invalid publicId' });

    const target = await findUserByPublicId(publicId);
    if (!target) return res.status(404).json({ message: 'User not found' });

    // blacklist => hide existence
    if (await isBlockedEitherWay(req.user.id, target.id)) {
      return res.status(404).json({ message: 'User not found' });
    }

    // privacy showBets
    const showBets = target.Privacy?.showBets ?? true;
    if (!showBets && req.user.id !== target.id) {
      return res.status(403).json({ message: 'Bets are private' });
    }

    const { Op } = db.Sequelize;

    const limit = Math.max(1, Math.min(100, Number(req.query.limit || 20)));
    const offset = Math.max(0, Number(req.query.offset || 0));

    const status = safeEnum(req.query.status, ['PENDING', 'WIN', 'LOSE']);
    const game = safeEnum(req.query.game, ['DOTA2', 'CS2']);
    const tier = safeIntEnum(req.query.tier, [1, 2, 3]);
    const risk = safeIntEnum(req.query.risk, [1, 2, 3, 4, 5]);

    const from = parseDateOnly(req.query.from);
    const to = parseDateOnly(req.query.to);
    const q = String(req.query.q || '').trim();

    const sort = safeEnum(req.query.sort, ['createdAt', 'odds', 'profit', 'stake', 'risk', 'tier']) || 'createdAt';
    const order = safeEnum(req.query.order, ['asc', 'desc']) || 'desc';

    const whereBet = {};
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

    // Restrict by owner's sessions
    const includeSession = {
      model: db.models.BankSession,
      as: 'Session',
      attributes: ['id', 'title', 'status'],
      where: { userId: target.id }
    };

    const bets = await db.models.Bet.findAll({
      where: whereBet,
      include: [includeSession],
      order: [[sort, order.toUpperCase()], ['id', 'DESC']],
      limit,
      offset
    });

    res.json({
      items: bets,
      page: { limit, offset },
      query: {
        status, game, tier, risk,
        from: req.query.from || null,
        to: req.query.to || null,
        q: q || null,
        sort, order
      }
    });
  } catch (e) { next(e); }
}

function isUuid(v) {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function parseRangeDays(range) {
  const r = String(range || 'all');
  if (r === '7d') return 7;
  if (r === '30d') return 30;
  if (r === '90d') return 90;
  return null; // all
}

async function computeStats({ ownerUserId, rangeDays, sessionId }) {
  const { Op } = db.Sequelize;

  const whereBet = {};
  const include = [{
    model: db.models.BankSession,
    as: 'Session',
    attributes: [],
    where: { userId: ownerUserId }
  }];

  if (sessionId) whereBet.sessionId = sessionId;

  if (rangeDays) {
    const from = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000);
    whereBet.createdAt = { [Op.gte]: from };
  }

  const rows = await db.models.Bet.findAll({
    where: whereBet,
    include,
    attributes: ['status', 'stake', 'profit', 'odds', 'risk', 'createdAt'],
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

    stakeSum += Number(r.stake || 0);
    profitSum += Number(r.profit || 0);

    const o = Number(r.odds || 0);
    if (o > 0) { oddsSum += o; oddsCnt++; }

    const rk = Number(r.risk || 0);
    if (rk > 0) { riskSum += rk; riskCnt++; }
  }

  const winrate = (wins + losses) ? wins / (wins + losses) : 0;
  const roi = stakeSum > 0 ? profitSum / stakeSum : 0;
  const avgOdds = oddsCnt ? oddsSum / oddsCnt : 0;
  const avgRisk = riskCnt ? riskSum / riskCnt : 0;

  return {
    betsTotal,
    wins,
    losses,
    pending,
    winrate: Number(winrate.toFixed(6)),
    stakeSum: Number(stakeSum.toFixed(6)),
    profitSum: Number(profitSum.toFixed(6)),
    roi: Number(roi.toFixed(6)),
    avgOdds: Number(avgOdds.toFixed(6)),
    avgRisk: Number(avgRisk.toFixed(6)),
    updatedAt
  };
}

export async function profileStatsByPublicId(req, res, next) {
  try {
    const publicId = String(req.params.publicId || '').trim();
    if (!isPublicId(publicId)) return res.status(400).json({ message: 'Invalid publicId' });

    const target = await findUserByPublicId(publicId);
    if (!target) return res.status(404).json({ message: 'User not found' });

    // blacklist => hide existence
    if (await isBlockedEitherWay(req.user.id, target.id)) {
      return res.status(404).json({ message: 'User not found' });
    }

    // privacy showStats
    const showStats = target.Privacy?.showStats ?? true;
    if (!showStats && req.user.id !== target.id) {
      return res.status(403).json({ message: 'Stats are private' });
    }

    const range = String(req.query.range || 'all');
    const rangeDays = parseRangeDays(range);

    const sessionId = req.query.sessionId ? String(req.query.sessionId) : null;
    if (sessionId && !isUuid(sessionId)) return res.status(400).json({ message: 'Invalid sessionId' });

    // если указан sessionId — убедимся, что сессия принадлежит target
    if (sessionId) {
      const s = await db.models.BankSession.findOne({ where: { id: sessionId, userId: target.id } });
      if (!s) return res.status(404).json({ message: 'Session not found' });
    }

    const stats = await computeStats({ ownerUserId: target.id, rangeDays, sessionId });

    res.json({
      user: { publicId: target.publicId, username: target.username },
      range,
      sessionId,
      stats
    });
  } catch (e) { next(e); }
}
