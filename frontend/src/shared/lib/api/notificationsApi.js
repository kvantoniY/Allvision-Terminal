import { api } from './apiSlice';

export const notificationsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getUnreadCount: build.query({
      query: () => '/notifications/unread-count',
      providesTags: [{ type: 'Notifications', id: 'UNREAD' }],
      keepUnusedDataFor: 30,
    }),

    getNotifications: build.query({
      query: ({ limit = 20, offset = 0 } = {}) => ({
        url: '/notifications',
        params: { limit, offset },
      }),
      providesTags: (res) => {
        const items = Array.isArray(res?.notifications) ? res.notifications : [];
        return [
          { type: 'Notifications', id: 'LIST' },
          ...items.map((n) => ({ type: 'Notifications', id: n.id })),
        ];
      },
      keepUnusedDataFor: 60,
    }),

    markNotificationRead: build.mutation({
      query: (id) => ({
        url: `/notifications/${id}/read`,
        method: 'POST',
      }),
      invalidatesTags: (res, err, id) => [
        { type: 'Notifications', id },
        { type: 'Notifications', id: 'UNREAD' },
        { type: 'Notifications', id: 'LIST' },
      ],
    }),

    markAllNotificationsRead: build.mutation({
      query: () => ({
        url: '/notifications/read-all',
        method: 'POST',
      }),
      invalidatesTags: [
        { type: 'Notifications', id: 'UNREAD' },
        { type: 'Notifications', id: 'LIST' },
      ],
    }),
  }),
});

export const {
  useGetUnreadCountQuery,
  useGetNotificationsQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
} = notificationsApi;
