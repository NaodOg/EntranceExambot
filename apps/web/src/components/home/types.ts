export type HomeSitting = {
  percent: number;
  title: string;
  reviewHref: string;
};

export type HomeUsageItem = {
  label: string;
  questions: number;
};

export type HomeModel = {
  language: "am" | "en";
  name: string;
  trackName: string;
  trackSlug: string;
  subjectName: string;
  subjectSlug: string;
  streak: number;
  xp: number;
  dailyGoal: number;
  todayDone: number;
  freeQuestionsLeft: number;
  freeQuestionsMax: number;
  freeDuelsLeft: number;
  freeDuelsMax: number;
  duelsToday: number;
  usageToday: HomeUsageItem[];
  isPro: boolean;
  lastPercent: number | null;
  lastTitle: string;
  lastReviewHref: string | null;
  examYear: number;
  mockCount: number;
  mockMinutes: number;
  sittings: HomeSitting[];
  examHref: string;
  quickHref: string;
  proHref: string;
  historyHref: string;
  practiceHref: string;
};

export const SAMPLE_HOME: HomeModel = {
  language: "en",
  name: "Hana",
  trackName: "Natural Science",
  trackSlug: "natural-science",
  subjectName: "Physics",
  subjectSlug: "physics",
  streak: 12,
  xp: 1840,
  dailyGoal: 20,
  todayDone: 8,
  freeQuestionsLeft: 12,
  freeQuestionsMax: 20,
  freeDuelsLeft: 0,
  freeDuelsMax: 0,
  duelsToday: 0,
  usageToday: [{ label: "Quick 10", questions: 8 }],
  isPro: false,
  lastPercent: 72,
  lastTitle: "2024 Regular",
  lastReviewHref: "/app/history",
  examYear: 2018,
  mockCount: 100,
  mockMinutes: 150,
  sittings: [
    { percent: 72, title: "2024 Regular", reviewHref: "/app/history" },
    { percent: 68, title: "2023 Model", reviewHref: "/app/history" },
    { percent: 61, title: "2023 Regular", reviewHref: "/app/history" },
  ],
  examHref: "/app/exam?subject=physics",
  quickHref: "/app/exam?subject=physics&mode=quick",
  proHref: "/app/pro",
  historyHref: "/app/history",
  practiceHref: "/app/practice",
};
