"use client";

import { useCallback } from "react";
import {
  useMutation as useBaseMutation,
  useQuery as useBaseQuery,
} from "convex/react";
import type { FunctionReference } from "convex/server";
import { useTelegramWebApp } from "@/hooks/useTelegramWebApp";

/**
 * Convex hooks that attach validated Telegram initData to any call carrying a
 * `telegramId`, plus the client clock the backend memoisises reads against.
 * Public calls (no `telegramId`) pass through untouched, so these can safely
 * replace the standard hooks across the Mini App.
 *
 * `nowMs` is clamped server-side (convex/lib/now.ts) to a few minutes around
 * real time, so a tampered device clock cannot buy extra quota or keep an
 * expired streak or Pro plan alive.
 */
function withRuntime(args: unknown, initData: string): unknown {
  if (!args || typeof args !== "object" || !("telegramId" in args) || !initData) {
    return args;
  }
  return {
    ...(args as Record<string, unknown>),
    initData,
    nowMs: Date.now(),
  };
}

function withInitDataAndClock(args: unknown, initData: string): unknown {
  if (!args || typeof args !== "object") return args;
  return {
    ...(args as Record<string, unknown>),
    initData,
    nowMs: Date.now(),
  };
}

export function useQuery<Q extends FunctionReference<"query">>(
  query: Q,
  args?: Omit<Q["_args"], "initData" | "nowMs"> | "skip",
) {
  const { initData } = useTelegramWebApp();
  const merged =
    args === "skip" || args === undefined ? args : withRuntime(args, initData);
  return useBaseQuery(query, merged as never);
}

/**
 * Query that always attaches Telegram initData, even when the args carry no
 * `telegramId`. Use for question-bearing queries that gate on the caller being
 * a Telegram client.
 */
export function useAuthedQuery<Q extends FunctionReference<"query">>(
  query: Q,
  args?: Omit<Q["_args"], "initData" | "nowMs"> | "skip",
) {
  const { initData } = useTelegramWebApp();
  const merged =
    args === "skip" ? "skip" : withInitDataAndClock(args, initData);
  return useBaseQuery(query, merged as never);
}

export function useMutation<M extends FunctionReference<"mutation">>(mutation: M) {
  const { initData } = useTelegramWebApp();
  const base = useBaseMutation(mutation);
  return useCallback(
    (args?: Omit<M["_args"], "initData" | "nowMs">) =>
      base(withRuntime(args, initData) as never),
    [base, initData],
  );
}