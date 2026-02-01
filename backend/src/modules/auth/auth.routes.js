import { Router } from 'express';
import { register, login, me } from './auth.controller.js';
import { authRequired } from '../../middlewares/auth.js';

export const authRouter = Router();

authRouter.post('/register', register);
authRouter.post('/login', login);
authRouter.get('/me', authRequired, me);
