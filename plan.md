# Chat-first Telegram Bot — Implementation Plan

> Review this before any code. Nothing below is implemented yet.
>
> **Goal:** Students can study entirely inside the Telegram chat — slash commands, a persistent menu, and inline buttons. The Mini App stays available as an optional “continue in app” path. Only **duel**, **history/review**, and **theme/appearance** require the Mini App.

---

## 0. Assumptions (please confirm)

| Assumption | Why |
|---|---|
| **“Duel” = 1v1 / group challenge** | You listed it with history and theme as Mini App–only. Duel already has a real-time lobby + timer UI that does not belong in chat. |
| **Bilingual dual-view** (`showBilingual`) is also Mini App–only | Chat shows **one** language from `users.language`. No stacked EN+AM stems in messages. |
| **History** means the attempt list + per-question review screen | Chat may show last score on `/stats` and after a quiz, but not the full review ledger. |
| **Theme** means cabinet theme / accent / font size | Chat onboarding skips appearance and keeps the webapp default (`obsidian` + `azure`). |
| **Pro payment can stay in chat** | Instructions + transaction ref + photo of Telebirr receipt. Webapp `/pro` remains as a fallback. |

If “dual” meant bilingual display instead of 1v1, say so — duel would then become an in-chat flow.

---

## 1. Product principle

**Chat is the product. The Mini App is a richer skin for three screens.**

Today `apps/web/src/lib/bot.ts` is a thin redirector: almost every command sends a `webApp()` button. `/study`, `/mock`, `/daily`, `/streak`, and `/start` never ask a question in chat. Deep links also use `?startapp=quick` while the Mini App reads `mode=quick` on `/app/exam`, so those redirects are currently broken.

After this work:

1. `/start` and the reply keyboard run study, mock, daily, mistakes, stats, leaderboard, settings, and Pro **in chat**.
2. Every finished flow offers a secondary **Open in App** button (never the only path).
3. Duel, history, and theme open the Mini App on purpose, with a short explanation in chat.

---

## 2. What already exists (reuse, do not rebuild)

| Layer | Reuse |
|---|---|
| grammY webhook | `apps/web/src/lib/bot.ts` + `apps/web/src/app/api/telegram/webhook/route.ts` |
| User upsert | `api.users.getOrCreateFromTelegram` |
| Profile | `api.users.getByTelegramId`, `updateProfile`, `updatePreferences` |
| Content | `api.exams.listPublished`, `listExamsByDepartment`, `getExamQuestions` |
| Grading / XP / streak / mistake bank | `api.exams.submitAttempt` (same as the Mini App) |
| Quota | `api.exams.getDailyQuota` — 20 questions/day for free |
| Mistakes | `api.exams.listMistakes`, `getMistakeQuiz` |
| Leaderboard | `api.users.getDepartmentLeaderboard` |
| Daily featured | `api.notifications.getFeaturedDailyQuestion` |
| Pro | `api.premium.submitRequest`, `getMyRequest`, `generateUploadUrl` |
| Settings copy | `api.settings.get` (price, Telebirr instructions, season end) |

Chat attempts must call **the same** `submitAttempt` so XP, streak, quota, and mistake bank stay identical to the Mini App.

---

## 3. Scope

### In chat (must work with buttons, no Mini App required)

- First-run onboarding: language → department (theme skipped)
- Persistent reply keyboard + BotFather `/commands`
- Quick 10 quiz
- Mock exam (question-by-question; quota-capped for free users)
- Daily question (actual MCQ, not a promo link)
- Mistake drill (Pro)
- Stats: XP, streak, quota, department
- Department leaderboard (top 10 text)
- Settings: language, department, instant-feedback toggle
- Pro: price, payment instructions, send photo + optional ref, status
- Cancel / resume an in-progress chat quiz
- Optional “Open in App” on every major screen

### Mini App exclusive (chat only explains + deep-links)

| Feature | Chat behavior | Mini App URL |
|---|---|---|
| **Duel** | `/duel` and `/start duel_CODE` explain the mode and open the lobby/match | `/app/duel`, `/app/duel/{CODE}` |
| **History / review** | After a quiz: score summary + “Review in app”. `/history` is a Mini App button, not a list | `/app/history`, `/app/review?attempt={id}` |
| **Theme / appearance** | `/settings` has “Change theme in app”. Chat onboarding does not ask for theme | `/app/account` |

### Out of this plan

- Blueprint radar, bookmarks UI, referral engine, Telegram Stars
- Fixing Mini App `start_param` routing (separate small bug; only needed for the “Open in App” URLs to land on the right screen — include a one-line fix when wiring those URLs)
- Replacing the existing arcade Mini App

---

## 4. Command & menu catalog

Register with `bot.api.setMyCommands` on first webhook/init (both EN and AM via `setMyCommands` language_code).

| Command | In chat | Mini App button |
|---|---|---|
| `/start` | Upsert user → onboard if needed → main menu + reply keyboard | “Open study app” secondary |
| `/menu` | Re-attach reply keyboard + inline main menu | same |
| `/help` | Full command list (not the current incomplete one) | — |
| `/quiz` | Start Quick 10 in chat (`/study` aliases this) | “Open timed Quick 10” |
| `/mock` | Pick published exam for department, then run in chat | “Open timed mock” |
| `/daily` | Today’s featured MCQ in chat | — |
| `/mistakes` | Count + start a 10-Q drill (Pro gate in chat) | “Open Mistake Vault” |
| `/stats` | XP, streak, quota, dept, last score one-liner | “Open app” |
| `/ranks` | Top 10 for user’s department | “Open Hall of Fame” |
| `/settings` | Language + department buttons | “Theme & bilingual in app” |
| `/pro` | Price, benefits, pay instructions, upload flow | “Upload in app” fallback |
| `/duel` | **Exclusive:** short pitch + WebApp lobby | required |
| `/history` | **Exclusive:** WebApp history | required |
| `/cancel` | Abandon active chat session | — |

Keep `/streak` as an alias of `/stats` (streak highlighted). Deprecate the old “open webapp” bodies of `/study` and `/mock`.

### Persistent reply keyboard (always on after `/start`)

Two rows, localized:

```
⚡ Quiz     📝 Mock     🎯 Daily
📊 Stats    🏆 Ranks    ⚙️ More
```

**More** expands an inline menu: Mistakes · Pro · Settings · Duel (app) · History (app) · Open App.

Reply-keyboard taps arrive as **plain text messages**, not commands. Handlers must match both EN and AM labels.

Do **not** put a WebApp button on the reply keyboard. Telegram reply keyboards cannot open Mini Apps; only inline `web_app` buttons and the BotFather menu button can.

Keep the Telegram **Menu Button** pointing at `NEXT_PUBLIC_MINI_APP_URL` so the header still opens the app. Chat-first does not mean removing that.

---

## 5. User journeys

### 5.1 First `/start` (onboarding in chat)

```
/start
  → create user if missing
  → if !onboardingComplete:
       1. Language: [🇬🇧 English] [🇪🇹 አማርኛ]
       2. Department: published depts as inline buttons (paginate 6 per page)
       3. Save language + department, set onboardingComplete=true
          (theme stays default — no appearance step)
       4. Attach reply keyboard + main menu
  → else: main menu
```

If they already finished onboarding in the Mini App, skip this. If they finish it in chat, the Mini App must not force the 3-step onboarding again (`onboardingComplete` is the same field).

`/start duel_CODE` still **does not** run a duel in chat. After ensuring the user exists, send:

> You’ve been challenged. Duels run in the study app.
> [⚔️ Accept in app]  ← webApp `/app/duel/{CODE}`

### 5.2 Quick 10 (`/quiz` or keyboard Quiz)

1. Require department (if missing, same picker as onboarding).
2. Check quota. If 0 remaining and not Pro: show remaining 0 + Pro CTA, no quiz.
3. Pick the latest published exam for that department. Slice 10 questions (same rule as Mini App `mode=quick`).
4. Create a `chatSessions` row (see §7).
5. Send/edit **one** message: stem + A/B/C/D inline buttons + `⏭ Skip` + `🚪 End`.
6. On tap: grade locally against `correctKey`, edit the message with ✅/❌ + short explanation, then **Next**.
7. After 10 (or End): `submitAttempt` with collected answers → score card in chat:

```
Quick 10 complete
Score 7/10 · +70 XP · streak 4
Free questions left today: 10

[📖 Review in app]  [⚡ Another 10]  [🏠 Menu]
```

Review button is Mini App exclusive (`/app/review?attempt={id}`).

### 5.3 Mock (`/mock`)

Same engine, different length:

- List published exams for the department (year + variant).
- Free users: start anyway but stop at remaining quota (tell them up front: “Free plan: 12 questions left today. Pro unlocks the full paper.”).
- Long papers: one question per edited message, same as Quick 10. Offer `[Open timed mock in app]` at the start, not instead of the chat path.

Do not try to clone the Mini App timer/combo HUD in chat. Chat mock is untimed, instant-feedback by default. Combo XP can still be computed server-side from consecutive corrects if we pass `bonusXp` into `submitAttempt` (optional, phase 2).

### 5.4 Daily (`/daily` and cron push)

Replace the current promo text. Send the featured question as a 1-question session (`mode: "daily"`). Same answer buttons. Counts toward quota and streak via `submitAttempt`.

Update `sendDailyQuestion` / streak alerts in `bot.ts` so cron pushes **answer in chat** (`callback` / “Open chat quiz”) instead of a WebApp-only button. Keep a secondary Open in App link.

`getFeaturedDailyQuestion` currently uses `Date.now()` inside a query (breaks Convex caching). When touching daily, pass `dayOfYear` from the bot/cron instead.

### 5.5 Mistakes (Pro)

- Not Pro: count of unmastered (if we expose it) + Pro pitch + `[Upgrade]`.
- Pro: “12 unmastered in CS” → `[Start drill]` runs `getMistakeQuiz` through the same chat engine (`mode: "mistakes"`).

### 5.6 Stats / ranks / settings

Plain HTML (or MarkdownV2) messages + inline buttons. Settings writes `updatePreferences` immediately. Changing language also swaps the reply keyboard labels.

Theme row:

> Cabinet theme lives in the study app.
> [🎨 Open appearance]

Bilingual toggle is **not** in chat settings (Mini App exclusive with theme). Chat always uses `language`.

### 5.7 Pro in chat

1. `/pro` shows price from `settings.proPriceEtb`, season end, benefit list, payment instructions (`paymentInstructionsEn` / `Am`).
2. `[I’ve paid]` → bot asks for a **photo** of the receipt (and optional text ref).
3. Bot downloads the Telegram file, uploads to Convex storage, calls `premium.submitRequest`.
4. Status: pending / approved / rejected from `getMyRequest`.
5. Fallback: `[Upload in app]` → `/app/pro`.

When admin approves in the existing admin panel, send a chat DM (“Pro is active until …”). That is a small hook in `premium.approve` via `ctx.scheduler` → internal action, or the bot polling — prefer scheduling an internal action that the Next webhook cannot easily do. Simplest path: after admin approve, call Telegram `sendMessage` from a Convex HTTP action **or** keep notify in the Next admin API. Call this out in phase 3; not required for quiz chat.

### 5.8 Duel & history (exclusive)

No in-chat questions, no in-chat attempt list.

- `/duel` → 3–4 lines of rules + `[Open duel lobby]`.
- `/history` → `[Open history]`.
- Quiz results → score only + review deep link.

---

## 6. In-chat quiz engine

### Why not Telegram Quiz Polls

Native `sendPoll(type=quiz)` looks nice but cannot attach explanations, images, bilingual stems, skip/end, or write structured answers into `submitAttempt` cleanly. Use **edited messages + inline keyboard**.

### Session (serverless)

The webhook is a Next.js route: **no in-memory session**. Store progress in Convex.

One active session per user. Starting a new quiz asks to abandon the old one.

### Message UX

- Prefer `editMessageText` on the same message for Q1 → Q2 → … → score.
- If the question has `imageUrl`, `sendPhoto` for that question (edit caption), then return to text for the next.
- Truncate stems that would exceed Telegram’s 4096-char limit; offer “Open in app” if truncated.
- Instant feedback after each tap (matches Mini App default `instantFeedback: true`). If the user turned instant feedback **off** in the Mini App, still show a brief “locked in” state and reveal at the end — cheaper than cloning EXAM mode poorly. Phase 1: always instant in chat.

### Callback data (64-byte hard limit)

Convex IDs are too long. Each session gets a short `token` (8 chars, unique).

```
a:{token}:{key}     answer A/B/C/D
n:{token}           next question
x:{token}           end quiz
p:{page}            department page
d:{slug}            pick department (slug must stay short; if not, map via sortOrder index)
k:en / k:am         language
m:quiz|mock|daily|mistakes|stats|ranks|pro|set|duel|hist|app
```

Router: `callback_data` prefix → handler. Always `answerCallbackQuery` first. Verify `ctx.from.id` owns `token`.

### Concurrency

Ignore taps for a completed session. Debounce double-taps (Telegram retries) by status `answering` → `awaiting_next`.

### Quota

Before start **and** before `submitAttempt`. If they hit the cap mid-mock, stop, submit what they have, show Pro CTA.

---

## 7. Convex changes

### New table `chatSessions`

```ts
chatSessions: defineTable({
  token: v.string(),                 // 8-char, indexed
  telegramId: v.string(),
  userId: v.id("users"),
  mode: v.union(
    v.literal("quick"),
    v.literal("mock"),
    v.literal("daily"),
    v.literal("mistakes"),
  ),
  examId: v.id("exams"),
  departmentSlug: v.string(),
  questionIds: v.array(v.id("questions")),
  currentIndex: v.number(),
  answers: v.array(v.object({
    questionId: v.id("questions"),
    selectedKey: v.string(),
    timeSec: v.number(),
    isCorrect: v.boolean(),
  })),
  status: v.union(
    v.literal("active"),
    v.literal("awaiting_next"),
    v.literal("completed"),
    v.literal("abandoned"),
  ),
  startedAt: v.number(),
  lastQuestionAt: v.number(),
})
  .index("by_token", ["token"])
  .index("by_telegram_active", ["telegramId", "status"])
```

TTL: abandon sessions older than 24h lazily on read, or a later cron. Do not leave unbounded `active` rows.

### New file `convex/chat.ts`

Thin wrappers, validators on args **and** returns:

| Function | Role |
|---|---|
| `getActiveSession` | query by telegramId |
| `startSession` | mutation: pick questions, insert row, return first question **without** other items’ `correctKey` if possible |
| `submitAnswer` | mutation: grade current, append answer, advance index |
| `completeSession` | mutation: call shared grade logic / `submitAttempt`, mark completed |
| `abandonSession` | mutation |
| `getQuestionPayload` | query: one question + options + imageUrl for the bot renderer |

Do **not** return the full exam (100 questions with explanations) to the bot in one query. Fetch the current question only.

`startSession` should reuse existing pickers (`getExamQuestions` slice, `getMistakeQuiz`, featured daily) internally so Mini App and chat cannot drift.

### Small content helper

`getExamQuestions` today returns `correctKey` for every question (the Mini App already uses that client-side). Fine for the HTTP bot. Still prefer `chat.getQuestionPayload` so the webhook never holds 100 stems in one Convex response.

### Daily query fix

Change `getFeaturedDailyQuestion` to take `dayIndex: v.number()` from cron/bot. Stop using `Date.now()` in the query.

---

## 8. Bot code structure

Split the current 250-line `bot.ts` so commands stay readable:

```
apps/web/src/lib/bot/
  index.ts           createBot(), webhookCallback, setMyCommands once
  convex.ts          shared ConvexHttpClient
  copy.ts            EN/AM bot strings (do not overload web copy.ts)
  keyboards.ts       reply keyboard + inline menus + webApp() helpers
  callbacks.ts       prefix router
  onboarding.ts
  quiz.ts            render question, handle answer/next/end
  commands/
    start.ts, help.ts, quiz.ts, mock.ts, daily.ts,
    stats.ts, ranks.ts, settings.ts, pro.ts, duel.ts, history.ts
  notify.ts          sendTelegramMessage, streak, daily (existing)
```

`bot.ts` can re-export `getBot` / `getWebhookHandler` so the webhook route does not change.

Use HTML `parse_mode` (already used in notify helpers). Escape user-generated names.

### WebApp URL helper

One function, correct Mini App routes (this also fixes the current `startapp` mismatch):

```
appHome          → {miniAppUrl}
quick            → {miniAppUrl}/exam?department={slug}&mode=quick
mock             → {miniAppUrl}/exam?department={slug}
mockExam         → {miniAppUrl}/exam?department={slug}&exam={id}
mistakes         → {miniAppUrl}/exam?mode=mistakes&department={slug}
duelLobby        → {miniAppUrl}/duel
duelMatch(code)  → {miniAppUrl}/duel/{code}
history          → {miniAppUrl}/history
review(id)       → {miniAppUrl}/review?attempt={id}
pro              → {miniAppUrl}/pro
account          → {miniAppUrl}/account   // theme
ranks            → {miniAppUrl}/leaderboard
```

Always pass `department` where the Mini App already expects it.

---

## 9. Copy & language

New `apps/web/src/lib/bot/copy.ts`:

- All bot-facing strings in `en` and `am`.
- Resolve language from `users.language` on every handler (user can change it mid-chat).
- Reply keyboard labels come from the same copy table.

Do not import the Mini App arcade copy (`apps/web/src/lib/copy.ts`) — different tone. Chat copy should be short, student-facing, not cabinet jargon.

---

## 10. Implementation phases

Ship in this order so you can review chat quiz before Pro photo upload.

### Phase 1 — Skeleton (no quiz yet)

- File split, `setMyCommands`, reply keyboard, `/help`, `/menu`
- Chat onboarding (language + department)
- `/start` main menu **without** WebApp as the primary CTA
- `/stats`, `/ranks`, `/settings` (lang/dept)
- `/duel` and `/history` as Mini App exclusive screens
- WebApp URL helper with real routes
- Update `/help` to list every command

**Demo:** `/start` → onboard → keyboard works → stats/ranks/settings persist via Convex.

### Phase 2 — Quiz engine (the core)

- `chatSessions` + `convex/chat.ts`
- `/quiz`, `/mock`, `/daily`, `/mistakes` in chat
- Score card + Review-in-app + quota / Pro gates
- `/cancel`
- Cron daily/streak messages answer **in chat**

**Demo:** complete a Quick 10 without opening the Mini App; XP/streak/quota match the webapp.

### Phase 3 — Pro in chat + polish

- `/pro` instructions + photo upload to Convex
- Approval DM (if cheap to add)
- Image questions via `sendPhoto`
- Pagination for many departments
- Session expiry
- Optional combo bonusXp for chat quizzes

---

## 11. Testing plan

Webhook is hard to unit-test; use a mix:

1. **Convex:** `startSession` → `submitAnswer` × N → `completeSession` produces the same XP/streak as a Mini App `submitAttempt` for the same answers.
2. **Local bot:** `grammY` against a test bot + ngrok/Cloudflare tunnel hitting `/api/telegram/webhook`.
3. Manual script (Phase 1–2):
   - New user `/start` → language → department → keyboard appears
   - Quiz 10 → score → `/stats` shows XP
   - Second quiz until free cap → Pro CTA
   - `/settings` switch to Amharic → keyboard labels change
   - `/duel` and `/history` only open Mini App
   - `/quiz` while another session is active → abandon prompt
   - Pro user `/mistakes` drill
   - `/start duel_ABCD` still opens Mini App match
4. Regression: Mini App onboarding, exam, and account still work (shared mutations).

No browser pass is enough for this work — the surface **is** Telegram. If a test bot token is not in env, Phase 2 is not done.

---

## 12. Risks

| Risk | Mitigation |
|---|---|
| Telegram 64-byte callback_data | Short `token` + tiny prefixes only |
| 100-question mock is miserable in chat | Allow it, warn, quota-cap free users, always offer timed Mini App |
| Webhook 10s timeout if we load a full exam | One question per Convex round-trip |
| Double-tap / retry | Session status + ignore stale tokens |
| Photo upload size / Convex storage | Cap (e.g. 5 MB), fall back to Mini App `/pro` |
| grammY singleton in serverless | Keep current module singleton; sessions live in Convex, not memory |
| Message edit fails (too old) | `sendMessage` a fresh question instead of crashing |

---

## 13. What “done” looks like

A student who never taps Open in App can:

1. Onboard in chat
2. Run Quick 10, Daily, and a quota-capped mock
3. See stats and department ranks
4. Change language and department
5. Pay for Pro by sending a receipt photo
6. Drill mistakes as Pro

They **must** open the Mini App only to: fight a duel, browse/review history, or change cabinet theme / bilingual view.

---

## 14. Review checklist

Please mark before implementation:

- [ ] “Duel” is Mini App only — correct?
- [ ] Bilingual stacked view stays Mini App only — correct?
- [ ] Chat mock is untimed + instant feedback — acceptable?
- [ ] Pro receipt photo in chat is in Phase 3, not Phase 1 — OK?
- [ ] Reply keyboard layout (Quiz / Mock / Daily / Stats / Ranks / More) — OK or change labels?
- [ ] Keep Telegram Menu Button as Mini App — OK?
- [ ] `/study` becomes an alias of `/quiz` rather than a separate mode?

Once this is approved, implementation starts at **Phase 1** (no quiz engine until the menu/onboarding is signed off).
