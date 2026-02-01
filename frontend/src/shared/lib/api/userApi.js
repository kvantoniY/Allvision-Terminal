import { api } from './apiSlice';

export const userApi = api.injectEndpoints({
  endpoints: (build) => ({
    getMyProfile: build.query({
      query: () => '/users/me',
      providesTags: ['Me'],
    }),

    updateMyProfile: build.mutation({
      query: (body) => ({
        url: '/users/me',
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['Me'],
    }),

    uploadMyAvatar: build.mutation({
      // arg: File
      query: (file) => {
        const form = new FormData();
        form.append('file', file);
        return {
          url: '/users/me/avatar',
          method: 'POST',
          body: form,
        };
      },
      invalidatesTags: ['Me'],
    }),
  }),
});

export const {
  useGetMyProfileQuery,
  useUpdateMyProfileMutation,
  useUploadMyAvatarMutation,
} = userApi;
