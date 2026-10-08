# Family Dhikr

Shared family counter for zikr / recitations. Create a room, share the code, tap +/− together. Counts persist in Supabase and sync live.

## Setup

1. Create a free project at [supabase.com](https://supabase.com)
2. Open **SQL Editor**, paste and run [`supabase/schema.sql`](supabase/schema.sql)
3. Copy **Project URL** and **anon public** key from **Settings → API**
4. Create `.env.local`:

```bash
cp .env.example .env.local
```

Fill in:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

5. Run locally:

```bash
npm install
npm run dev
```

## Deploy (Vercel)

Set the same two env vars in the Vercel project, then deploy.

## How to use

1. Enter your name
2. Create a room (optional goal, default 12,000) or join with a code
3. Everyone taps **+** — the shared count updates for all devices
4. Leave and come back later — the room count is still there
