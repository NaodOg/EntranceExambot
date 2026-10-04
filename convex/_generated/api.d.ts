/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as auth_telegram from "../auth/telegram.js";
import type * as broadcasts from "../broadcasts.js";
import type * as chat from "../chat.js";
import type * as crons from "../crons.js";
import type * as duels from "../duels.js";
import type * as exams from "../exams.js";
import type * as gifts from "../gifts.js";
import type * as groupDuels from "../groupDuels.js";
import type * as lib_adminStats from "../lib/adminStats.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_now from "../lib/now.js";
import type * as lib_telegram from "../lib/telegram.js";
import type * as links from "../links.js";
import type * as maintenance from "../maintenance.js";
import type * as marks from "../marks.js";
import type * as notifications from "../notifications.js";
import type * as period from "../period.js";
import type * as premium from "../premium.js";
import type * as questionSource from "../questionSource.js";
import type * as quota from "../quota.js";
import type * as seed from "../seed.js";
import type * as settings from "../settings.js";
import type * as streak from "../streak.js";
import type * as translations from "../translations.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  "auth/telegram": typeof auth_telegram;
  broadcasts: typeof broadcasts;
  chat: typeof chat;
  crons: typeof crons;
  duels: typeof duels;
  exams: typeof exams;
  gifts: typeof gifts;
  groupDuels: typeof groupDuels;
  "lib/adminStats": typeof lib_adminStats;
  "lib/auth": typeof lib_auth;
  "lib/now": typeof lib_now;
  "lib/telegram": typeof lib_telegram;
  links: typeof links;
  maintenance: typeof maintenance;
  marks: typeof marks;
  notifications: typeof notifications;
  period: typeof period;
  premium: typeof premium;
  questionSource: typeof questionSource;
  quota: typeof quota;
  seed: typeof seed;
  settings: typeof settings;
  streak: typeof streak;
  translations: typeof translations;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
