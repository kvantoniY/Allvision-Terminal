import { api } from './apiSlice';

function safeNum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function nowIso() {
  return new Date().toISOString();
}

export const terminalApi = api.injectEndpoints({
  endpoints: (build) => ({
    // Sessions
    getSessions: build.query({
      query: (params = {}) => ({
        url: '/terminal/sessions',
        params,
      }),
      providesTags: (result) =>
        result?.items
          ? [
              ...result.items.map((s) => ({ type: 'TerminalSession', id: s.id })),
              { type: 'TerminalSessions', id: 'LIST' },
            ]
          : [{ type: 'TerminalSessions', id: 'LIST' }],
    }),

    createSession: build.mutation({
      query: (body) => ({
        url: '/terminal/sessions',
        method: 'POST',
        body,
      }),
      invalidatesTags: [
        { type: 'TerminalSessions', id: 'LIST' },
        { type: 'TerminalSummary', id: 'ROOT' },
        { type: 'TerminalBets', id: 'LIST' },
        { type: 'TerminalUserBets', id: 'LIST' },
        { type: 'Charts', id: 'ALL' },
      ],
    }),

    getSessionById: build.query({
      query: (id) => `/terminal/sessions/${id}`,
      providesTags: (result, err, id) => [{ type: 'TerminalSession', id }],
    }),

    closeSession: build.mutation({
      query: (id) => ({
        url: `/terminal/sessions/${id}/close`,
        method: 'POST',
      }),
      invalidatesTags: (res, err, id) => [
        { type: 'TerminalSession', id },
        { type: 'TerminalSessions', id: 'LIST' },
        { type: 'TerminalSummary', id: 'ROOT' },
        { type: 'TerminalBets', id: 'LIST' },
        { type: 'Charts', id: 'ALL' },
      ],
    }),

    deleteSession: build.mutation({
      query: (id) => ({
        url: `/terminal/sessions/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: [
        { type: 'TerminalSessions', id: 'LIST' },
        { type: 'TerminalSummary', id: 'ROOT' },
        { type: 'TerminalBets', id: 'LIST' },
        { type: 'Charts', id: 'ALL' },
      ],
    }),

    // Recommendation (pre-calc)
    recommend: build.mutation({
      query: ({ sessionId, ...body }) => ({
        url: `/terminal/sessions/${sessionId}/recommend`,
        method: 'POST',
        body,
      }),
    }),

    // Bets
    createBet: build.mutation({
      query: ({ sessionId, ...body }) => ({
        url: `/terminal/sessions/${sessionId}/bets`,
        method: 'POST',
        body,
      }),
invalidatesTags: (res, err, args) => [
  { type: 'TerminalSession', id: args.sessionId }, 
  { type: 'TerminalSessions', id: 'LIST' },
  { type: 'TerminalSummary', id: 'ROOT' },
  { type: 'TerminalBets', id: 'LIST' },
  { type: 'TerminalUserBets', id: 'LIST' },
  { type: 'Charts', id: 'ALL' },
],
    }),

    settleBet: build.mutation({
      query: ({ betId, result }) => ({
        url: `/terminal/bets/${betId}/settle`,
        method: 'POST',
        body: { result },
      }),


      async onQueryStarted({ betId, result }, { dispatch, getState, queryFulfilled }) {
        const state = getState();
        const apiState = state?.api; 
        const queries = apiState?.queries || {};

        const patches = [];

        for (const key of Object.keys(queries)) {
          const q = queries[key];
          if (!q || q.endpointName !== 'getSessionById') continue;
          const sessionId = q.originalArgs;
          if (!sessionId) continue;

          const patch = dispatch(
            terminalApi.util.updateQueryData('getSessionById', sessionId, (draft) => {
              const session = draft?.session || draft;
              const bets = session?.Bets || session?.bets;
              if (!Array.isArray(bets)) return;

              const bet = bets.find((b) => b.id === betId);
              if (!bet) return;

              if (bet.status === 'WIN' || bet.status === 'LOSE') return;

              bet.status = result;
              bet.settledAt = nowIso();

              const stake = safeNum(bet.stake);
              const odds = safeNum(bet.odds);

              if (stake != null) {
                let p = null;
                if (result === 'LOSE') p = -stake;
                if (result === 'WIN' && odds != null) p = stake * (odds - 1);

                if (p != null) {
                  bet.profit = Math.round(p * 100) / 100;
                  const cur = safeNum(session.currentBank);
                  if (cur != null) session.currentBank = Math.round((cur + p) * 100) / 100;
                }
              }
            })
          );

          patches.push(patch);
        }

        try {
          await queryFulfilled;
        } catch (_) {
          patches.forEach((p) => p.undo?.());
        }
      },

      invalidatesTags: (res, err, args) => [
        { type: 'TerminalSessions', id: 'LIST' },
        { type: 'TerminalSummary', id: 'ROOT' },
        { type: 'TerminalBets', id: 'LIST' },
        { type: 'TerminalUserBets', id: 'LIST' },
        { type: 'Charts', id: 'ALL' },
      ],
    }),

    deleteBet: build.mutation({
      query: ({ betId }) => ({
        url: `/terminal/bets/${betId}`,
        method: 'DELETE',
      }),
      async onQueryStarted({ betId }, { dispatch, getState, queryFulfilled }) {
        const state = getState();
        const apiState = state?.api;
        const queries = apiState?.queries || {};
        const patches = [];

        for (const key of Object.keys(queries)) {
          const q = queries[key];
          if (!q || q.endpointName !== 'getSessionById') continue;
          const sessionId = q.originalArgs;
          if (!sessionId) continue;

          const patch = dispatch(
            terminalApi.util.updateQueryData('getSessionById', sessionId, (draft) => {
              const session = draft?.session || draft;
              const bets = session?.Bets || session?.bets;
              if (!Array.isArray(bets)) return;

              const idx = bets.findIndex((b) => b.id === betId);
              if (idx === -1) return;
              bets.splice(idx, 1);
            })
          );

          patches.push(patch);
        }

        try {
          await queryFulfilled;
        } catch (_) {
          patches.forEach((p) => p.undo?.());
        }
      },
      invalidatesTags: [
        { type: 'TerminalSessions', id: 'LIST' },
        { type: 'TerminalSummary', id: 'ROOT' },
        { type: 'TerminalBets', id: 'LIST' },
        { type: 'TerminalUserBets', id: 'LIST' },
        { type: 'Charts', id: 'ALL' },
      ],
    }),

    // Unified bets list + summary
    getBets: build.query({
      query: (params = {}) => ({
        url: '/terminal/bets',
        params,
      }),
      providesTags: [{ type: 'TerminalBets', id: 'LIST' }],
    }),

    // Bets of a user by publicId 
    getUserBets: build.query({
      query: ({ publicId, params = {} }) => ({
        url: `/terminal/bets/user/u/${publicId}`,
        params,
      }),
      providesTags: (result, err, args) => {
        const pid = args?.publicId || 'UNKNOWN';
        return [
          { type: 'TerminalUserBets', id: 'LIST' },
          { type: 'TerminalUserBets', id: pid },
        ];
      },
    }),

    getSummary: build.query({
      query: (params = {}) => ({
        url: '/terminal/summary',
        params,
      }),
      providesTags: [{ type: 'TerminalSummary', id: 'ROOT' }],
    }),

    // Charts
    getEquityChart: build.query({
      query: (params = {}) => ({
        url: '/charts/equity',
        params,
      }),
      providesTags: [{ type: 'Charts', id: 'ALL' }],
    }),
    getProfitChart: build.query({
      query: (params = {}) => ({
        url: '/charts/profit',
        params,
      }),
      providesTags: [{ type: 'Charts', id: 'ALL' }],
    }),
    getDrawdownChart: build.query({
      query: (params = {}) => ({
        url: '/charts/drawdown',
        params,
      }),
      providesTags: [{ type: 'Charts', id: 'ALL' }],
    }),
    getStakeDeviationChart: build.query({
      query: (params = {}) => ({
        url: '/charts/stake-deviation',
        params,
      }),
      providesTags: [{ type: 'Charts', id: 'ALL' }],
    }),
  }),
});

export const {
  useGetSessionsQuery,
  useCreateSessionMutation,
  useGetSessionByIdQuery,
  useCloseSessionMutation,
  useDeleteSessionMutation,
  useRecommendMutation,
  useCreateBetMutation,
  useSettleBetMutation,
  useDeleteBetMutation,
  useGetBetsQuery,
  useGetUserBetsQuery,
  useGetSummaryQuery,
  useGetEquityChartQuery,
  useGetProfitChartQuery,
  useGetDrawdownChartQuery,
  useGetStakeDeviationChartQuery,
} = terminalApi;
