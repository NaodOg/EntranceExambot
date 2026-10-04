"use client";

import { useState } from "react";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import { ADMIN_EMAIL, useAdminMutation, useAdminPaginatedQuery } from "@/lib/admin-client";
import { Badge, Card, EmptyState, LoadMore, PageHeader } from "@/components/admin/ui";
import { ChevronDown } from "lucide-react";

const FILTERS = ["pending", "approved", "rejected", ""] as const;

export default function AdminPremiumPage() {
  const [status, setStatus] = useState<(typeof FILTERS)[number]>("pending");
  const requests = useAdminPaginatedQuery(
    api.premium.listAll,
    status ? { status } : {},
    { initialNumItems: 10 },
  );
  const approve = useAdminMutation(api.premium.approve);
  const reject = useAdminMutation(api.premium.reject);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function onApprove(requestId: Id<"premiumRequests">) {
    setBusyId(requestId);
    try {
      const telegramId = await approve({ requestId, adminEmail: ADMIN_EMAIL });
      if (telegramId) {
        await fetch("/api/telegram/pro-notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ telegramId, status: "approved" }),
        });
      }
    } finally {
      setBusyId(null);
    }
  }

  async function onReject(requestId: Id<"premiumRequests">) {
    const reason = window.prompt("Rejection reason")?.trim();
    if (!reason) return;
    setBusyId(requestId);
    try {
      const telegramId = await reject({
        requestId,
        adminEmail: ADMIN_EMAIL,
        rejectionReason: reason,
      });
      if (telegramId) {
        await fetch("/api/telegram/pro-notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ telegramId, status: "rejected", reason }),
        });
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="grid gap-5">
      <PageHeader
        kicker="Money"
        title="Premium"
        description="Review payment requests. Proof images load only when you open them."
      />

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button
            key={item || "all"}
            type="button"
            onClick={() => setStatus(item)}
            className={`min-h-9 rounded-lg px-3.5 font-mono text-xs font-semibold uppercase tracking-wider transition-colors ${
              status === item ? "bg-accent text-accent-ink" : "bg-surface-2 text-muted hover:text-ink"
            }`}
          >
            {item || "all"}
          </button>
        ))}
      </div>

      {requests.results.length === 0 && requests.status === "Exhausted" ? (
        <EmptyState title="Nothing here" description="No requests in this filter." />
      ) : (
        <div className="grid gap-3">
          {requests.results.map((request) => {
            const busy = busyId === request._id;
            const expanded = expandedId === request._id;
            return (
              <Card key={request._id} className="grid gap-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold">
                        {request.user?.firstName ?? request.user?.username ?? "Unknown"}
                      </h3>
                      <Badge
                        tone={
                          request.status === "pending"
                            ? "accent"
                            : request.status === "approved"
                              ? "sage"
                              : "danger"
                        }
                      >
                        {request.status}
                      </Badge>
                      {request.kind === "gift" ? <Badge tone="muted">gift</Badge> : null}
                    </div>
                    <p className="mt-1 text-sm text-muted">
                      Telegram {request.user?.telegramId} · {request.amountEtb} ETB
                    </p>
                    <p className="text-xs text-muted">
                      Ref {request.transactionRef ?? "—"}
                      {request.giftCode ? ` · Code ${request.giftCode}` : ""}
                    </p>
                    <p className="text-xs text-muted">
                      {new Date(request.createdAt).toLocaleString()}
                    </p>
                  </div>

                  {request.status === "pending" ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void onApprove(request._id)}
                        className="btn btn-primary min-h-10 px-4"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void onReject(request._id)}
                        className="btn btn-ghost min-h-10 px-4 text-danger"
                      >
                        Reject
                      </button>
                    </div>
                  ) : null}
                </div>

                {request.proofUrl ? (
                  <div className="border-t border-line pt-3">
                    <button
                      type="button"
                      className="flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-wider text-accent"
                      onClick={() => setExpandedId(expanded ? null : request._id)}
                      aria-expanded={expanded}
                    >
                      <ChevronDown
                        size={15}
                        className={`transition-transform ${expanded ? "rotate-180" : ""}`}
                      />
                      {expanded ? "Hide proof" : "View proof"}
                    </button>
                    {expanded ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={request.proofUrl}
                        alt="Payment proof"
                        className="mt-3 max-h-80 w-full rounded-lg border border-line object-contain"
                      />
                    ) : null}
                  </div>
                ) : (
                  <p className="border-t border-line pt-3 text-xs text-muted">No proof attached.</p>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <LoadMore
        status={requests.status}
        loadMore={requests.loadMore}
        count={requests.results.length}
      />
    </div>
  );
}
