import { Router } from 'express';
import { authRequired } from '../../middlewares/auth.js';
import {
  createSession, listSessions, getSession,
  addBetToSession, settleBet, terminalSummary, 
  listBets, closeSession,deleteSession,deleteBet,
  recommendBet,
  listUserBets
} from './terminal.controller.js';

export const terminalRouter = Router();

terminalRouter.use(authRequired);

terminalRouter.get('/summary', terminalSummary);
terminalRouter.post('/sessions', createSession);
terminalRouter.get('/sessions', listSessions);
// Bets of a user (by publicId). Auth required.
terminalRouter.get('/bets/user/u/:publicId', listUserBets);
terminalRouter.delete('/bets/:id', deleteBet);
terminalRouter.delete('/sessions/:id', deleteSession);
terminalRouter.get('/sessions/:id', getSession);
terminalRouter.post('/sessions/:id/recommend', recommendBet);


terminalRouter.get('/bets', listBets);
terminalRouter.post('/sessions/:id/close', closeSession);
terminalRouter.post('/sessions/:id/bets', addBetToSession);
terminalRouter.post('/bets/:id/settle', settleBet);
