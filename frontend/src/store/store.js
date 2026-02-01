import { configureStore } from '@reduxjs/toolkit';
import { api } from '@/shared/lib/api/apiSlice';
import authReducer from '@/shared/lib/auth/authSlice';

export const store = configureStore({
  reducer: {
    [api.reducerPath]: api.reducer,
    auth: authReducer,
  },
  middleware: (gDM) => gDM().concat(api.middleware),
});
