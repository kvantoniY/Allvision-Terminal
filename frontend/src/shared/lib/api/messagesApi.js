import { api } from './apiSlice';

export const messagesApi = api.injectEndpoints({
  endpoints: (build) => ({
    getDialogs: build.query({
      query: () => '/messages/dialogs',
      providesTags: (res) => {
        const items = Array.isArray(res?.items)
          ? res.items
          : Array.isArray(res?.dialogs)
            ? res.dialogs
            : [];
        return [{ type: 'Dialogs', id: 'LIST' }, ...items.map((d) => ({ type: 'Dialogs', id: d?.id || d?.dialogId }))];
      },
    }),

    getDialog: build.query({
      query: (dialogId) => `/messages/dialogs/${dialogId}`,
      transformResponse: (res) => {
        if (res?.dialog) return res.dialog;
        return res;
      },
      providesTags: (res, err, dialogId) => [{ type: 'Dialogs', id: dialogId }],
    }),

    getMessages: build.query({
      query: ({ dialogId, limit = 30, offset = 0 }) => ({
        url: `/messages/dialogs/${dialogId}/messages`,
        params: { limit, offset },
      }),
      transformResponse: (res) => {
        if (Array.isArray(res?.items)) return { items: res.items, page: res.page || { limit: 30, offset: 0 } };
        if (Array.isArray(res?.messages)) return { items: res.messages, page: res.page || { limit: 30, offset: 0 } };
        return { items: [], page: res?.page || { limit: 30, offset: 0 } };
      },
      providesTags: (res, err, args) => [{ type: 'Messages', id: args.dialogId }],
      keepUnusedDataFor: 60,
    }),

    sendMessage: build.mutation({
      query: ({ toPublicId, text = null, sharedPostId = null }) => ({
        url: '/messages/send',
        method: 'POST',
        body: { toPublicId, text, sharedPostId },
      }),
      invalidatesTags: [{ type: 'Dialogs', id: 'LIST' }],
      async onQueryStarted(args, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          const message = data?.message || data;
          const dialogId = data?.dialogId || message?.dialogId;

          if (!dialogId || !message?.id) return;

          dispatch(
            api.util.updateQueryData('getMessages', { dialogId, limit: 30, offset: 0 }, (draft) => {
              const arr = draft?.items;
              if (!Array.isArray(arr)) return;
              const exists = arr.some((m) => m?.id === message.id);
              if (!exists) arr.push(message); 
            })
          );
        } catch (_) {
          // ignore
        }
      },
    }),

    markDialogRead: build.mutation({
      query: (dialogId) => ({ url: `/messages/dialogs/${dialogId}/read`, method: 'POST' }),
      invalidatesTags: (res, err, dialogId) => [
        { type: 'Dialogs', id: dialogId },
        { type: 'Dialogs', id: 'LIST' },
      ],
    }),

    editMessage: build.mutation({
      query: ({ messageId, text }) => ({
        url: `/messages/${messageId}`,
        method: 'PATCH',
        body: { text },
      }),
      invalidatesTags: [{ type: 'Dialogs', id: 'LIST' }],
      async onQueryStarted({ messageId, dialogId, text }, { dispatch, queryFulfilled }) {
        const patch =
          dialogId
            ? dispatch(
                api.util.updateQueryData('getMessages', { dialogId, limit: 30, offset: 0 }, (draft) => {
                  const arr = draft?.items;
                  if (!Array.isArray(arr)) return;
                  const it = arr.find((m) => m?.id === messageId);
                  if (!it) return;
                  it.text = text;
                  it.updatedAt = new Date().toISOString();
                })
              )
            : null;

        try {
          const { data } = await queryFulfilled;
          const msg = data?.message || data;
          const dId = dialogId || msg?.dialogId;
          if (dId && msg?.id) {
            dispatch(
              api.util.updateQueryData('getMessages', { dialogId: dId, limit: 30, offset: 0 }, (draft) => {
                const arr = draft?.items;
                if (!Array.isArray(arr)) return;
                const it = arr.find((m) => m?.id === msg.id);
                if (!it) return;
                Object.assign(it, msg);
              })
            );
            dispatch(
              api.util.invalidateTags([
                { type: 'Messages', id: dId },
                { type: 'Dialogs', id: dId },
              ])
            );
          }
        } catch (e) {
          patch?.undo?.();
        }
      },
    }),

    deleteMessage: build.mutation({
      query: (messageId) => ({ url: `/messages/${messageId}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Dialogs', id: 'LIST' }],
    }),

    deleteDialog: build.mutation({
      query: (dialogId) => ({ url: `/messages/dialogs/${dialogId}`, method: 'DELETE' }),
      invalidatesTags: (res, err, dialogId) => [
        { type: 'Dialogs', id: 'LIST' },
        { type: 'Dialogs', id: dialogId },
        { type: 'Messages', id: dialogId },
      ],
    }),
  }),
});

export const {
  useGetDialogsQuery,
  useGetDialogQuery,
  useGetMessagesQuery,
  useSendMessageMutation,
  useMarkDialogReadMutation,
  useEditMessageMutation,
  useDeleteMessageMutation,
  useDeleteDialogMutation,
} = messagesApi;
