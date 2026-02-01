import { api } from './apiSlice';

function patchPostAcrossCaches({ dispatch, getState, basePostId, authorPublicId, patcher }) {
  const state = getState();
  const apiState = state?.api; // reducerPath у base apiSlice
  const queries = apiState?.queries || {};

  const patches = [];

  for (const key of Object.keys(queries)) {
    const q = queries[key];
    if (!q) continue;

    // 1) Любые кэши ленты
    if (q.endpointName === 'getFeed') {
      const args = q.originalArgs;
      patches.push(
        dispatch(
          socialApi.util.updateQueryData('getFeed', args, (draft) => {
            const items = draft?.items;
            if (!Array.isArray(items)) return;
            const it = items.find((x) => (x?.basePostId || x?.post?.id) === basePostId);
            if (!it) return;
            patcher(it);
          })
        )
      );
    }

    // 2) Кэши постов профиля автора
    if (authorPublicId && q.endpointName === 'getUserPosts') {
      const args = q.originalArgs;
      if (!args?.publicId || args.publicId !== authorPublicId) continue;
      patches.push(
        dispatch(
          socialApi.util.updateQueryData('getUserPosts', args, (draft) => {
            const items = draft?.items;
            if (!Array.isArray(items)) return;
            const it = items.find((x) => (x?.basePostId || x?.post?.id) === basePostId);
            if (!it) return;
            patcher(it);
          })
        )
      );
    }

    // 3) Кэши поиска по постам
    if (q.endpointName === 'searchPosts') {
      const args = q.originalArgs;
      patches.push(
        dispatch(
          socialApi.util.updateQueryData('searchPosts', args, (draft) => {
            if (Array.isArray(draft)) {
              const it = draft.find((x) => (x?.basePostId || x?.post?.id) === basePostId);
              if (!it) return;
              patcher(it);
              return;
            }
            const items = draft?.items;
            if (!Array.isArray(items)) return;
            const it = items.find((x) => (x?.basePostId || x?.post?.id) === basePostId);
            if (!it) return;
            patcher(it);
          })
        )
      );
    }
  }

  return patches;
}

function normalizePostArg(arg) {
  if (!arg) return { postId: null, authorPublicId: null };
  if (typeof arg === 'string') return { postId: arg, authorPublicId: null };
  return { postId: arg.postId || null, authorPublicId: arg.authorPublicId || null };
}

function removePostAcrossCaches({ dispatch, getState, postId }) {
  const state = getState();
  const apiState = state?.api;
  const queries = apiState?.queries || {};
  const patches = [];

  for (const key of Object.keys(queries)) {
    const q = queries[key];
    if (!q?.endpointName) continue;

    const removeFromItems = (draft) => {
      const items = Array.isArray(draft?.items) ? draft.items : Array.isArray(draft) ? draft : null;
      if (!Array.isArray(items)) return;
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        const base = it?.basePostId || it?.post?.id;
        const pid = it?.post?.id;
        if (pid === postId || base === postId) items.splice(i, 1);
      }
    };

    if (q.endpointName === 'getFeed') {
      const args = q.originalArgs;
      patches.push(dispatch(socialApi.util.updateQueryData('getFeed', args, removeFromItems)));
    }

    if (q.endpointName === 'getUserPosts') {
      const args = q.originalArgs;
      patches.push(dispatch(socialApi.util.updateQueryData('getUserPosts', args, removeFromItems)));
    }

    if (q.endpointName === 'searchPosts') {
      const args = q.originalArgs;
      patches.push(dispatch(socialApi.util.updateQueryData('searchPosts', args, removeFromItems)));
    }
  }

  return patches;
}

export const socialApi = api.injectEndpoints({
  endpoints: (build) => ({
    // Public user card
    getProfile: build.query({
      query: (publicId) => `/users/u/${publicId}`,
      providesTags: (res, err, publicId) => [{ type: 'Profile', id: publicId }],
    }),

    // Followers / Following

    getFollowers: build.query({
      async queryFn(arg, apiCtx, _extra, baseQuery) {
        const { publicId, params = {} } = arg || {};
        if (!publicId) return { error: { status: 400, data: { message: 'publicId required' } } };

        const first = await baseQuery({ url: `/users/u/${publicId}/followers`, params });
        if (!first?.error) return first;

        // fallback
        const second = await baseQuery({ url: `/profile/u/${publicId}/followers`, params });
        return second;
      },
      providesTags: (res, err, { publicId }) => [{ type: 'Profile', id: publicId }],
    }),

    getFollowing: build.query({
      async queryFn(arg, apiCtx, _extra, baseQuery) {
        const { publicId, params = {} } = arg || {};
        if (!publicId) return { error: { status: 400, data: { message: 'publicId required' } } };

        const first = await baseQuery({ url: `/users/u/${publicId}/following`, params });
        if (!first?.error) return first;

        // fallback
        const second = await baseQuery({ url: `/users/u/${publicId}/following`, params });
        return second;
      },
      providesTags: (res, err, { publicId }) => [{ type: 'Profile', id: publicId }],
    }),

    // Follow / Unfollow
    follow: build.mutation({
      query: (publicId) => ({
        url: `/users/u/${publicId}/follow`,
        method: 'POST',
      }),
      invalidatesTags: (r, e, publicId) => [{ type: 'Profile', id: publicId }],
    }),

    unfollow: build.mutation({
      query: (publicId) => ({
        url: `/users/u/${publicId}/follow`,
        method: 'DELETE',
      }),
      invalidatesTags: (r, e, publicId) => [{ type: 'Profile', id: publicId }],
    }),

    // Blacklist
    blacklistAdd: build.mutation({
      query: (publicId) => ({ url: `/users/u/${publicId}/blacklist`, method: 'POST' }),
      invalidatesTags: (res, err, publicId) => [
        { type: 'Profile', id: publicId },
        { type: 'Blacklist', id: 'ME' },
      ],
    }),

    blacklistRemove: build.mutation({
      query: (publicId) => ({ url: `/users/u/${publicId}/blacklist`, method: 'DELETE' }),
      invalidatesTags: (res, err, publicId) => [
        { type: 'Profile', id: publicId },
        { type: 'Blacklist', id: 'ME' },
      ],
    }),

    getMyBlacklist: build.query({
      query: () => `/users/me/blacklist`,
      providesTags: [{ type: 'Blacklist', id: 'ME' }],
    }),

    // Posts feed
    getFeed: build.query({
      query: (params = {}) => ({ url: '/posts/feed', params }),
      providesTags: [{ type: 'Feed', id: 'ROOT' }],
    }),

    getUserPosts: build.query({
      query: ({ publicId, params = {} }) => ({ url: `/posts/user/u/${publicId}`, params }),
      providesTags: (res, err, { publicId }) => [{ type: 'Posts', id: publicId }],
    }),

    // Create post
    createPost: build.mutation({
      query: (body) => ({ url: '/posts', method: 'POST', body }),
      invalidatesTags: [{ type: 'Feed', id: 'ROOT' }, { type: 'Posts', id: 'ME' }],
    }),

    // Likes
    likePost: build.mutation({
      query: (arg) => {
        const { postId } = normalizePostArg(arg);
        return { url: `/posts/${postId}/like`, method: 'POST' };
      },
      invalidatesTags: (res, err, arg) => {
        const { authorPublicId } = normalizePostArg(arg);
        return [
          { type: 'Feed', id: 'ROOT' },
          ...(authorPublicId ? [{ type: 'Posts', id: authorPublicId }] : []),
        ];
      },
      async onQueryStarted(arg, { dispatch, getState, queryFulfilled }) {
        const { postId, authorPublicId } = normalizePostArg(arg);
        if (!postId) return;

        const patches = patchPostAcrossCaches({
          dispatch,
          getState,
          basePostId: postId,
          authorPublicId,
          patcher: (it) => {
            it.meLiked = true;
            it.counts = it.counts || {};
            const cur = Number(it.counts.likes || 0);
            it.counts.likes = cur + 1;
          },
        });

        try {
          await queryFulfilled;
        } catch (_) {
          patches.forEach((p) => p.undo?.());
        }
      },
    }),

    unlikePost: build.mutation({
      query: (arg) => {
        const { postId } = normalizePostArg(arg);
        return { url: `/posts/${postId}/like`, method: 'DELETE' };
      },
      invalidatesTags: (res, err, arg) => {
        const { authorPublicId } = normalizePostArg(arg);
        return [
          { type: 'Feed', id: 'ROOT' },
          ...(authorPublicId ? [{ type: 'Posts', id: authorPublicId }] : []),
        ];
      },
      async onQueryStarted(arg, { dispatch, getState, queryFulfilled }) {
        const { postId, authorPublicId } = normalizePostArg(arg);
        if (!postId) return;

        const patches = patchPostAcrossCaches({
          dispatch,
          getState,
          basePostId: postId,
          authorPublicId,
          patcher: (it) => {
            it.meLiked = false;
            it.counts = it.counts || {};
            const cur = Number(it.counts.likes || 0);
            it.counts.likes = Math.max(0, cur - 1);
          },
        });

        try {
          await queryFulfilled;
        } catch (_) {
          patches.forEach((p) => p.undo?.());
        }
      },
    }),

    // Comments
    getPostComments: build.query({
      query: ({ postId, params = {} }) => ({ url: `/posts/${postId}/comments`, params }),
      providesTags: (res, err, { postId }) => [{ type: 'PostComments', id: postId }],
    }),

    addComment: build.mutation({
      // arg: { postId, body, authorPublicId? }
      query: ({ postId, body }) => ({
        url: `/posts/${postId}/comments`,
        method: 'POST',
        body: { body },
      }),
      invalidatesTags: (res, err, arg) => {
        const postId = arg?.postId;
        const authorPublicId = arg?.authorPublicId || null;
        return [
          { type: 'Feed', id: 'ROOT' },
          ...(authorPublicId ? [{ type: 'Posts', id: authorPublicId }] : []),
          ...(postId ? [{ type: 'PostComments', id: postId }] : []),
        ];
      },
      async onQueryStarted(arg, { dispatch, getState, queryFulfilled }) {
        const postId = arg?.postId;
        const authorPublicId = arg?.authorPublicId || null;
        if (!postId) return;

        const patches = patchPostAcrossCaches({
          dispatch,
          getState,
          basePostId: postId,
          authorPublicId,
          patcher: (it) => {
            it.counts = it.counts || {};
            const cur = Number(it.counts.comments || 0);
            it.counts.comments = cur + 1;
          },
        });

        try {
          await queryFulfilled;
        } catch (_) {
          patches.forEach((p) => p.undo?.());
        }
      },
    }),

    // Delete comment (only own)
    deleteComment: build.mutation({
      query: ({ postId, commentId }) => ({
        url: `/posts/${postId}/comments/${commentId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (res, err, { postId }) => [
        { type: 'PostComments', id: postId },
        { type: 'Feed', id: 'ROOT' },
      ],
      async onQueryStarted({ postId, commentId, authorPublicId }, { dispatch, getState, queryFulfilled }) {
        const patchComments = dispatch(
          socialApi.util.updateQueryData('getPostComments', { postId, limit: 50, offset: 0 }, (draft) => {
            const items = Array.isArray(draft?.items) ? draft.items : Array.isArray(draft?.comments) ? draft.comments : null;
            if (!Array.isArray(items)) return;
            const idx = items.findIndex((c) => c?.id === commentId);
            if (idx >= 0) items.splice(idx, 1);
          })
        );

        const patches = patchPostAcrossCaches({
          dispatch,
          getState,
          basePostId: postId,
          authorPublicId,
          patcher: (it) => {
            if (it?.counts?.comments !== undefined) {
              it.counts.comments = Math.max(0, Number(it.counts.comments) - 1);
            }
          },
        });

        try {
          await queryFulfilled;
        } catch (_) {
          patchComments?.undo?.();
          patches.forEach((p) => p?.undo?.());
        }
      },
    }),

    // Delete post (own)
    deletePost: build.mutation({
      query: ({ postId }) => ({ url: `/posts/${postId}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Feed', id: 'ROOT' }, { type: 'Posts', id: 'ME' }],
      async onQueryStarted({ postId }, { dispatch, getState, queryFulfilled }) {
        const patches = removePostAcrossCaches({ dispatch, getState, postId });

        try {
          await queryFulfilled;
        } catch (_) {
          patches.forEach((p) => p?.undo?.());
        }
      },
    }),

    // Repost
    repost: build.mutation({
      // arg: { postId, text, authorPublicId? }
      query: ({ postId, text }) => ({ url: `/posts/${postId}/repost`, method: 'POST', body: { text } }),
      invalidatesTags: (res, err, arg) => {
        const authorPublicId = arg?.authorPublicId || null;
        return [
          { type: 'Feed', id: 'ROOT' },
          ...(authorPublicId ? [{ type: 'Posts', id: authorPublicId }] : []),
        ];
      },
      async onQueryStarted(arg, { dispatch, getState, queryFulfilled }) {
        const postId = arg?.postId;
        const authorPublicId = arg?.authorPublicId || null;
        if (!postId) return;

        const patches = patchPostAcrossCaches({
          dispatch,
          getState,
          basePostId: postId,
          authorPublicId,
          patcher: (it) => {
            it.counts = it.counts || {};
            const cur = Number(it.counts.reposts || 0);
            it.counts.reposts = cur + 1;
          },
        });

        try {
          await queryFulfilled;
        } catch (_) {
          patches.forEach((p) => p.undo?.());
        }
      },
    }),

    // Search
    searchUsers: build.query({
      query: ({ q, limit = 10 }) => ({ url: '/users/search', params: { q, limit } }),
    }),

    searchPosts: build.query({
      query: ({ q, limit = 10, offset = 0 }) => ({ url: '/posts/search', params: { q, limit, offset } }),
    }),
  }),
});

export const {
  useGetProfileQuery,
  useGetFollowersQuery,
  useGetFollowingQuery,
  useFollowMutation,
  useUnfollowMutation,
  useBlacklistAddMutation,
  useBlacklistRemoveMutation,
  useGetMyBlacklistQuery,
  useGetFeedQuery,
  useGetUserPostsQuery,
  useCreatePostMutation,
  useLikePostMutation,
  useUnlikePostMutation,
  useGetPostCommentsQuery,
  useAddCommentMutation,
  useDeleteCommentMutation,
  useDeletePostMutation,
  useRepostMutation,
  useSearchUsersQuery,
  useSearchPostsQuery,
} = socialApi;