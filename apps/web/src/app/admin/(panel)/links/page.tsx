"use client";

import { useState, type ReactNode } from "react";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import {
  ADMIN_EMAIL,
  useAdminMutation,
  useAdminPaginatedQuery,
  useAdminQuery,
} from "@/lib/admin-client";
import { Modal } from "@/components/admin/Modal";
import { Badge, Card, EmptyState, LoadMore, PageHeader } from "@/components/admin/ui";
import { buildTrackedLink } from "@/lib/bot-links";
import { Check, Copy, Pencil, Plus, Power, Trash2 } from "lucide-react";

type Target = "app" | "bot" | "url";

type LinkRow = {
  _id: Id<"trackedLinks">;
  code: string;
  label: string;
  target: Target;
  path?: string;
  url?: string;
  startParam?: string;
  notes?: string;
  isActive: boolean;
  starts: number;
  uniqueUsers: number;
  signups: number;
  lastEventAt?: number;
  createdBy?: string;
  createdAt: number;
};

type Form = {
  label: string;
  code: string;
  target: Target;
  path: string;
  url: string;
  startParam: string;
  notes: string;
  isActive: boolean;
};

const empty: Form = {
  label: "",
  code: "",
  target: "bot",
  path: "",
  url: "",
  startParam: "",
  notes: "",
  isActive: true,
};

const TARGET_LABEL: Record<Target, string> = {
  bot: "Bot chat",
  app: "App screen",
  url: "External URL",
};

function payload(form: Form) {
  return {
    label: form.label,
    target: form.target,
    path: form.path.trim() || undefined,
    url: form.url.trim() || undefined,
    startParam: form.startParam.trim() || undefined,
    notes: form.notes.trim() || undefined,
    isActive: form.isActive,
  };
}

export default function AdminLinksPage() {
  const overview = useAdminQuery(api.links.overview);
  const links = useAdminPaginatedQuery(api.links.list, {}, { initialNumItems: 10 });
  const create = useAdminMutation(api.links.create);
  const update = useAdminMutation(api.links.update);
  const setActive = useAdminMutation(api.links.setActive);
  const remove = useAdminMutation(api.links.remove);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LinkRow | null>(null);
  const [form, setForm] = useState<Form>(empty);
  const [error, setError] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<Id<"trackedLinks"> | null>(null);

  function startCreate() {
    setEditing(null);
    setForm(empty);
    setError(null);
    setOpen(true);
  }

  function startEdit(link: LinkRow) {
    setEditing(link);
    setForm({
      label: link.label,
      code: link.code,
      target: link.target,
      path: link.path ?? "",
      url: link.url ?? "",
      startParam: link.startParam ?? "",
      notes: link.notes ?? "",
      isActive: link.isActive,
    });
    setError(null);
    setOpen(true);
  }

  async function onSave() {
    try {
      setError(null);
      if (editing) {
        await update({ id: editing._id, ...payload(form), adminEmail: ADMIN_EMAIL });
      } else {
        await create({
          ...payload(form),
          code: form.code.trim() || undefined,
          adminEmail: ADMIN_EMAIL,
        });
      }
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  const stats: Array<[string, string | number]> = [
    ["Links", overview?.total ?? "—"],
    ["Active", overview?.active ?? "—"],
    ["Starts", overview?.starts ?? "—"],
    ["People", overview?.uniqueUsers ?? "—"],
    ["Signups", overview?.signups ?? "—"],
    [
      "Conv.",
      overview && overview.starts > 0
        ? `${Math.round((overview.signups / overview.starts) * 100)}%`
        : "—",
    ],
  ];

  return (
    <div className="grid min-w-0 gap-5">
      <PageHeader
        kicker="Growth"
        title="Tracked links"
        description="Create a unique Telegram link, share it anywhere, and see bot starts, unique people and signups."
        action={
          <button type="button" onClick={startCreate} className="btn btn-primary">
            <Plus size={16} /> New link
          </button>
        }
      />

      <section className="flex min-w-0 flex-wrap gap-2">
        {stats.map(([label, value]) => (
          <div
            key={label}
            className="inline-flex min-w-0 items-baseline gap-1.5 rounded-full border border-line-strong bg-surface/70 px-2.5 py-1"
          >
            <span className="font-display text-base leading-none">{value}</span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-faint">
              {label}
            </span>
          </div>
        ))}
      </section>

      {links.results.length === 0 && links.status === "Exhausted" ? (
        <EmptyState
          title="No links yet"
          description="Create your first tracked link to start measuring reach."
        />
      ) : (
        <div className="grid min-w-0 gap-3">
          {links.results.map((link) => (
            <Card key={link._id} className="grid min-w-0 gap-3">
              <div className="flex min-w-0 items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold">{link.label}</h3>
                  <p className="truncate font-mono text-xs text-muted">
                    {link.code} · {TARGET_LABEL[link.target]}
                  </p>
                </div>
                <Badge tone={link.isActive ? "sage" : "danger"}>
                  {link.isActive ? "active" : "off"}
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <Meta label="Starts" value={link.starts} />
                <Meta label="People" value={link.uniqueUsers} />
                <Meta label="Signups" value={link.signups} />
              </div>

              <CopyLink value={buildTrackedLink(link.code)} />

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <ActionButton onClick={() => setDetailId(link._id)}>Details</ActionButton>
                <ActionButton onClick={() => startEdit(link)} icon={<Pencil size={14} />}>
                  Edit
                </ActionButton>
                <ActionButton
                  onClick={() => void setActive({ id: link._id, isActive: !link.isActive })}
                  icon={<Power size={14} />}
                >
                  {link.isActive ? "Turn off" : "Turn on"}
                </ActionButton>
                <ActionButton
                  tone="danger"
                  icon={<Trash2 size={14} />}
                  onClick={() => {
                    if (window.confirm("Delete this link and all its events?")) {
                      void remove({ id: link._id, adminEmail: ADMIN_EMAIL });
                    }
                  }}
                >
                  Delete
                </ActionButton>
              </div>
            </Card>
          ))}
        </div>
      )}

      <LoadMore status={links.status} loadMore={links.loadMore} count={links.results.length} />

      <Modal
        open={open}
        title={editing ? "Edit link" : "New tracked link"}
        onClose={() => setOpen(false)}
      >
        <div className="grid min-w-0 gap-3">
          <Field label="Name">
            <input
              className="field min-w-0"
              placeholder="e.g. Telegram channel launch"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
            />
          </Field>
          {!editing ? (
            <Field label="Custom code (optional)">
              <input
                className="field min-w-0"
                placeholder="Leave empty to auto-generate"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
            </Field>
          ) : (
            <p className="truncate font-mono text-xs text-muted">Code: {editing.code}</p>
          )}
          <Field label="Where should it send people?">
            <select
              className="field min-w-0"
              value={form.target}
              onChange={(e) => setForm({ ...form, target: e.target.value as Target })}
            >
              <option value="bot">Bot chat (onboarding &amp; menu)</option>
              <option value="app">Open a screen in the study app</option>
              <option value="url">External URL</option>
            </select>
          </Field>

          {form.target === "app" ? (
            <>
              <Field label="App path">
                <input
                  className="field min-w-0"
                  placeholder="/pro, /duel, /leaderboard"
                  value={form.path}
                  onChange={(e) => setForm({ ...form, path: e.target.value })}
                />
              </Field>
              <Field label="Start param (optional)">
                <input
                  className="field min-w-0"
                  placeholder="e.g. duel_lobby"
                  value={form.startParam}
                  onChange={(e) => setForm({ ...form, startParam: e.target.value })}
                />
              </Field>
            </>
          ) : null}

          {form.target === "url" ? (
            <Field label="Link">
              <input
                className="field min-w-0"
                placeholder="https://example.com"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
              />
            </Field>
          ) : null}

          <Field label="Notes (optional)">
            <textarea
              className="field min-h-20 min-w-0"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Active — inactive links stop tracking and fall back to normal onboarding
          </label>
          {error ? <p className="break-words text-sm text-danger">{error}</p> : null}
          <button type="button" className="btn btn-primary" onClick={() => void onSave()}>
            Save
          </button>
        </div>
      </Modal>

      <LinkDetailModal id={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}

function LinkDetailModal({
  id,
  onClose,
}: {
  id: Id<"trackedLinks"> | null;
  onClose: () => void;
}) {
  const detail = useAdminQuery(api.links.get, id ? { id, limit: 50 } : "skip");

  return (
    <Modal open={id !== null} title="Link activity" onClose={onClose}>
      {!detail ? (
        <p className="py-6 text-center text-sm text-muted">Loading…</p>
      ) : (
        <div className="grid min-w-0 gap-4">
          <div className="grid grid-cols-3 gap-2">
            <Meta label="Starts" value={detail.link.starts} />
            <Meta label="People" value={detail.link.uniqueUsers} />
            <Meta label="Signups" value={detail.link.signups} />
          </div>
          <CopyLink value={buildTrackedLink(detail.link.code)} />
          <div className="grid min-w-0 gap-2">
            <p className="kicker">Recent activity</p>
            {detail.events.length === 0 ? (
              <p className="text-sm text-muted">No activity yet.</p>
            ) : (
              detail.events.map((event) => (
                <div
                  key={event._id}
                  className="flex min-w-0 items-center gap-2 rounded-lg bg-bg/40 px-3 py-2 text-sm"
                >
                  <Badge tone={event.kind === "signup" ? "sage" : "accent"}>{event.kind}</Badge>
                  <span className="min-w-0 flex-1 truncate text-xs text-muted">
                    {event.telegramId ? `tg ${event.telegramId}` : "anonymous"}
                  </span>
                  <span className="shrink-0 text-xs text-faint">
                    {new Date(event.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

function ActionButton({
  children,
  icon,
  onClick,
  tone = "default",
}: {
  children: ReactNode;
  icon?: ReactNode;
  onClick: () => void;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-10 min-w-0 items-center justify-center gap-1.5 overflow-hidden rounded-lg border border-line-strong bg-surface px-2 text-[11px] font-semibold uppercase tracking-wide active:bg-surface-2 ${
        tone === "danger" ? "text-danger" : "text-ink"
      }`}
    >
      {icon ? <span className="shrink-0">{icon}</span> : null}
      <span className="truncate">{children}</span>
    </button>
  );
}

function CopyLink({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="flex min-w-0 items-center gap-2 overflow-hidden rounded-lg border border-line-strong bg-bg/40 px-3 py-2.5 text-left active:bg-surface-2"
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted">{value}</span>
      <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-accent">
        {copied ? <Check size={14} /> : <Copy size={14} />}
        {copied ? "Copied" : "Copy"}
      </span>
    </button>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid min-w-0 gap-1 text-xs text-muted">
      {label}
      {children}
    </label>
  );
}

function Meta({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0 rounded-lg bg-bg/40 px-3 py-2">
      <p className="truncate font-mono text-[10px] uppercase tracking-wider text-faint">{label}</p>
      <p className="mt-0.5 truncate font-semibold">{value}</p>
    </div>
  );
}
