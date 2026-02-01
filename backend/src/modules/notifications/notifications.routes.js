import { Router } from 'express';
import { authRequired } from '../../middlewares/auth.js';
import { listNotifications, markRead, markAllRead, unreadCount } from './notifications.controller.js';

export const notificationsRouter = Router();
notificationsRouter.use(authRequired);

notificationsRouter.get('/unread-count', unreadCount);
notificationsRouter.get('/', listNotifications);
notificationsRouter.post('/:id/read', markRead);
notificationsRouter.post('/read-all', markAllRead);
