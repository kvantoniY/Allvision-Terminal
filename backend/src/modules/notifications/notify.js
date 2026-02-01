import { db } from '../../db/index.js';

export async function createAndEmitNotification(req, { userId, actorId, type, entityId }) {
  if (!userId || userId === actorId) return null;

  const n = await db.models.Notification.create({
    userId,
    actorId,
    type,
    entityId,
    isRead: false
  });

  const io = req.app.get('io');
  if (io) {
    // 1) само уведомление
    io.to(`user:${userId}`).emit('notification:new', {
      id: n.id,
      type,
      entityId,
      actorId,
      createdAt: n.createdAt
    });

    // 2) обновлённый unread count (точное число)
    const unread = await db.models.Notification.count({ where: { userId, isRead: false } });
    io.to(`user:${userId}`).emit('notification:unread', { unread });
  }

  return n;
}
