import { Router } from 'express';
import { authRequired } from '../../middlewares/auth.js';

import {
  createPost,
  repostToProfile,
  feed,
  getPostById,
  likePost,
  unlikePost,
  addComment,
  listComments,
  searchPosts,
  userFeedByPublicId,
  deletePost,
  deleteComment
} from './posts.controller.js';

export const postsRouter = Router();
postsRouter.use(authRequired);

postsRouter.get('/search', searchPosts);
postsRouter.get('/user/u/:publicId', userFeedByPublicId);


postsRouter.post('/', createPost);
postsRouter.post('/:id/repost', repostToProfile);

postsRouter.get('/feed', feed);
postsRouter.get('/:id', getPostById);

postsRouter.post('/:id/like', likePost);
postsRouter.delete('/:id/like', unlikePost);

postsRouter.post('/:id/comments', addComment);
postsRouter.get('/:id/comments', listComments);

// Delete
postsRouter.delete('/:id', deletePost);
postsRouter.delete('/:postId/comments/:commentId', deleteComment);

