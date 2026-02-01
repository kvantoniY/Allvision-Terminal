import { api } from './apiSlice';

export const uploadsApi = api.injectEndpoints({
  endpoints: (build) => ({
    uploadImage: build.mutation({
      query: (formData) => ({
        url: '/uploads/image',
        method: 'POST',
        body: formData,
      }),
    }),
  }),
});

export const { useUploadImageMutation } = uploadsApi;
