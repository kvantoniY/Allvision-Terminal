import { z } from 'zod';
import { db } from '../../db/index.js';
import { createAndEmitNotification } from '../notifications/notify.js';

const updateProfileSchema = z.object({
    bio: z.string().max(280).nullable().optional(),
    avatarUrl: z.string().url().nullable().optional()
});

const updatePrivacySchema = z.object({
    showBets: z.boolean().optional(),
    showStats: z.boolean().optional(),
    showFollowers: z.boolean().optional(),
    allowMessages: z.enum(['ALL', 'FOLLOWERS', 'MUTUAL', 'NONE']).optional()
});

function isPublicId(v) {
    // мы генерим base64url ~12 символов, но разрешим 8..16, чтобы не быть хрупкими
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

async function countFollowersFollowing(userId) {
    const [followersCount, followingCount] = await Promise.all([
        db.models.Follow.count({ where: { followingId: userId } }), // кто подписан на меня
        db.models.Follow.count({ where: { followerId: userId } })   // на кого подписан я
    ]);
    return { followersCount, followingCount };
}

export async function getMyProfile(req, res, next) {
    try {
        const user = await db.models.User.findByPk(req.user.id, {
            attributes: ['id', 'publicId', 'username', 'avatarUrl', 'bio', 'lastSeenAt'],
            include: [{ model: db.models.PrivacySettings, as: 'Privacy' }]
        });
        if (!user) return res.status(404).json({ message: 'User not found' });

        const counts = await countFollowersFollowing(req.user.id);
        res.json({ user, meta: counts });
    } catch (e) { next(e); }
}

export async function updateMyProfile(req, res, next) {
    try {
        const patch = updateProfileSchema.parse(req.body);

        const user = await db.models.User.findByPk(req.user.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        await user.update({
            bio: patch.bio !== undefined ? patch.bio : user.bio,
            avatarUrl: patch.avatarUrl !== undefined ? patch.avatarUrl : user.avatarUrl
        });

        const refreshed = await db.models.User.findByPk(req.user.id, {
            attributes: ['id', 'publicId', 'username', 'avatarUrl', 'bio', 'lastSeenAt'],
            include: [{ model: db.models.PrivacySettings, as: 'Privacy' }]
        });

        res.json({ user: refreshed });
    } catch (e) { next(e); }
}

export async function updateMyPrivacy(req, res, next) {
    try {
        const patch = updatePrivacySchema.parse(req.body);

        const privacy = await db.models.PrivacySettings.findOne({ where: { userId: req.user.id } });
        if (!privacy) return res.status(404).json({ message: 'Privacy settings not found' });

        await privacy.update(patch);
        res.json({ privacy });
    } catch (e) { next(e); }
}

export async function getMyBlacklist(req, res, next) {
    try {
        const rows = await db.models.Blacklist.findAll({
            where: { ownerId: req.user.id },
            order: [['createdAt', 'DESC']]
        });

        const blockedIds = rows.map(r => r.blockedId);
        if (blockedIds.length === 0) return res.json({ blocked: [] });

        const blocked = await db.models.User.findAll({
            where: { id: blockedIds },
            attributes: ['id', 'publicId', 'username', 'avatarUrl', 'bio', 'lastSeenAt'],
            order: [['username', 'ASC']]
        });

        res.json({ blocked });
    } catch (e) { next(e); }
}

export async function getUserByPublicId(req, res, next) {
    try {
        const publicId = req.params.publicId;
        if (!isPublicId(publicId)) return res.status(400).json({ message: 'Invalid publicId' });

        const user = await findUserByPublicId(publicId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const blocked = await isBlockedEitherWay(req.user.id, user.id);
        if (blocked) return res.status(404).json({ message: 'User not found' });

        const counts = await countFollowersFollowing(user.id);
        const showFollowers = user.Privacy?.showFollowers ?? true;

        res.json({
            user,
            meta: {
                followersCount: showFollowers ? counts.followersCount : null,
                followingCount: showFollowers ? counts.followingCount : null
            }
        });
    } catch (e) { next(e); }
}

export async function followByPublicId(req, res, next) {
    try {
        const publicId = req.params.publicId;
        if (!isPublicId(publicId)) return res.status(400).json({ message: 'Invalid publicId' });

        const target = await findUserByPublicId(publicId);
        if (!target) return res.status(404).json({ message: 'User not found' });
        if (target.id === req.user.id) return res.status(409).json({ message: 'Cannot follow yourself' });

        const blocked = await isBlockedEitherWay(req.user.id, target.id);
        if (blocked) return res.status(403).json({ message: 'Forbidden' });

        await db.models.Follow.findOrCreate({
            where: { followerId: req.user.id, followingId: target.id },
            defaults: { followerId: req.user.id, followingId: target.id }
        });
        // создание уведомления
        await createAndEmitNotification(req, {
            userId: target.id,           
            actorId: req.user.id,        
            type: 'FOLLOW',
            entityId: req.user.id        
        });

        res.status(201).json({ ok: true });
    } catch (e) { next(e); }
}

export async function unfollowByPublicId(req, res, next) {
    try {
        const publicId = req.params.publicId;
        if (!isPublicId(publicId)) return res.status(400).json({ message: 'Invalid publicId' });

        const target = await findUserByPublicId(publicId);
        if (!target) return res.status(404).json({ message: 'User not found' });

        await db.models.Follow.destroy({
            where: { followerId: req.user.id, followingId: target.id }
        });

        res.json({ ok: true });
    } catch (e) { next(e); }
}

export async function followersByPublicId(req, res, next) {
    try {
        const publicId = req.params.publicId;
        if (!isPublicId(publicId)) return res.status(400).json({ message: 'Invalid publicId' });

        const target = await findUserByPublicId(publicId);
        if (!target) return res.status(404).json({ message: 'User not found' });

        const blocked = await isBlockedEitherWay(req.user.id, target.id);
        if (blocked) return res.status(404).json({ message: 'User not found' });

        const showFollowers = target.Privacy?.showFollowers ?? true;
        if (!showFollowers && target.id !== req.user.id) {
            return res.status(403).json({ message: 'Followers are private' });
        }

        // список пользователей, которые подписаны на target
        const followerLinks = await db.models.Follow.findAll({
            where: { followingId: target.id },
            order: [['createdAt', 'DESC']]
        });

        const followerIds = followerLinks.map(x => x.followerId);
        if (followerIds.length === 0) return res.json({ followers: [] });

        const followers = await db.models.User.findAll({
            where: { id: followerIds },
            attributes: ['id', 'publicId', 'username', 'avatarUrl', 'bio', 'lastSeenAt'],
            order: [['username', 'ASC']]
        });

        res.json({ followers });
    } catch (e) { next(e); }
}

export async function followingByPublicId(req, res, next) {
    try {
        const publicId = req.params.publicId;
        if (!isPublicId(publicId)) return res.status(400).json({ message: 'Invalid publicId' });

        const target = await findUserByPublicId(publicId);
        if (!target) return res.status(404).json({ message: 'User not found' });

        const blocked = await isBlockedEitherWay(req.user.id, target.id);
        if (blocked) return res.status(404).json({ message: 'User not found' });

        const showFollowers = target.Privacy?.showFollowers ?? true;
        if (!showFollowers && target.id !== req.user.id) {
            return res.status(403).json({ message: 'Following is private' });
        }

        // список пользователей, на которых подписан target
        const followingLinks = await db.models.Follow.findAll({
            where: { followerId: target.id },
            order: [['createdAt', 'DESC']]
        });

        const followingIds = followingLinks.map(x => x.followingId);
        if (followingIds.length === 0) return res.json({ following: [] });

        const following = await db.models.User.findAll({
            where: { id: followingIds },
            attributes: ['id', 'publicId', 'username', 'avatarUrl', 'bio', 'lastSeenAt'],
            order: [['username', 'ASC']]
        });

        res.json({ following });
    } catch (e) { next(e); }
}

export async function searchUsers(req, res, next) {
    try {
        const q = String(req.query.q || '').trim();
        const limit = Math.max(1, Math.min(50, Number(req.query.limit || 10)));

        if (q.length < 1) return res.json({ users: [] });

        // 1) кандидаты по username (ILIKE)
        const candidates = await db.models.User.findAll({
            where: {
                username: { [db.Sequelize.Op.iLike]: `${q}%` } // prefix search
            },
            attributes: ['id', 'publicId', 'username', 'avatarUrl', 'bio', 'lastSeenAt'],
            order: [['username', 'ASC']],
            limit
        });

        if (candidates.length === 0) return res.json({ users: [] });

        // 2) фильтруем тех, кто заблокирован/блокировал
        const ids = candidates.map(u => u.id);

        const blocks = await db.models.Blacklist.findAll({
            where: {
                [db.Sequelize.Op.or]: [
                    { ownerId: req.user.id, blockedId: { [db.Sequelize.Op.in]: ids } },
                    { blockedId: req.user.id, ownerId: { [db.Sequelize.Op.in]: ids } }
                ]
            }
        });

        const blockedSet = new Set();
        for (const b of blocks) {
            // если я владелец — заблокированный = blockedId
            if (b.ownerId === req.user.id) blockedSet.add(b.blockedId);
            // если меня заблокировали — владелец = ownerId
            if (b.blockedId === req.user.id) blockedSet.add(b.ownerId);
        }

        const users = candidates.filter(u => !blockedSet.has(u.id));
        res.json({ users });
    } catch (e) { next(e); }
}


export async function blockByPublicId(req, res, next) {
    try {
        const publicId = req.params.publicId;
        if (!isPublicId(publicId)) return res.status(400).json({ message: 'Invalid publicId' });

        const target = await findUserByPublicId(publicId);
        if (!target) return res.status(404).json({ message: 'User not found' });
        if (target.id === req.user.id) return res.status(409).json({ message: 'Cannot block yourself' });

        await db.models.Blacklist.findOrCreate({
            where: { ownerId: req.user.id, blockedId: target.id },
            defaults: { ownerId: req.user.id, blockedId: target.id }
        });

        // снимаем подписки в обе стороны
        await db.models.Follow.destroy({
            where: {
                [db.Sequelize.Op.or]: [
                    { followerId: req.user.id, followingId: target.id },
                    { followerId: target.id, followingId: req.user.id }
                ]
            }
        });

        res.status(201).json({ ok: true });
    } catch (e) { next(e); }
}

export async function unblockByPublicId(req, res, next) {
    try {
        const publicId = req.params.publicId;
        if (!isPublicId(publicId)) return res.status(400).json({ message: 'Invalid publicId' });

        const target = await findUserByPublicId(publicId);
        if (!target) return res.status(404).json({ message: 'User not found' });

        await db.models.Blacklist.destroy({
            where: { ownerId: req.user.id, blockedId: target.id }
        });

        res.json({ ok: true });
    } catch (e) { next(e); }
}
export async function updateMyAvatar(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ message: 'file is required' });

    const avatarUrl = `/uploads/${req.file.filename}`;

    await db.models.User.update(
      { avatarUrl },
      { where: { id: req.user.id } }
    );

    res.json({ ok: true, avatarUrl });
  } catch (e) { next(e); }
}
