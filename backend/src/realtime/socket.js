import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { db } from '../db/index.js';
import { setOnline, setOffline } from './presence.js';

export function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: true, credentials: true }
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Unauthorized'));
      const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
      socket.user = { id: payload.sub, username: payload.username };
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.user.id}`);

    // Presence: mark online and broadcast to clients
    setOnline(socket.user.id);
    io.emit('presence:update', {
      userId: socket.user.id,
      isOnline: true,
      lastSeenAt: null
    });

    socket.on('disconnect', async () => {
      try {
        setOffline(socket.user.id);

        // persist lastSeenAt
        const now = new Date();
        await db.models.User.update(
          { lastSeenAt: now },
          { where: { id: socket.user.id } }
        );

        io.emit('presence:update', {
          userId: socket.user.id,
          isOnline: false,
          lastSeenAt: now.toISOString()
        });
      } catch {
        // ignore
      }
    });
  });

  return io;
}
