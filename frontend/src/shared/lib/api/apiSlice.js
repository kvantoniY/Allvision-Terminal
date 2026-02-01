import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { API_BASE_URL } from './baseUrl';
import { getToken, clearToken } from '@/shared/lib/auth/authCookie';
import { clearAuth } from '@/shared/lib/auth/authSlice';

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  prepareHeaders: (headers) => {
    const token = getToken();
    if (token) headers.set('authorization', `Bearer ${token}`);
    return headers;
  },
});

const baseQuery = async (args, api, extraOptions) => {
  const result = await rawBaseQuery(args, api, extraOptions);

  if (result?.error?.status === 401) {
    clearToken();
    api.dispatch(clearAuth());
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }

  return result;
};

export const api = createApi({
  reducerPath: 'api',
  baseQuery,
  tagTypes: [
    // auth / user
    'Me',

    // social / profile / posts
    'Profile',
    'Feed',
    'Posts',
    'PostComments',
    'Blacklist',

    // messages / notifications
    'Dialogs',
    'Messages',
    'Notifications',

    // terminal
    'TerminalSession',
    'TerminalSessions',
    'TerminalSummary',
    'TerminalBets',
    'TerminalUserBets',

    // charts
    'Charts',

    // stats
    'UserStats',
  ],
  endpoints: () => ({}),
});
