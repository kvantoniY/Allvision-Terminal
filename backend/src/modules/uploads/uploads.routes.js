import { Router } from 'express';
import { authRequired } from '../../middlewares/auth.js';
import { uploadImage } from './upload.middleware.js';
import { uploadSingleImage } from './uploads.controller.js';

export const uploadsRouter = Router();
uploadsRouter.use(authRequired);

uploadsRouter.post('/image', uploadImage.single('file'), uploadSingleImage);
