import { Router } from 'express';
import { searchUsers } from './users.controller.js';
import { authRequired } from '../../middlewares/auth.js';
import {
  getMyProfile,
  updateMyProfile,
  updateMyPrivacy,
  getMyBlacklist,

  getUserByPublicId,

  followByPublicId,
  unfollowByPublicId,

  followersByPublicId,
  followingByPublicId,

  blockByPublicId,
  unblockByPublicId,
  updateMyAvatar
} from './users.controller.js';
import { uploadImage } from '../uploads/upload.middleware.js';

export const usersRouter = Router();

// Me
usersRouter.post('/me/avatar', authRequired, uploadImage.single('file'), updateMyAvatar);
usersRouter.get('/me', authRequired, getMyProfile);
usersRouter.patch('/me', authRequired, updateMyProfile);
usersRouter.patch('/me/privacy', authRequired, updateMyPrivacy);
usersRouter.get('/me/blacklist', authRequired, getMyBlacklist);
usersRouter.get('/search', authRequired, searchUsers);

// PublicId-based routes
usersRouter.get('/u/:publicId', authRequired, getUserByPublicId);

usersRouter.post('/u/:publicId/follow', authRequired, followByPublicId);
usersRouter.delete('/u/:publicId/follow', authRequired, unfollowByPublicId);

usersRouter.get('/u/:publicId/followers', authRequired, followersByPublicId);
usersRouter.get('/u/:publicId/following', authRequired, followingByPublicId);

usersRouter.post('/u/:publicId/blacklist', authRequired, blockByPublicId);
usersRouter.delete('/u/:publicId/blacklist', authRequired, unblockByPublicId);
