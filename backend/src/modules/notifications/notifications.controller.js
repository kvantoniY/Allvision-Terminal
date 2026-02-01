import { db } from '../../db/index.js';

function isUuid(v) {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export async function listNotifications(req, res, next) {
  try {
    const limit = Math.max(1, Math.min(50, Number(req.query.limit || 20)));
    const offset = Math.max(0, Number(req.query.offset || 0));

    const rows = await db.models.Notification.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      include: [{ model: db.models.User, as: 'Actor', attributes: ['id','publicId','username','avatarUrl'] }]
    });

    res.json({ notifications: rows, page: { limit, offset } });
  } catch (e) { next(e); }
}

export async function markRead(req, res, next) {
  try {
    const id = req.params.id;
    if (!isUuid(id)) return res.status(400).json({ message: 'Invalid id' });

    const row = await db.models.Notification.findOne({ where: { id, userId: req.user.id } });
    if (!row) return res.status(404).json({ message: 'Not found' });

    await row.update({ isRead: true });
      const io = req.app.get('io');
      if (io) {
          const unread = await db.models.Notification.count({ where: { userId: req.user.id, isRead: false } });
          io.to(`user:${req.user.id}`).emit('notification:unread', { unread });
      }
    res.json({ ok: true });
  } catch (e) { next(e); }
}

export async function markAllRead(req, res, next) {
  try {
    await db.models.Notification.update({ isRead: true }, { where: { userId: req.user.id } });
    const io = req.app.get('io');
      if (io) {
          io.to(`user:${req.user.id}`).emit('notification:unread', { unread: 0 });
      }
    res.json({ ok: true });
  } catch (e) { next(e); }
}
export async function unreadCount(req, res, next) {
  try {
    const count = await db.models.Notification.count({
      where: { userId: req.user.id, isRead: false }
    });
    res.json({ unread: count });
  } catch (e) { next(e); }
}
