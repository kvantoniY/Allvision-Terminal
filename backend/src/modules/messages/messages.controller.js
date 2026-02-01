import { z } from 'zod';
import { db } from '../../db/index.js';
import { createAndEmitNotification } from '../notifications/notify.js';

const sendSchema = z.object({
  toPublicId: z.string().min(8).max(16),
  text: z.string().max(5000).nullable().optional(),
  sharedPostId: z.string().uuid().nullable().optional()
}).refine((v) => (v.text && v.text.trim().length > 0) || v.sharedPostId, {
  message: 'Either text or sharedPostId is required'
})

const editSchema = z.object({
  text: z.string().max(5000).nullable().optional()
}).refine((v) => v.text === null || typeof v.text === 'string', {
  message: 'Invalid text'
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

async function canMessage(fromId, toUser) {
  // privacy allowMessages: ALL | FOLLOWERS | MUTUAL | NONE
  const privacy = await db.models.PrivacySettings.findOne({ where: { userId: toUser.id } });
  const allow = privacy?.allowMessages ?? 'ALL';

  if (allow === 'NONE') return false;
  if (allow === 'ALL') return true;

  const isFollower = await db.models.Follow.findOne({ where: { followerId: fromId, followingId: toUser.id } });
  if (allow === 'FOLLOWERS') return !!isFollower;

  if (allow === 'MUTUAL') {
    const back = await db.models.Follow.findOne({ where: { followerId: toUser.id, followingId: fromId } });
    return !!isFollower && !!back;
  }

  return false;
}

async function findOrCreateDialog(userA, userB, t) {
  // Ищем существующий диалог через dialog_members intersection
  const a = await db.models.DialogMember.findAll({ where: { userId: userA }, transaction: t });
  if (a.length) {
    const dialogIds = a.map(x => x.dialogId);
    const b = await db.models.DialogMember.findOne({
      where: { userId: userB, dialogId: { [db.Sequelize.Op.in]: dialogIds } },
      transaction: t
    });
    if (b) return b.dialogId;
  }

  const dialog = await db.models.Dialog.create({}, { transaction: t });
  await db.models.DialogMember.bulkCreate([
    { dialogId: dialog.id, userId: userA, unreadCount: 0, lastReadAt: new Date() },
    { dialogId: dialog.id, userId: userB, unreadCount: 0, lastReadAt: new Date() }
  ], { transaction: t });

  return dialog.id;
}

export async function sendMessage(req, res, next) {
  const t = await db.sequelize.transaction();
  try {
    const payload = sendSchema.parse(req.body);

    const to = await db.models.User.findOne({
      where: { publicId: payload.toPublicId },
      attributes: ['id', 'publicId', 'username', 'avatarUrl', 'lastSeenAt']
    });
    if (!to) { await t.rollback(); return res.status(404).json({ message: 'User not found' }); }
    if (to.id === req.user.id) { await t.rollback(); return res.status(409).json({ message: 'Cannot message yourself' }); }

    const blocked = await isBlockedEitherWay(req.user.id, to.id);
    if (blocked) { await t.rollback(); return res.status(403).json({ message: 'Forbidden' }); }

    const allowed = await canMessage(req.user.id, to);
    if (!allowed) { await t.rollback(); return res.status(403).json({ message: 'Messages are not allowed by user privacy settings' }); }

    if (payload.sharedPostId) {
      const existsPost = await db.models.Post.findByPk(payload.sharedPostId);
      if (!existsPost) { await t.rollback(); return res.status(404).json({ message: 'Shared post not found' }); }
    }

    const dialogId = await findOrCreateDialog(req.user.id, to.id, t);

    const msg = await db.models.Message.create({
      dialogId,
      senderId: req.user.id,
      text: payload.text?.trim() || null,
      sharedPostId: payload.sharedPostId ?? null
    }, { transaction: t });

    // unread++ for receiver
    await db.models.DialogMember.update(
      { unreadCount: db.sequelize.literal('"unread_count" + 1') },
      { where: { dialogId, userId: to.id }, transaction: t }
    );

    await t.commit();

    const full = await db.models.Message.findByPk(msg.id, {
      include: [
        { model: db.models.User, as: 'Sender', attributes: ['id', 'publicId', 'username', 'avatarUrl', 'lastSeenAt'] },
        { model: db.models.Post, as: 'SharedPost', required: false }
      ]
    });
      await createAndEmitNotification(req, {
          userId: to.id,
          actorId: req.user.id,
          type: 'MESSAGE',
          entityId: full.id 
      });


    // realtime
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${to.id}`).emit('message:new', { message: full });
      io.to(`user:${req.user.id}`).emit('message:new', { message: full });
      io.to(`user:${to.id}`).emit('dialog:update', { dialogId });
      io.to(`user:${req.user.id}`).emit('dialog:update', { dialogId });
    }

    res.status(201).json({ dialogId, message: full });
  } catch (e) {
    await t.rollback();
    next(e);
  }
}

export async function listDialogs(req, res, next) {
  try {
    // список диалогов пользователя
    const memberships = await db.models.DialogMember.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']]
    });

    const dialogIds = memberships.map(m => m.dialogId);
    if (!dialogIds.length) return res.json({ dialogs: [] });

    // подтягиваем участников и последнее сообщение
    const dialogs = [];
    for (const m of memberships) {
      const members = await db.models.DialogMember.findAll({ where: { dialogId: m.dialogId } });
      const otherId = members.find(x => x.userId !== req.user.id)?.userId;

      const other = otherId
        ? await db.models.User.findByPk(otherId, { attributes: ['id', 'publicId', 'username', 'avatarUrl', 'lastSeenAt'] })
        : null;

      const last = await db.models.Message.findOne({
        where: { dialogId: m.dialogId },
        order: [['createdAt', 'DESC']],
        include: [{ model: db.models.User, as: 'Sender', attributes: ['id', 'publicId', 'username', 'avatarUrl', 'lastSeenAt'] }]
      });

      dialogs.push({
        dialogId: m.dialogId,
        peer: other,
        lastMessage: last,
        unreadCount: m.unreadCount
      });
    }

    res.json({ dialogs });
  } catch (e) { next(e); }
}

export async function getDialog(req, res, next) {
  try {
    const id = req.params.id;
    if (!isUuid(id)) return res.status(400).json({ message: 'Invalid dialog id' });

    const meMember = await db.models.DialogMember.findOne({ where: { dialogId: id, userId: req.user.id } });
    if (!meMember) return res.status(404).json({ message: 'Dialog not found' });

    const members = await db.models.DialogMember.findAll({
      where: { dialogId: id },
      include: [{ model: db.models.User, as: 'User', attributes: ['id', 'publicId', 'username', 'avatarUrl', 'lastSeenAt'] }]
    });

    res.json({ dialogId: id, members });
  } catch (e) { next(e); }
}

export async function listMessages(req, res, next) {
  try {
    const id = req.params.id;
    if (!isUuid(id)) return res.status(400).json({ message: 'Invalid dialog id' });

    const meMember = await db.models.DialogMember.findOne({ where: { dialogId: id, userId: req.user.id } });
    if (!meMember) return res.status(404).json({ message: 'Dialog not found' });

    const limit = Math.max(1, Math.min(100, Number(req.query.limit || 30)));
    const offset = Math.max(0, Number(req.query.offset || 0));

    const messages = await db.models.Message.findAll({
      where: { dialogId: id },
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      include: [
        { model: db.models.User, as: 'Sender', attributes: ['id', 'publicId', 'username', 'avatarUrl', 'lastSeenAt'] },
        { model: db.models.Post, as: 'SharedPost', required: false }
      ]
    });

    res.json({ messages, page: { limit, offset } });
  } catch (e) { next(e); }
}

export async function markRead(req, res, next) {
  try {
    const id = req.params.id;
    if (!isUuid(id)) return res.status(400).json({ message: 'Invalid dialog id' });

    const meMember = await db.models.DialogMember.findOne({ where: { dialogId: id, userId: req.user.id } });
    if (!meMember) return res.status(404).json({ message: 'Dialog not found' });

    const now = new Date();
    await meMember.update({ unreadCount: 0, lastReadAt: now });

    // Realtime: notify both participants so sender can update read receipts without reload
    const io = req.app?.get?.('io');
    if (io) {
      try {
        const members = await db.models.DialogMember.findAll({ where: { dialogId: id } });
        const userIds = members.map((m) => m.userId).filter(Boolean);
        for (const uid of userIds) {
          io.to(`user:${uid}`).emit('dialog:update', { dialogId: id });
          io.to(`user:${uid}`).emit('message:read', {
            dialogId: id,
            userId: req.user.id,
            lastReadAt: now.toISOString(),
          });
        }
      } catch (_) {
        // ignore realtime failures
      }
    }

    res.json({ ok: true, lastReadAt: now.toISOString() });
  } catch (e) { next(e); }
}


export async function editMessage(req, res, next) {
  const t = await db.sequelize.transaction();
  try {
    const id = String(req.params.id || '');
    if (!isUuid(id)) { await t.rollback(); return res.status(400).json({ message: 'Invalid message id' }); }

    const patch = editSchema.parse(req.body);

    const msg = await db.models.Message.findByPk(id, { transaction: t });
    if (!msg) { await t.rollback(); return res.status(404).json({ message: 'Message not found' }); }

    // only sender can edit
    if (msg.senderId !== req.user.id) { await t.rollback(); return res.status(403).json({ message: 'Forbidden' }); }

    // check membership
    const meMember = await db.models.DialogMember.findOne({ where: { dialogId: msg.dialogId, userId: req.user.id }, transaction: t });
    if (!meMember) { await t.rollback(); return res.status(404).json({ message: 'Dialog not found' }); }

    const newText = patch.text === undefined ? msg.text : (patch.text?.trim() || null);

    // if no shared post, cannot make message empty
    if (!msg.sharedPostId && (!newText || newText.trim().length === 0)) {
      await t.rollback();
      return res.status(400).json({ message: 'Text cannot be empty' });
    }

    await msg.update({ text: newText }, { transaction: t });
    await t.commit();

    const full = await db.models.Message.findByPk(msg.id, {
      include: [
        { model: db.models.User, as: 'Sender', attributes: ['id', 'publicId', 'username', 'avatarUrl', 'lastSeenAt'] },
        { model: db.models.Post, as: 'SharedPost', required: false }
      ]
    });

    // realtime
    const io = req.app.get('io');
    if (io) {
      // emit to all members of dialog
      const members = await db.models.DialogMember.findAll({ where: { dialogId: msg.dialogId }, attributes: ['userId'] });
      for (const m of members) {
        io.to(`user:${m.userId}`).emit('message:edit', { message: full });
      }
    }

    res.json({ message: full });
  } catch (e) {
    await t.rollback();
    next(e);
  }
}

export async function deleteMessage(req, res, next) {
  const t = await db.sequelize.transaction();
  try {
    const id = String(req.params.id || '');
    if (!isUuid(id)) { await t.rollback(); return res.status(400).json({ message: 'Invalid message id' }); }

    const msg = await db.models.Message.findByPk(id, { transaction: t });
    if (!msg) { await t.rollback(); return res.status(404).json({ message: 'Message not found' }); }

    // only sender can delete (safe default)
    if (msg.senderId !== req.user.id) { await t.rollback(); return res.status(403).json({ message: 'Forbidden' }); }

    // membership check
    const meMember = await db.models.DialogMember.findOne({ where: { dialogId: msg.dialogId, userId: req.user.id }, transaction: t });
    if (!meMember) { await t.rollback(); return res.status(404).json({ message: 'Dialog not found' }); }

    // adjust unreadCount for other members if this message was unread for them
    const members = await db.models.DialogMember.findAll({ where: { dialogId: msg.dialogId }, transaction: t });
    for (const m of members) {
      if (m.userId === msg.senderId) continue;
      const lastRead = m.lastReadAt;
      const isUnreadForMember = !lastRead || new Date(lastRead).getTime() < new Date(msg.createdAt).getTime();
      if (isUnreadForMember && m.unreadCount > 0) {
        await m.update({ unreadCount: m.unreadCount - 1 }, { transaction: t });
      }
    }

    await db.models.Notification.destroy({
      where: { type: 'MESSAGE', entityId: msg.id },
      transaction: t
    });

    await msg.destroy({ transaction: t });
    await t.commit();

    const io = req.app.get('io');
    if (io) {
      for (const m of members) {
        io.to(`user:${m.userId}`).emit('message:delete', { messageId: id, dialogId: msg.dialogId });
        io.to(`user:${m.userId}`).emit('dialog:update', { dialogId: msg.dialogId });
      }
    }

    res.json({ ok: true });
  } catch (e) {
    await t.rollback();
    next(e);
  }
}

export async function deleteDialog(req, res, next) {
  const t = await db.sequelize.transaction();
  try {
    const id = String(req.params.id || '');
    if (!isUuid(id)) { await t.rollback(); return res.status(400).json({ message: 'Invalid dialog id' }); }

    const meMember = await db.models.DialogMember.findOne({ where: { dialogId: id, userId: req.user.id }, transaction: t });
    if (!meMember) { await t.rollback(); return res.status(404).json({ message: 'Dialog not found' }); }

    const members = await db.models.DialogMember.findAll({ where: { dialogId: id }, attributes: ['userId'], transaction: t });

    // delete notifications about messages in this dialog
    const messageIds = (await db.models.Message.findAll({ where: { dialogId: id }, attributes: ['id'], transaction: t })).map(x => x.id);
    if (messageIds.length) {
      await db.models.Notification.destroy({
        where: { type: 'MESSAGE', entityId: { [db.Sequelize.Op.in]: messageIds } },
        transaction: t
      });
    }

    await db.models.Message.destroy({ where: { dialogId: id }, transaction: t });
    await db.models.DialogMember.destroy({ where: { dialogId: id }, transaction: t });
    await db.models.Dialog.destroy({ where: { id }, transaction: t });

    await t.commit();

    const io = req.app.get('io');
    if (io) {
      for (const m of members) {
        io.to(`user:${m.userId}`).emit('dialog:delete', { dialogId: id });
      }
    }

    res.json({ ok: true });
  } catch (e) {
    await t.rollback();
    next(e);
  }
}

