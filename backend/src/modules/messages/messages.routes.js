import { Router } from 'express';
import { authRequired } from '../../middlewares/auth.js';
import {
  listDialogs,
  getDialog,
  listMessages,
  sendMessage,
  markRead,
  editMessage,
  deleteMessage,
  deleteDialog
} from './messages.controller.js';

export const messagesRouter = Router();
messagesRouter.use(authRequired);

messagesRouter.get('/dialogs', listDialogs);
messagesRouter.get('/dialogs/:id', getDialog);
messagesRouter.get('/dialogs/:id/messages', listMessages);
messagesRouter.post('/send', sendMessage);
messagesRouter.post('/dialogs/:id/read', markRead);

// Edit / delete
messagesRouter.patch('/:id', editMessage);
messagesRouter.delete('/:id', deleteMessage);
messagesRouter.delete('/dialogs/:id', deleteDialog);

