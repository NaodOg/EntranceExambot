"use client";

import { createContext, useCallback, useContext, type ReactNode } from "react";
import {
  useAction,
  useMutation,
  usePaginatedQuery,
  useQuery,
  type PaginatedQueryArgs,
  type PaginatedQueryReference,
} from "convex/react";
import type { FunctionReference } from "convex/server";

export const ADMIN_EMAIL = "admin@local.dev";
const ADMIN_TOKEN_COOKIE = "exam_bot_admin_api";

const AdminTokenContext = createContext<string>("");

/** Provides the signed admin token read server-side from the session cookie. */
export function AdminTokenProvider({
  token,
  children,
}: {
  token: string;
  children: ReactNode;
}) {
  return <AdminTokenContext.Provider value={token}>{children}</AdminTokenContext.Provider>;
}

/** Fallback for reading the readable admin token cookie (set at login). */
export function getAdminToken(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${ADMIN_TOKEN_COOKIE}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]) : "";
}

export function clearAdminToken() {
  if (typeof document === "undefined") return;
  document.cookie = `${ADMIN_TOKEN_COOKIE}=; max-age=0; path=/`;
}

function useToken(): string {
  const fromContext = useContext(AdminTokenContext);
  return fromContext || getAdminToken();
}

/** Admin query that injects the signed admin token required by Convex. */
export function useAdminQuery<Q extends FunctionReference<"query">>(
  query: Q,
  args?: Omit<Q["_args"], "adminSecret"> | "skip",
) {
  const token = useToken();
  const merged =
    args === "skip"
      ? "skip"
      : { ...((args as Record<string, unknown> | undefined) ?? {}), adminSecret: token };
  return useQuery(query, merged as never);
}

/** Admin mutation that injects the signed admin token required by Convex. */
export function useAdminMutation<M extends FunctionReference<"mutation">>(
  mutation: M,
) {
  const base = useMutation(mutation);
  const token = useToken();
  return useCallback(
    (args?: Omit<M["_args"], "adminSecret">) =>
      base({ ...((args as Record<string, unknown> | undefined) ?? {}), adminSecret: token } as never),
    [base, token],
  );
}

/** Admin action that injects the signed admin token required by Convex. */
export function useAdminAction<A extends FunctionReference<"action">>(action: A) {
  const base = useAction(action);
  const token = useToken();
  return useCallback(
    (args?: Omit<A["_args"], "adminSecret">) =>
      base({ ...((args as Record<string, unknown> | undefined) ?? {}), adminSecret: token } as never),
    [base, token],
  );
}

/**
 * Admin paginated query that injects the signed admin token and pages results
 * in fixed batches, so lists never dump the whole table at once.
 */
export function useAdminPaginatedQuery<Q extends PaginatedQueryReference>(
  query: Q,
  args: Omit<PaginatedQueryArgs<Q>, "adminSecret"> | "skip",
  options: { initialNumItems: number },
) {
  const token = useToken();
  const merged =
    args === "skip"
      ? "skip"
      : { ...((args as Record<string, unknown> | undefined) ?? {}), adminSecret: token };
  return usePaginatedQuery(query, merged as never, options);
}
