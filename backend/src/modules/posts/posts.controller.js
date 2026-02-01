import { z } from 'zod';
import { db } from '../../db/index.js';
import { createAndEmitNotification } from '../notifications/notify.js';

const createPostSchema = z.object({
  text: z.string().min(1).max(10000),
  imageUrl: z.string().url().nullable().optional(),
  attachedBetId: z.string().uuid().nullable().optional()
});

const repostSchema = z.object({
  text: z.string().max(5000).optional().default('') // comment to repost
});

const commentSchema = z.object({
  body: z.string().min(1).max(2000)
});

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

async function postCounts(postId) {
  const [likes, comments, reposts] = await Promise.all([
    db.models.PostLike.count({ where: { postId } }),
    db.models.PostComment.count({ where: { postId } }),
    db.models.Post.count({ where: { type: 'REPOST', originalPostId: postId } })
  ]);
  return { likes, comments, reposts };
}

async function meFlags(postId, meId) {
  const liked = await db.models.PostLike.findOne({ where: { postId, userId: meId } });
  const reposted = await db.models.Post.findOne({ where: { type: 'REPOST', originalPostId: postId, authorId: meId } });
  return { meLiked: !!liked, meReposted: !!reposted };
}

export async function createPost(req, res, next) {
  try {
    const payload = createPostSchema.parse(req.body);

    // optional bet attach validation: must be your bet (owner of session)
    if (payload.attachedBetId) {
      const bet = await db.models.Bet.findByPk(payload.attachedBetId, {
        include: [{ model: db.models.BankSession, as: 'Session' }]
      });
      if (!bet) return res.status(404).json({ message: 'Bet not found' });
      if (bet.Session.userId !== req.user.id) return res.status(403).json({ message: 'Cannot attach чужую ставку' });
    }

    const post = await db.models.Post.create({
      authorId: req.user.id,
      type: 'POST',
      text: payload.text,
      imageUrl: payload.imageUrl ?? null,
      attachedBetId: payload.attachedBetId ?? null,
      originalPostId: null
    });

    const full = await db.models.Post.findByPk(post.id, {
      include: [
        { model: db.models.User, as: 'Author', attributes: ['id', 'publicId', 'username', 'avatarUrl', 'lastSeenAt'] },
        { model: db.models.Bet, as: 'AttachedBet' },
        { model: db.models.Post, as: 'OriginalPost' }
      ]
    });

    res.status(201).json({ post: full });
  } catch (e) { next(e); }
}

export async function repostToProfile(req, res, next) {
  try {
    const postId = req.params.id;
    if (!isUuid(postId)) return res.status(400).json({ message: 'Invalid post id' });

    const payload = repostSchema.parse(req.body);

    const original = await db.models.Post.findByPk(postId);
    if (!original) return res.status(404).json({ message: 'Post not found' });

    // blocked check between me and original author
    const blocked = await isBlockedEitherWay(req.user.id, original.authorId);
    if (blocked) return res.status(403).json({ message: 'Forbidden' });

    // prevent duplicate repost by same user
    const exists = await db.models.Post.findOne({
      where: { type: 'REPOST', originalPostId: original.id, authorId: req.user.id }
    });
    if (exists) return res.status(409).json({ message: 'Already reposted' });

    const repost = await db.models.Post.create({
      authorId: req.user.id,
      type: 'REPOST',
      originalPostId: original.id,
      text: payload.text || '',
      imageUrl: null,
      attachedBetId: null
    });
    // создание уведомления
      await createAndEmitNotification(req, {
          userId: original.authorId,
          actorId: req.user.id,
          type: 'REPOST_POST',
          entityId: original.id
      });

    const full = await db.models.Post.findByPk(repost.id, {
      include: [
        { model: db.models.User, as: 'Author', attributes: ['id', 'publicId', 'username', 'avatarUrl', 'lastSeenAt'] },
        {
          model: db.models.Post,
          as: 'OriginalPost',
          include: [
            { model: db.models.User, as: 'Author', attributes: ['id', 'publicId', 'username', 'avatarUrl', 'lastSeenAt'] },
            { model: db.models.Bet, as: 'AttachedBet' }
          ]
        }
      ]
    });

    res.status(201).json({ post: full });
  } catch (e) { next(e); }
}

export async function feed(req, res, next) {
  try {
    const scope = String(req.query.scope || 'all'); // all | following
    const limit = Math.max(1, Math.min(50, Number(req.query.limit || 10)));
    const offset = Math.max(0, Number(req.query.offset || 0));

    let where = {};
    if (scope === 'following') {
      const followRows = await db.models.Follow.findAll({
        where: { followerId: req.user.id },
        attributes: ['followingId']
      });
      const ids = followRows.map(x => x.followingId);
      // показываем посты тех, на кого подписан, и свои
      where.authorId = { [db.Sequelize.Op.in]: Array.from(new Set([req.user.id, ...ids])) };
    }

    const posts = await db.models.Post.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      include: [
        { model: db.models.User, as: 'Author', attributes: ['id', 'publicId', 'username', 'avatarUrl', 'lastSeenAt'] },
        { model: db.models.Bet, as: 'AttachedBet' },
        {
          model: db.models.Post,
          as: 'OriginalPost',
          include: [
            { model: db.models.User, as: 'Author', attributes: ['id', 'publicId', 'username', 'avatarUrl', 'lastSeenAt'] },
            { model: db.models.Bet, as: 'AttachedBet' }
          ]
        }
      ]
    });

    // фильтруем блокировки (на уровне приложения)
    const filtered = [];
    for (const p of posts) {
      const ownerId = p.type === 'REPOST' ? p.OriginalPost?.authorId : p.authorId;
      if (ownerId && await isBlockedEitherWay(req.user.id, ownerId)) continue;
      if (await isBlockedEitherWay(req.user.id, p.authorId)) continue;
      filtered.push(p);
    }

    // считаем counts и my flags
    const items = [];
    for (const p of filtered) {
      const baseId = p.type === 'REPOST' ? p.originalPostId : p.id;
      const counts = await postCounts(baseId);
      const flags = await meFlags(baseId, req.user.id);
      items.push({ post: p, counts, ...flags, basePostId: baseId });
    }

    res.json({ items, page: { limit, offset } });
  } catch (e) { next(e); }
}

export async function getPostById(req, res, next) {
  try {
    const id = req.params.id;
    if (!isUuid(id)) return res.status(400).json({ message: 'Invalid post id' });

    const post = await db.models.Post.findByPk(id, {
      include: [
        { model: db.models.User, as: 'Author', attributes: ['id', 'publicId', 'username', 'avatarUrl', 'lastSeenAt'] },
        { model: db.models.Bet, as: 'AttachedBet' },
        {
          model: db.models.Post,
          as: 'OriginalPost',
          include: [
            { model: db.models.User, as: 'Author', attributes: ['id', 'publicId', 'username', 'avatarUrl', 'lastSeenAt'] },
            { model: db.models.Bet, as: 'AttachedBet' }
          ]
        }
      ]
    });
    if (!post) return res.status(404).json({ message: 'Post not found' });

    const baseId = post.type === 'REPOST' ? post.originalPostId : post.id;

    const blockedOwner = post.type === 'REPOST'
      ? await isBlockedEitherWay(req.user.id, post.OriginalPost?.authorId)
      : await isBlockedEitherWay(req.user.id, post.authorId);

    if (blockedOwner) return res.status(404).json({ message: 'Post not found' });

    const [counts, flags] = await Promise.all([postCounts(baseId), meFlags(baseId, req.user.id)]);

    res.json({ post, basePostId: baseId, counts, ...flags });
  } catch (e) { next(e); }
}

export async function likePost(req, res, next) {
  try {
    const id = req.params.id;
    if (!isUuid(id)) return res.status(400).json({ message: 'Invalid post id' });

    const post = await db.models.Post.findByPk(id, { include: [{ model: db.models.Post, as: 'OriginalPost' }] });
    if (!post) return res.status(404).json({ message: 'Post not found' });

    const baseId = post.type === 'REPOST' ? post.originalPostId : post.id;
    const basePost = post.type === 'REPOST' ? post.OriginalPost : post;

    const blocked = await isBlockedEitherWay(req.user.id, basePost.authorId);
    if (blocked) return res.status(403).json({ message: 'Forbidden' });

    await db.models.PostLike.findOrCreate({
      where: { userId: req.user.id, postId: baseId },
      defaults: { userId: req.user.id, postId: baseId }
    });

    // создание уведомления
      await createAndEmitNotification(req, {
          userId: basePost.authorId,
          actorId: req.user.id,
          type: 'LIKE_POST',
          entityId: baseId
      });

    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
}

export async function unlikePost(req, res, next) {
  try {
    const id = req.params.id;
    if (!isUuid(id)) return res.status(400).json({ message: 'Invalid post id' });

    const post = await db.models.Post.findByPk(id);
    if (!post) return res.status(404).json({ message: 'Post not found' });

    const baseId = post.type === 'REPOST' ? post.originalPostId : post.id;

    await db.models.PostLike.destroy({ where: { userId: req.user.id, postId: baseId } });
    res.json({ ok: true });
  } catch (e) { next(e); }
}

export async function addComment(req, res, next) {
  try {
    const id = req.params.id;
    if (!isUuid(id)) return res.status(400).json({ message: 'Invalid post id' });

    const payload = commentSchema.parse(req.body);

    const post = await db.models.Post.findByPk(id, { include: [{ model: db.models.Post, as: 'OriginalPost' }] });
    if (!post) return res.status(404).json({ message: 'Post not found' });

    const baseId = post.type === 'REPOST' ? post.originalPostId : post.id;
    const basePost = post.type === 'REPOST' ? post.OriginalPost : post;

    const blocked = await isBlockedEitherWay(req.user.id, basePost.authorId);
    if (blocked) return res.status(403).json({ message: 'Forbidden' });

    const c = await db.models.PostComment.create({
      postId: baseId,
      authorId: req.user.id,
      body: payload.body
    });

    // создание уведомления
      await createAndEmitNotification(req, {
          userId: basePost.authorId,
          actorId: req.user.id,
          type: 'COMMENT_POST',
          entityId: baseId
      });

    const full = await db.models.PostComment.findByPk(c.id, {
      include: [{ model: db.models.User, as: 'Author', attributes: ['id', 'publicId', 'username', 'avatarUrl', 'lastSeenAt'] }]
    });

    res.status(201).json({ comment: full });
  } catch (e) { next(e); }
}

export async function listComments(req, res, next) {
  try {
    const id = req.params.id;
    if (!isUuid(id)) return res.status(400).json({ message: 'Invalid post id' });

    const limit = Math.max(1, Math.min(50, Number(req.query.limit || 20)));
    const offset = Math.max(0, Number(req.query.offset || 0));

    const post = await db.models.Post.findByPk(id, { include: [{ model: db.models.Post, as: 'OriginalPost' }] });
    if (!post) return res.status(404).json({ message: 'Post not found' });

    const baseId = post.type === 'REPOST' ? post.originalPostId : post.id;

    const comments = await db.models.PostComment.findAll({
      where: { postId: baseId },
      order: [['createdAt', 'ASC']],
      limit,
      offset,
      include: [{ model: db.models.User, as: 'Author', attributes: ['id', 'publicId', 'username', 'avatarUrl', 'lastSeenAt'] }]
    });

    res.json({ comments, page: { limit, offset } });
  } catch (e) { next(e); }
}

export async function searchPosts(req, res, next) {
  try {
    const q = String(req.query.q || '').trim();
    const limit = Math.max(1, Math.min(50, Number(req.query.limit || 10)));
    const offset = Math.max(0, Number(req.query.offset || 0));

    if (q.length < 2) return res.json({ items: [], page: { limit, offset } });

    // Ищем по тексту поста (и репоста-комментария тоже)
    // Примечание: ILIKE %q% на больших данных медленный — позже можно включить pg_trgm.
    const posts = await db.models.Post.findAll({
      where: {
        text: { [db.Sequelize.Op.iLike]: `%${q}%` }
      },
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      include: [
        { model: db.models.User, as: 'Author', attributes: ['id', 'publicId', 'username', 'avatarUrl', 'lastSeenAt'] },
        { model: db.models.Bet, as: 'AttachedBet', required: false },
        {
          model: db.models.Post,
          as: 'OriginalPost',
          required: false,
          include: [
            { model: db.models.User, as: 'Author', attributes: ['id', 'publicId', 'username', 'avatarUrl', 'lastSeenAt'] },
            { model: db.models.Bet, as: 'AttachedBet', required: false }
          ]
        }
      ]
    });

    // фильтруем блокировки (чтобы не светить контент)
    const filtered = [];
    for (const p of posts) {
      // owner контента: если репост — автор оригинала, иначе автор поста
      const ownerId = p.type === 'REPOST' ? p.OriginalPost?.authorId : p.authorId;

      if (ownerId && await isBlockedEitherWay(req.user.id, ownerId)) continue;
      if (await isBlockedEitherWay(req.user.id, p.authorId)) continue;

      filtered.push(p);
    }

    // counts + my flags
    const items = [];
    for (const p of filtered) {
      const baseId = p.type === 'REPOST' ? p.originalPostId : p.id;
      const counts = await postCounts(baseId);
      const flags = await meFlags(baseId, req.user.id);
      items.push({ post: p, counts, ...flags, basePostId: baseId });
    }

    res.json({ items, page: { limit, offset }, q });
  } catch (e) { next(e); }
}

export async function userFeedByPublicId(req, res, next) {
  try {
    const publicId = String(req.params.publicId || '').trim();
    if (!/^[A-Za-z0-9_-]{8,16}$/.test(publicId)) {
      return res.status(400).json({ message: 'Invalid publicId' });
    }

    const filter = String(req.query.filter || 'all'); // all | posts | reposts
    const limit = Math.max(1, Math.min(50, Number(req.query.limit || 10)));
    const offset = Math.max(0, Number(req.query.offset || 0));

    const owner = await db.models.User.findOne({
      where: { publicId },
      attributes: ['id', 'publicId', 'username', 'avatarUrl', 'lastSeenAt'],
      include: [{ model: db.models.PrivacySettings, as: 'Privacy' }]
    });
    if (!owner) return res.status(404).json({ message: 'User not found' });

    // blacklist в обе стороны -> скрываем как "не найден"
    const blocked = await isBlockedEitherWay(req.user.id, owner.id);
    if (blocked) return res.status(404).json({ message: 'User not found' });

    // базовая приватность постов: пока считаем, что посты всегда публичны
    // (если ты захочешь showPosts — добавим в PrivacySettings и проверку тут)

    const where = { authorId: owner.id };
    if (filter === 'posts') where.type = 'POST';
    else if (filter === 'reposts') where.type = 'REPOST';

    const posts = await db.models.Post.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      include: [
        { model: db.models.User, as: 'Author', attributes: ['id', 'publicId', 'username', 'avatarUrl', 'lastSeenAt'] },
        { model: db.models.Bet, as: 'AttachedBet', required: false },
        {
          model: db.models.Post,
          as: 'OriginalPost',
          required: false,
          include: [
            { model: db.models.User, as: 'Author', attributes: ['id', 'publicId', 'username', 'avatarUrl', 'lastSeenAt'] },
            { model: db.models.Bet, as: 'AttachedBet', required: false }
          ]
        }
      ]
    });

    // для репостов: если оригинальный автор заблокирован/блокировал текущего — скрываем репост
    const filtered = [];
    for (const p of posts) {
      if (p.type === 'REPOST' && p.OriginalPost?.authorId) {
        if (await isBlockedEitherWay(req.user.id, p.OriginalPost.authorId)) continue;
      }
      filtered.push(p);
    }

    const items = [];
    for (const p of filtered) {
      const basePostId = p.type === 'REPOST' ? p.originalPostId : p.id;
      const counts = await postCounts(basePostId);
      const flags = await meFlags(basePostId, req.user.id);
      items.push({ post: p, counts, ...flags, basePostId });
    }

    res.json({
      owner: { publicId: owner.publicId, username: owner.username, avatarUrl: owner.avatarUrl },
      items,
      page: { limit, offset },
      filter
    });
  } catch (e) { next(e); }
}


export async function deletePost(req, res, next) {
  const t = await db.sequelize.transaction();
  try {
    const id = String(req.params.id || '');
    if (!isUuid(id)) { await t.rollback(); return res.status(400).json({ message: 'Invalid post id' }); }

    const post = await db.models.Post.findByPk(id, { transaction: t });
    if (!post) { await t.rollback(); return res.status(404).json({ message: 'Post not found' }); }

    if (post.authorId !== req.user.id) { await t.rollback(); return res.status(403).json({ message: 'Forbidden' }); }

    // If base post deleted: clean up likes/comments/reposts and unlink from messages
    if (post.type === 'POST') {
      const reposts = await db.models.Post.findAll({
        where: { type: 'REPOST', originalPostId: post.id },
        attributes: ['id'],
        transaction: t
      });
      const repostIds = reposts.map(r => r.id);

      // unlink shared posts from messages (keep messages)
      await db.models.Message.update(
        { sharedPostId: null },
        { where: { sharedPostId: { [db.Sequelize.Op.in]: [post.id, ...repostIds] } }, transaction: t }
      );

      // notifications that reference the base post (likes/comments/reposts)
      await db.models.Notification.destroy({
        where: {
          entityId: post.id,
          type: { [db.Sequelize.Op.in]: ['LIKE_POST', 'COMMENT_POST', 'REPOST_POST'] }
        },
        transaction: t
      });

      // likes/comments live on base post id
      await db.models.PostLike.destroy({ where: { postId: post.id }, transaction: t });
      await db.models.PostComment.destroy({ where: { postId: post.id }, transaction: t });

      // delete repost rows
      if (repostIds.length) {
        await db.models.Post.destroy({ where: { id: { [db.Sequelize.Op.in]: repostIds } }, transaction: t });
      }

      await post.destroy({ transaction: t });
    } else {
      // deleting repost only
      await db.models.Message.update(
        { sharedPostId: null },
        { where: { sharedPostId: post.id }, transaction: t }
      );
      await post.destroy({ transaction: t });
    }

    await t.commit();
    res.json({ ok: true });
  } catch (e) {
    await t.rollback();
    next(e);
  }
}

export async function deleteComment(req, res, next) {
  try {
    const postId = String(req.params.postId || '');
    const commentId = String(req.params.commentId || '');
    if (!isUuid(postId)) return res.status(400).json({ message: 'Invalid post id' });
    if (!isUuid(commentId)) return res.status(400).json({ message: 'Invalid comment id' });

    const post = await db.models.Post.findByPk(postId, { include: [{ model: db.models.Post, as: 'OriginalPost' }] });
    if (!post) return res.status(404).json({ message: 'Post not found' });

    const baseId = post.type === 'REPOST' ? post.originalPostId : post.id;

    const comment = await db.models.PostComment.findByPk(commentId);
    if (!comment) return res.status(404).json({ message: 'Comment not found' });
    if (comment.postId !== baseId) return res.status(404).json({ message: 'Comment not found' });

    const basePost = post.type === 'REPOST' ? post.OriginalPost : post;

    // Permission: comment author OR post author (owner of base post)
    if (comment.authorId !== req.user.id && basePost.authorId !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    await comment.destroy();
    res.json({ ok: true });
  } catch (e) { next(e); }
}

