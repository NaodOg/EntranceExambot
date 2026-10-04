"use client";

import { useState } from "react";
import { api } from "convex/_generated/api";
import type { Doc, Id } from "convex/_generated/dataModel";
import { useAdminPaginatedQuery, useAdminQuery } from "@/lib/admin-client";
import { EmptyState, LoadMore, PageHeader, SectionTitle } from "@/components/admin/ui";
import { Modal } from "@/components/admin/Modal";
import {
  BroadcastCard,
  Composer,
  EMPTY_COMPOSER,
  composerFromDoc,
  type ComposerState,
} from "@/components/admin/broadcasts";
import { Plus } from "lucide-react";

function freshComposer(): ComposerState {
  return {
    ...EMPTY_COMPOSER,
    buttons: [],
    audience: { ...EMPTY_COMPOSER.audience },
  };
}

export default function AdminNotificationsPage() {
  const broadcasts = useAdminPaginatedQuery(api.broadcasts.list, {}, { initialNumItems: 10 });

  const [composerOpen, setComposerOpen] = useState(false);
  const [editingId, setEditingId] = useState<Id<"broadcasts"> | null>(null);
  const [draft, setDraft] = useState<ComposerState>(freshComposer);
  const [composerKey, setComposerKey] = useState(0);
  const [historyId, setHistoryId] = useState<Id<"broadcasts"> | null>(null);

  const runs = useAdminQuery(
    api.broadcasts.runs,
    historyId ? { broadcastId: historyId } : "skip",
  );

  function openNew() {
    setEditingId(null);
    setDraft(freshComposer());
    setComposerKey((key) => key + 1);
    setComposerOpen(true);
  }

  function openEdit(doc: Doc<"broadcasts">) {
    setEditingId(doc._id);
    setDraft(composerFromDoc(doc));
    setComposerKey((key) => key + 1);
    setComposerOpen(true);
  }

  return (
    <div className="grid gap-5">
      <PageHeader
        kicker="Growth"
        title="Broadcasts"
        description="Compose and schedule Telegram messages with customizable buttons, audience filters, and recurring sends."
        action={
          <button type="button" className="btn btn-primary" onClick={openNew}>
            <Plus size={16} /> New broadcast
          </button>
        }
      />

      {broadcasts.results.length === 0 && broadcasts.status === "Exhausted" ? (
        <EmptyState
          title="No broadcasts yet"
          description="Create your first message — send it now or schedule it to repeat."
        />
      ) : (
        <div className="grid gap-3">
          {broadcasts.results.map((doc) => (
            <BroadcastCard
              key={doc._id}
              doc={doc}
              onEdit={openEdit}
              onChanged={() => {}}
              onHistory={(item) => setHistoryId(item._id)}
            />
          ))}
        </div>
      )}

      <LoadMore
        status={broadcasts.status}
        loadMore={broadcasts.loadMore}
        count={broadcasts.results.length}
      />

      <Composer
        key={composerKey}
        open={composerOpen}
        initial={draft}
        editingId={editingId}
        onClose={() => setComposerOpen(false)}
        onSaved={() => {}}
      />

      <Modal
        open={historyId != null}
        title="Run history"
        onClose={() => setHistoryId(null)}
      >
        <SectionTitle>Recent runs</SectionTitle>
        {runs == null ? (
          <p className="mt-3 text-sm text-muted">Loading…</p>
        ) : runs.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            No runs yet. Send now or wait for the schedule to fire.
          </p>
        ) : (
          <div className="mt-3 grid gap-2">
            {runs.map((run) => (
              <div
                key={run._id}
                className="grid gap-1 rounded-xl border border-line p-3 text-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">
                    {new Date(run.startedAt).toLocaleString()}
                  </span>
                  {run.completedAt ? (
                    <span className="text-xs text-muted">
                      finished {new Date(run.completedAt).toLocaleTimeString()}
                    </span>
                  ) : (
                    <span className="text-xs text-accent">running…</span>
                  )}
                </div>
                <p className="text-xs text-muted">
                  {run.sent} sent
                  {run.failed > 0 ? ` · ${run.failed} failed` : ""}
                </p>
                {run.error ? <p className="text-xs text-danger">{run.error}</p> : null}
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
