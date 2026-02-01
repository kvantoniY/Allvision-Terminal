import { Router } from 'express';
import { authRequired } from '../../middlewares/auth.js';
import { myStats, userStatsByPublicId, terminalSummary } from './stats.controller.js';

export const statsRouter = Router();
statsRouter.use(authRequired);

statsRouter.get('/me', myStats);
statsRouter.get('/user/u/:publicId', userStatsByPublicId);
statsRouter.get('/terminal/summary', terminalSummary);
