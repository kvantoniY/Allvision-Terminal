# Allvision Terminal — Frontend starter

Starter scaffold for the backend spec you shared.

## Stack
- Next.js (App Router), JavaScript (no TypeScript)
- CSS Modules (responsive layout)
- Redux Toolkit + RTK Query

## Run
```bash
npm i
cp .env.example .env
npm run dev
```

## Auth (token)
By default the app stores the JWT in a cookie named `av_token` and reads it in the browser to set `Authorization: Bearer <token>`.

### More secure option (recommended)
For production, prefer HttpOnly cookies. That requires a small backend change: accept token from cookie when `Authorization` is missing.

## Pages included
- /login, /register
- /feed (stub)
- /terminal (stub)
- /messages (stub)
- /subscriptions (stub)
- /settings (stub)

