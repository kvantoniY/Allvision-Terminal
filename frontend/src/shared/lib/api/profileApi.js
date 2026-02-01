import { api } from './apiSlice';

export const profileApi = api.injectEndpoints({
  endpoints: (build) => ({
    getProfileBundle: build.query({
      // актуальный bundle: user + privacy + meta + relationship
      query: (publicId) => `/users/u/${publicId}`,
      providesTags: (res, err, publicId) => [
        { type: 'Profile', id: publicId }
      ],
    }),

    // Статистика профиля (respects showStats)
    getUserStats: build.query({
      query: ({ publicId, params = {} }) => ({
        url: `/stats/user/u/${publicId}`,
        params,
      }),
      providesTags: (res, err, { publicId }) => [{ type: 'UserStats', id: publicId }],
    }),
  }),
});

export const {
  useGetProfileBundleQuery,
  useGetUserStatsQuery,
} = profileApi;
