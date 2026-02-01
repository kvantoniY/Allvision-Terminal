import { Router } from 'express';
import { authRequired } from '../../middlewares/auth.js';
import { getProfileByPublicId, profileBetsByPublicId,profileStatsByPublicId } from './profile.controller.js';

export const profileRouter = Router();
profileRouter.use(authRequired);

profileRouter.get('/u/:publicId', getProfileByPublicId);
profileRouter.get('/u/:publicId/bets', profileBetsByPublicId);
profileRouter.get('/u/:publicId/stats', profileStatsByPublicId);