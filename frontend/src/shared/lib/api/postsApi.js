import { api } from './apiSlice';

export const postsApi = api.injectEndpoints({
  endpoints: (build) => ({
    feed: build.query({
      query: ({ scope = 'all', limit = 10, offset = 0 } = {}) => ({
        url: `/posts/feed?scope=${encodeURIComponent(scope)}&limit=${limit}&offset=${offset}`,
      }),
      providesTags: ['Posts'],
    }),
  }),
});

export const { useFeedQuery } = postsApi;
