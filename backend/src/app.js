import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import morgan from 'morgan';
import { mountSwagger } from './swagger.js';

import { authRouter } from './modules/auth/auth.routes.js';
import { terminalRouter } from './modules/terminal/terminal.routes.js';
import { errorMiddleware } from './middlewares/error.js';
import { usersRouter } from './modules/users/users.routes.js';
import { postsRouter } from './modules/posts/posts.routes.js';
import { messagesRouter } from './modules/messages/messages.routes.js';
import { notificationsRouter } from './modules/notifications/notifications.routes.js';
import { statsRouter } from './modules/stats/stats.routes.js';
import { chartsRouter } from './modules/charts/charts.routes.js';
import { uploadsRouter } from './modules/uploads/uploads.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export function createApp() {
  const app = express();
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
app.use('/public', express.static(path.join(__dirname, '..', 'public')));
  app.use(helmet());
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(morgan('dev'));

  app.get('/health', (_, res) => res.json({ ok: true }));

  app.use('/auth', authRouter);
  app.use('/terminal', terminalRouter);
  app.use('/users', usersRouter);
  app.use('/posts', postsRouter);
  app.use('/messages', messagesRouter);
  app.use('/notifications', notificationsRouter);
  app.use('/stats', statsRouter);
  app.use('/charts', chartsRouter);
  app.use('/uploads', uploadsRouter);

  app.use(errorMiddleware);
  mountSwagger(app);
  return app;
}
