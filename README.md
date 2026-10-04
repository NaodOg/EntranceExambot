# MatricPrep

Telegram Mini App + bot + admin panel for Ethiopian matric exam preparation.

## Stack

- **Next.js** on Vercel (`/app` Mini App, `/admin` panel, bot webhook)
- **Convex** database + file storage
- **grammY** Telegram bot

## Quick start

### 1. Install

```bash
npm install
```

### 2. Convex

```bash
npx convex dev
```

Copy the printed `NEXT_PUBLIC_CONVEX_URL` into `apps/web/.env.local`.

### 3. Environment

```bash
cp .env.example apps/web/.env.local
```

Edit `apps/web/.env.local`:

- `NEXT_PUBLIC_CONVEX_URL`
- `ADMIN_PASSWORD`
- `TELEGRAM_BOT_TOKEN` (when bot is registered)
- `NEXT_PUBLIC_MINI_APP_URL`

### 4. Run web app

```bash
npm run dev
```

Open:

- http://localhost:3000 — dev hub
- http://localhost:3000/app — Mini App
- http://localhost:3000/admin — admin panel

### 5. Telegram bot webhook (after deploy or ngrok)

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=<YOUR_URL>/api/telegram/webhook"
```

Set BotFather menu button URL to `NEXT_PUBLIC_MINI_APP_URL`.

## Project structure

```
apps/web/          Next.js app
convex/            Convex schema + functions
plan.md            Product plan
```

## Pro tier

Students pay **200 ETB**, upload proof in `/app/pro`, admin approves in `/admin/premium`.
Pro lasts until `examSeasonEndAt` (~6 months / exam season end).
