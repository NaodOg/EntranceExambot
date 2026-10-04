"use client";

import { Component, type ReactNode } from "react";

/**
 * Catches render-time errors from Convex queries/mutations (e.g. a function
 * that has not been deployed yet) so the whole admin panel does not blank out.
 */
export class AdminErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("Admin panel error:", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="cab grid gap-3 p-5">
          <p className="kicker">Something went wrong</p>
          <h2 className="font-display text-2xl">This view failed to load</h2>
          <p className="text-sm text-muted">
            The Convex backend may be missing a function or table. Run{" "}
            <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs">
              npx convex dev
            </code>{" "}
            (or deploy) to push the latest functions, then retry.
          </p>
          <pre className="max-h-40 overflow-auto rounded-lg border border-line bg-bg/40 p-3 font-mono text-[11px] text-danger">
            {this.state.error.message}
          </pre>
          <div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => this.setState({ error: null })}
            >
              Retry
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
