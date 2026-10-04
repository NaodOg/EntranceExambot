const miniAppUrl = () =>
  process.env.NEXT_PUBLIC_MINI_APP_URL ?? "http://localhost:3000/app";

function withQuery(path: string, params: Record<string, string | undefined>): string {
  const url = new URL(path);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  return url.toString();
}

export const appUrls = {
  home: () => miniAppUrl(),
  quick: (subject: string, source?: string, examId?: string) =>
    withQuery(`${miniAppUrl()}/exam`, { subject, mode: "quick", source, exam: examId }),
  mock: (subject: string, examId?: string, source?: string) =>
    withQuery(`${miniAppUrl()}/exam`, { subject, exam: examId, source }),
  exam: (subject: string, source?: string, examId?: string) =>
    withQuery(`${miniAppUrl()}/exam`, { subject, source, exam: examId }),
  mistakes: (subject: string) =>
    withQuery(`${miniAppUrl()}/exam`, { subject, mode: "mistakes" }),
  duelLobby: (source?: string) =>
    withQuery(`${miniAppUrl()}/duel`, { source }),
  duelMatch: (code: string) => `${miniAppUrl()}/duel/${code}`,
  history: () => `${miniAppUrl()}/history`,
  review: (attemptId: string) =>
    withQuery(`${miniAppUrl()}/review`, { attempt: attemptId }),
  pro: () => `${miniAppUrl()}/pro`,
  proGift: (code: string) =>
    withQuery(`${miniAppUrl()}/pro`, { gift: code.toUpperCase() }),
  account: () => `${miniAppUrl()}/account`,
  ranks: () => `${miniAppUrl()}/leaderboard`,
};

export function dayIndexUtc(now = Date.now()): number {
  const date = new Date(now);
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  return Math.floor((now - start) / 86_400_000);
}

export function utcMidnightMs(now = Date.now()): number {
  const date = new Date(now);
  date.setUTCHours(0, 0, 0, 0);
  return date.getTime();
}
