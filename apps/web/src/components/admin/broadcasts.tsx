"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "convex/_generated/api";
import type { Doc, Id } from "convex/_generated/dataModel";
import {
  ADMIN_EMAIL,
  useAdminAction,
  useAdminMutation,
  useAdminQuery,
} from "@/lib/admin-client";
import { Badge, SectionTitle } from "@/components/admin/ui";
import { Modal } from "@/components/admin/Modal";
import {
  BROADCAST_TEMPLATES,
  WEBAPP_DESTINATIONS,
} from "@/lib/admin/broadcastTemplates";
import { Plus, Send, Trash2 } from "lucide-react";

export type ButtonAction = "menu" | "url" | "mini_app" | "custom";

export type ButtonDraft = {
  row: number;
  labelEn: string;
  labelAm: string;
  action: ButtonAction;
  value: string;
};

export type AudienceDraft = {
  all: boolean;
  tracks: string[];
  pro: "any" | "pro" | "free";
  languages: Array<"en" | "am">;
  activeWithinDays: number | null;
  inactiveForDays: number | null;
  minStreak: number | null;
  maxStreak: number | null;
  telegramIds: string[];
};

export type ScheduleKind = "now" | "once" | "recurring";
type IntervalUnit = "minutes" | "hours" | "days";

export type ComposerState = {
  name: string;
  bodyEn: string;
  bodyAm: string;
  buttons: ButtonDraft[];
  audience: AudienceDraft;
  scheduleKind: ScheduleKind;
  startAt: string;
  intervalValue: number;
  intervalUnit: IntervalUnit;
  endAt: string;
};

export const EMPTY_AUDIENCE: AudienceDraft = {
  all: true,
  tracks: [],
  pro: "any",
  languages: [],
  activeWithinDays: null,
  inactiveForDays: null,
  minStreak: null,
  maxStreak: null,
  telegramIds: [],
};

export const EMPTY_COMPOSER: ComposerState = {
  name: "",
  bodyEn: "",
  bodyAm: "",
  buttons: [],
  audience: { ...EMPTY_AUDIENCE },
  scheduleKind: "now",
  startAt: "",
  intervalValue: 1,
  intervalUnit: "days",
  endAt: "",
};

const BOT_ACTION_OPTIONS: { value: string; label: string }[] = [
  { value: "quiz", label: "Quick 10 quiz" },
  { value: "mock", label: "Full exam" },
  { value: "daily", label: "Daily goal" },
  { value: "mistakes", label: "Mistake drill (Pro)" },
  { value: "stats", label: "Stats" },
  { value: "ranks", label: "Leaderboard" },
  { value: "track", label: "Change track" },
  { value: "set", label: "Settings" },
  { value: "pro", label: "Pro upgrade" },
  { value: "duel", label: "Duel" },
  { value: "hist", label: "History" },
  { value: "more", label: "More menu" },
  { value: "menu", label: "Main menu" },
  { value: "help", label: "Help" },
];

const PLACEHOLDERS = ["{name}", "{firstName}", "{streak}", "{xp}", "{track}"];

const UNITS: { id: IntervalUnit; label: string; minutes: number }[] = [
  { id: "minutes", label: "Minutes", minutes: 1 },
  { id: "hours", label: "Hours", minutes: 60 },
  { id: "days", label: "Days", minutes: 1440 },
];

function toLocalInput(ms?: number): string {
  if (!ms) return "";
  const date = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function fromLocalInput(value: string): number | undefined {
  if (!value) return undefined;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? undefined : ms;
}

export function audienceArg(audience: AudienceDraft) {
  return {
    all: audience.all,
    tracks: audience.tracks,
    pro: audience.pro,
    languages: audience.languages,
    telegramIds: audience.telegramIds,
    ...(audience.activeWithinDays != null ? { activeWithinDays: audience.activeWithinDays } : {}),
    ...(audience.inactiveForDays != null ? { inactiveForDays: audience.inactiveForDays } : {}),
    ...(audience.minStreak != null ? { minStreak: audience.minStreak } : {}),
    ...(audience.maxStreak != null ? { maxStreak: audience.maxStreak } : {}),
  };
}

export function cleanedButtons(buttons: ButtonDraft[]) {
  return buttons
    .filter((button) => button.labelEn.trim() || button.labelAm.trim())
    .filter((button) => button.value.trim())
    .map((button) => ({
      row: button.row,
      labelEn: button.labelEn.trim() || button.labelAm.trim(),
      labelAm: button.labelAm.trim() || button.labelEn.trim(),
      action: button.action,
      value: button.value.trim(),
    }));
}

export function composerFromDoc(doc: Doc<"broadcasts">): ComposerState {
  const audience = doc.audience;
  const minutes = doc.intervalMinutes ?? 60;
  const intervalUnit: IntervalUnit =
    minutes % 1440 === 0 ? "days" : minutes % 60 === 0 ? "hours" : "minutes";
  const unitMinutes = intervalUnit === "days" ? 1440 : intervalUnit === "hours" ? 60 : 1;
  return {
    name: doc.name,
    bodyEn: doc.bodyEn,
    bodyAm: doc.bodyAm,
    buttons: doc.buttons.map((button) => ({ ...button })),
    audience: {
      all: audience.all,
      tracks: audience.tracks,
      pro: audience.pro,
      languages: audience.languages,
      activeWithinDays: audience.activeWithinDays ?? null,
      inactiveForDays: audience.inactiveForDays ?? null,
      minStreak: audience.minStreak ?? null,
      maxStreak: audience.maxStreak ?? null,
      telegramIds: audience.telegramIds,
    },
    scheduleKind: doc.scheduleKind,
    startAt: toLocalInput(doc.startAt ?? doc.nextRunAt),
    intervalValue: Math.max(1, Math.round(minutes / unitMinutes)),
    intervalUnit,
    endAt: toLocalInput(doc.endAt),
  };
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, "");
}

function scheduleSummary(doc: Doc<"broadcasts">): string {
  if (doc.scheduleKind === "now") return "One-off";
  if (doc.scheduleKind === "once") {
    return doc.nextRunAt
      ? `Once · ${new Date(doc.nextRunAt).toLocaleString()}`
      : "Once";
  }
  const minutes = doc.intervalMinutes ?? 0;
  const label =
    minutes % 1440 === 0
      ? `${minutes / 1440}d`
      : minutes % 60 === 0
        ? `${minutes / 60}h`
        : `${minutes}m`;
  return `Repeats every ${label}${doc.endAt ? ` until ${new Date(doc.endAt).toLocaleDateString()}` : ""}`;
}

const STATUS_TONES: Record<
  Doc<"broadcasts">["status"],
  "muted" | "accent" | "danger" | "sage"
> = {
  draft: "muted",
  scheduled: "accent",
  sending: "accent",
  paused: "muted",
  sent: "sage",
  cancelled: "muted",
  failed: "danger",
};

export function BroadcastCard({
  doc,
  onEdit,
  onChanged,
  onHistory,
}: {
  doc: Doc<"broadcasts">;
  onEdit: (doc: Doc<"broadcasts">) => void;
  onChanged: () => void;
  onHistory: (doc: Doc<"broadcasts">) => void;
}) {
  const sendNow = useAdminMutation(api.broadcasts.sendNow);
  const pause = useAdminMutation(api.broadcasts.pause);
  const resume = useAdminMutation(api.broadcasts.resume);
  const cancel = useAdminMutation(api.broadcasts.cancel);
  const duplicate = useAdminMutation(api.broadcasts.duplicate);
  const remove = useAdminMutation(api.broadcasts.remove);
  const [busy, setBusy] = useState<string | null>(null);

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    try {
      await fn();
      onChanged();
    } finally {
      setBusy(null);
    }
  }

  const active = doc.status === "scheduled" || doc.status === "sending";

  return (
    <article className="cab grid gap-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-semibold">{doc.name}</h3>
            <Badge tone={STATUS_TONES[doc.status]}>{doc.status}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted">
            {scheduleSummary(doc)} · {doc.audience.all ? "Everyone" : "Filtered"} ·{" "}
            {doc.runCount} run{doc.runCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-2xl">{doc.sentCount}</p>
          <p className="text-[11px] uppercase tracking-wider text-faint">
            sent{doc.failedCount > 0 ? ` · ${doc.failedCount} failed` : ""}
          </p>
        </div>
      </div>

      <p className="line-clamp-3 whitespace-pre-wrap rounded-lg bg-bg/40 p-3 text-sm text-muted">
        {stripTags(doc.bodyEn || doc.bodyAm) || "(empty message)"}
      </p>

      {doc.lastRunAt ? (
        <p className="text-xs text-faint">
          Last run {new Date(doc.lastRunAt).toLocaleString()}
        </p>
      ) : null}
      {doc.lastError ? (
        <p className="text-xs text-danger">Last error: {doc.lastError}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-ghost min-h-9 px-3 text-xs"
          disabled={busy != null}
          onClick={() => onEdit(doc)}
        >
          Edit
        </button>
        <button
          type="button"
          className="btn btn-primary min-h-9 px-3 text-xs"
          disabled={busy != null}
          onClick={() => void run("send", () => sendNow({ id: doc._id, adminEmail: ADMIN_EMAIL }))}
        >
          <Send size={14} /> {busy === "send" ? "Sending…" : "Send now"}
        </button>
        {active ? (
          <button
            type="button"
            className="btn btn-ghost min-h-9 px-3 text-xs"
            disabled={busy != null}
            onClick={() => void run("pause", () => pause({ id: doc._id, adminEmail: ADMIN_EMAIL }))}
          >
            {busy === "pause" ? "…" : "Pause"}
          </button>
        ) : doc.status === "paused" ? (
          <button
            type="button"
            className="btn btn-ghost min-h-9 px-3 text-xs"
            disabled={busy != null}
            onClick={() => void run("resume", () => resume({ id: doc._id, adminEmail: ADMIN_EMAIL }))}
          >
            {busy === "resume" ? "…" : "Resume"}
          </button>
        ) : null}
        {active ? (
          <button
            type="button"
            className="btn btn-ghost min-h-9 px-3 text-xs"
            disabled={busy != null}
            onClick={() => void run("cancel", () => cancel({ id: doc._id, adminEmail: ADMIN_EMAIL }))}
          >
            {busy === "cancel" ? "…" : "Cancel"}
          </button>
        ) : null}
        <button
          type="button"
          className="btn btn-ghost min-h-9 px-3 text-xs"
          disabled={busy != null}
          onClick={() => void run("dup", () => duplicate({ id: doc._id, adminEmail: ADMIN_EMAIL }))}
        >
          {busy === "dup" ? "…" : "Duplicate"}
        </button>
        <button
          type="button"
          className="btn btn-ghost min-h-9 px-3 text-xs"
          onClick={() => onHistory(doc)}
        >
          History
        </button>
        <button
          type="button"
          className="btn btn-ghost min-h-9 px-3 text-xs text-danger"
          disabled={busy != null}
          onClick={() => {
            if (window.confirm(`Delete "${doc.name}" and its history?`)) {
              void run("del", () => remove({ id: doc._id, adminEmail: ADMIN_EMAIL }));
            }
          }}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </article>
  );
}

export function Composer({
  open,
  initial,
  editingId,
  onClose,
  onSaved,
}: {
  open: boolean;
  initial: ComposerState;
  editingId: Id<"broadcasts"> | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [state, setState] = useState<ComposerState>(initial);
  const [lang, setLang] = useState<"en" | "am">("en");
  const [testId, setTestId] = useState("");
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState<null | "draft" | "start">(null);

  const tracks = useAdminQuery(api.admin.listTracks, open ? {} : "skip");
  const save = useAdminMutation(api.broadcasts.save);
  const sendTest = useAdminAction(api.broadcasts.sendTest);

  const [debouncedAudience, setDebouncedAudience] = useState(() => audienceArg(state.audience));
  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedAudience(audienceArg(state.audience)), 450);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(state.audience)]);

  const preview = useAdminQuery(
    api.broadcasts.previewAudience,
    open ? { audience: debouncedAudience } : "skip",
  );

  const body = lang === "am" ? state.bodyAm : state.bodyEn;
  const rows = useMemo(() => groupButtons(state.buttons), [state.buttons]);

  function patch(next: Partial<ComposerState>) {
    setState((current) => ({ ...current, ...next }));
  }

  function setBody(value: string) {
    if (lang === "am") patch({ bodyAm: value });
    else patch({ bodyEn: value });
  }

  function updateButton(index: number, next: Partial<ButtonDraft>) {
    setState((current) => ({
      ...current,
      buttons: current.buttons.map((button, i) => (i === index ? { ...button, ...next } : button)),
    }));
  }

  function addButton(row: number) {
    setState((current) => ({
      ...current,
      buttons: [
        ...current.buttons,
        { row, labelEn: "", labelAm: "", action: "menu", value: "quiz" },
      ],
    }));
  }

  function removeButton(index: number) {
    setState((current) => ({
      ...current,
      buttons: current.buttons.filter((_, i) => i !== index),
    }));
  }

  function addRow() {
    const maxRow = state.buttons.reduce((max, button) => Math.max(max, button.row), -1);
    addButton(maxRow + 1);
  }

  function removeRow(row: number) {
    setState((current) => ({
      ...current,
      buttons: current.buttons.filter((button) => button.row !== row),
    }));
  }

  async function submit(start: boolean) {
    setSaving(start ? "start" : "draft");
    try {
      await save({
        id: editingId ?? undefined,
        name: state.name,
        bodyEn: state.bodyEn,
        bodyAm: state.bodyAm,
        buttons: cleanedButtons(state.buttons),
        audience: audienceArg(state.audience),
        scheduleKind: state.scheduleKind,
        startAt:
          state.scheduleKind === "once" || state.scheduleKind === "recurring"
            ? fromLocalInput(state.startAt)
            : undefined,
        intervalMinutes:
          state.scheduleKind === "recurring"
            ? Math.max(1, state.intervalValue) *
              (UNITS.find((unit) => unit.id === state.intervalUnit)?.minutes ?? 1)
            : undefined,
        endAt:
          state.scheduleKind === "recurring" ? fromLocalInput(state.endAt) : undefined,
        start,
        adminEmail: ADMIN_EMAIL,
      });
      onSaved();
      onClose();
    } catch (err) {
      setTestMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(null);
    }
  }

  async function runTest() {
    setTestMsg("Sending test…");
    try {
      const result = (await sendTest({
        chatId: testId.trim(),
        bodyEn: state.bodyEn,
        bodyAm: state.bodyAm,
        lang,
        buttons: cleanedButtons(state.buttons),
      })) as { ok: boolean; error?: string };
      setTestMsg(result.ok ? "Test sent ✓" : `Test failed: ${result.error ?? "unknown"}`);
    } catch (err) {
      setTestMsg(err instanceof Error ? err.message : "Test failed");
    }
  }

  const canSave = state.name.trim().length > 0 && (state.bodyEn.trim() || state.bodyAm.trim());

  return (
    <Modal open={open} title={editingId ? "Edit broadcast" : "New broadcast"} onClose={onClose}>
      <div className="grid gap-5">
        <label className="grid gap-1.5 text-sm text-muted">
          <span className="kicker">Start from a template</span>
          <select
            className="field"
            value=""
            onChange={(event) => {
              const template = BROADCAST_TEMPLATES.find((t) => t.id === event.target.value);
              if (!template) return;
              patch({
                name: template.label.replace(/^\S+\s/, ""),
                bodyEn: template.bodyEn,
                bodyAm: template.bodyAm,
                buttons: template.buttons?.map((button) => ({ ...button })) ?? [],
                audience: { ...EMPTY_AUDIENCE, ...template.audience },
              });
            }}
          >
            <option value="">— Pick a ready-made draft —</option>
            {BROADCAST_TEMPLATES.map((template) => (
              <option key={template.id} value={template.id}>
                {template.label} — {template.description}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1.5 text-sm text-muted">
          <span className="kicker">Internal name</span>
          <input
            className="field"
            placeholder="e.g. Sunday streak reminder"
            value={state.name}
            onChange={(event) => patch({ name: event.target.value })}
          />
        </label>

        <section className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SectionTitle>Message</SectionTitle>
            <div className="flex overflow-hidden rounded-lg border border-line">
              {(["en", "am"] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLang(code)}
                  className={`min-h-9 px-3 font-mono text-xs font-semibold uppercase ${
                    lang === code ? "bg-accent text-accent-ink" : "text-muted"
                  }`}
                >
                  {code === "en" ? "English" : "አማርኛ"}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {PLACEHOLDERS.map((token) => (
              <button
                key={token}
                type="button"
                className="rounded-full border border-line bg-surface-2 px-2.5 py-1 font-mono text-[11px] text-muted"
                onClick={() => setBody(`${body}${token}`)}
              >
                {token}
              </button>
            ))}
          </div>

          <textarea
            className="field min-h-40 font-mono text-sm"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={"Write in Telegram HTML — <b>bold</b>, <i>italic</i>, <a href=\"…\">link</a>"}
          />
          <p className="text-right text-[11px] text-faint">{body.length} chars</p>

          <div className="rounded-2xl bg-surface-2 p-3">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-faint">
              Telegram preview
            </p>
            <div className="rounded-xl bg-bg-elevated p-3">
              <p className="whitespace-pre-wrap text-sm">
                {stripTags(body) || "Your message preview appears here."}
              </p>
              <div className="mt-3 grid gap-1">
                {rows.map((row) => (
                  <div key={row.row} className="flex flex-wrap gap-1">
                    {row.items.map((item, index) => (
                      <span
                        key={index}
                        className="rounded-md bg-accent/15 px-3 py-1.5 text-xs font-semibold text-accent"
                      >
                        {lang === "am"
                          ? item.labelAm || item.labelEn || "Button"
                          : item.labelEn || item.labelAm || "Button"}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-3">
          <SectionTitle
            aside={
              <button type="button" className="btn btn-ghost min-h-9 px-3 text-xs" onClick={addRow}>
                <Plus size={14} /> Add row
              </button>
            }
          >
            Buttons
          </SectionTitle>
          <p className="text-xs text-muted">
            Each row renders side by side In Telegram. Leave blank for a message with no buttons.
          </p>

          {rows.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line p-3 text-center text-xs text-faint">
              No buttons yet.
            </p>
          ) : null}

          {rows.map((row) => (
            <div key={row.row} className="grid gap-2 rounded-xl border border-line p-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-wider text-faint">
                  Row {row.row + 1}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn btn-ghost min-h-8 px-2 text-[11px]"
                    onClick={() => addButton(row.row)}
                  >
                    <Plus size={12} /> Add
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost min-h-8 px-2 text-[11px] text-danger"
                    onClick={() => removeRow(row.row)}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
              {row.items.map((button) => {
                const index = state.buttons.indexOf(button);
                return (
                  <div key={index} className="grid gap-2 rounded-lg bg-bg/40 p-2">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input
                        className="field"
                        placeholder="Label (EN)"
                        value={button.labelEn}
                        onChange={(event) => updateButton(index, { labelEn: event.target.value })}
                      />
                      <input
                        className="field"
                        placeholder="Label (AM)"
                        value={button.labelAm}
                        onChange={(event) => updateButton(index, { labelAm: event.target.value })}
                      />
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <select
                        className="field"
                        value={button.action}
                        onChange={(event) =>
                          updateButton(index, {
                            action: event.target.value as ButtonAction,
                            value:
                              event.target.value === "menu"
                                ? "quiz"
                                : event.target.value === "mini_app"
                                  ? "home"
                                  : "",
                          })
                        }
                      >
                        <option value="menu">Bot action (in-chat)</option>
                        <option value="mini_app">Open Mini App</option>
                        <option value="url">Open URL</option>
                        <option value="custom">Custom callback data</option>
                      </select>
                      {button.action === "menu" ? (
                        <select
                          className="field"
                          value={button.value}
                          onChange={(event) => updateButton(index, { value: event.target.value })}
                        >
                          {BOT_ACTION_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      ) : button.action === "mini_app" ? (
                        <select
                          className="field"
                          value={button.value}
                          onChange={(event) => updateButton(index, { value: event.target.value })}
                        >
                          {isKnownDestination(button.value) ? null : (
                            <option value={button.value}>Current: {button.value}</option>
                          )}
                          {WEBAPP_DESTINATIONS.map((option) => (
                            <option key={option.value || "home"} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          className="field"
                          placeholder={
                            button.action === "url"
                              ? "https://example.com"
                              : "callback data"
                          }
                          value={button.value}
                          onChange={(event) => updateButton(index, { value: event.target.value })}
                        />
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-xs text-muted">
                        Row
                        <input
                          type="number"
                          className="field w-16"
                          value={button.row + 1}
                          onChange={(event) =>
                            updateButton(index, {
                              row: Math.max(0, Number(event.target.value) - 1 || 0),
                            })
                          }
                        />
                      </label>
                      <button
                        type="button"
                        className="btn btn-ghost min-h-8 px-2 text-[11px] text-danger"
                        onClick={() => removeButton(index)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </section>

        <section className="grid gap-3">
          <SectionTitle>Audience</SectionTitle>
          <div className="flex overflow-hidden rounded-lg border border-line">
            {[
              { id: "all", label: "Everyone" },
              { id: "filter", label: "Filtered" },
            ].map((option) => {
              const on = option.id === "all" ? state.audience.all : !state.audience.all;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => patch({ audience: { ...state.audience, all: option.id === "all" } })}
                  className={`min-h-10 flex-1 font-mono text-xs font-semibold uppercase ${
                    on ? "bg-accent text-accent-ink" : "text-muted"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          {!state.audience.all ? (
            <div className="grid gap-4 rounded-xl border border-line p-3">
              <div className="grid gap-1.5">
                <span className="kicker">Tracks</span>
                <div className="flex flex-wrap gap-1.5">
                  {(tracks ?? []).map((track) => {
                    const on = state.audience.tracks.includes(track.slug);
                    return (
                      <button
                        key={track._id}
                        type="button"
                        onClick={() =>
                          patch({
                            audience: {
                              ...state.audience,
                              tracks: on
                                ? state.audience.tracks.filter((s) => s !== track.slug)
                                : [...state.audience.tracks, track.slug],
                            },
                          })
                        }
                        className={`rounded-full border px-3 py-1 text-xs ${
                          on
                            ? "border-accent bg-accent/15 text-accent"
                            : "border-line text-muted"
                        }`}
                      >
                        {track.nameEn}
                      </button>
                    );
                  })}
                  {(tracks ?? []).length === 0 ? (
                    <span className="text-xs text-faint">Loading tracks…</span>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <label className="grid gap-1.5 text-xs text-muted">
                  <span className="kicker">Plan</span>
                  <select
                    className="field"
                    value={state.audience.pro}
                    onChange={(event) =>
                      patch({
                        audience: {
                          ...state.audience,
                          pro: event.target.value as AudienceDraft["pro"],
                        },
                      })
                    }
                  >
                    <option value="any">Everyone</option>
                    <option value="pro">Pro only</option>
                    <option value="free">Free only</option>
                  </select>
                </label>
                <div className="grid gap-1.5 text-xs text-muted">
                  <span className="kicker">Language</span>
                  <div className="flex gap-1.5">
                    {(["en", "am"] as const).map((code) => {
                      const on = state.audience.languages.includes(code);
                      return (
                        <button
                          key={code}
                          type="button"
                          onClick={() =>
                            patch({
                              audience: {
                                ...state.audience,
                                languages: on
                                  ? state.audience.languages.filter((l) => l !== code)
                                  : [...state.audience.languages, code],
                              },
                            })
                          }
                          className={`min-h-10 flex-1 rounded-lg border text-xs font-semibold uppercase ${
                            on ? "border-accent bg-accent/15 text-accent" : "border-line text-muted"
                          }`}
                        >
                          {code}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <NumberField
                  label="Active within (days)"
                  value={state.audience.activeWithinDays}
                  onChange={(value) =>
                    patch({ audience: { ...state.audience, activeWithinDays: value } })
                  }
                />
                <NumberField
                  label="Inactive for (days)"
                  value={state.audience.inactiveForDays}
                  onChange={(value) =>
                    patch({ audience: { ...state.audience, inactiveForDays: value } })
                  }
                />
                <NumberField
                  label="Min streak"
                  value={state.audience.minStreak}
                  onChange={(value) => patch({ audience: { ...state.audience, minStreak: value } })}
                />
                <NumberField
                  label="Max streak"
                  value={state.audience.maxStreak}
                  onChange={(value) => patch({ audience: { ...state.audience, maxStreak: value } })}
                />
              </div>

              <label className="grid gap-1.5 text-xs text-muted">
                <span className="kicker">Hand-picked Telegram IDs (overrides filters)</span>
                <textarea
                  className="field min-h-20 font-mono text-xs"
                  placeholder="One ID per line"
                  value={state.audience.telegramIds.join("\n")}
                  onChange={(event) =>
                    patch({
                      audience: {
                        ...state.audience,
                        telegramIds: event.target.value
                          .split(/[\s,]+/)
                          .map((value) => value.trim())
                          .filter(Boolean),
                      },
                    })
                  }
                />
              </label>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-bg/40 p-3">
            <p className="font-display text-3xl">
              {preview?.count ?? "…"}
              {preview?.truncated ? "+" : ""}
            </p>
            <div className="text-xs text-muted">
              <p>recipients in this audience</p>
              {preview ? (
                <p className="text-faint">
                  {preview.pro} pro · {preview.byLanguage.en} EN / {preview.byLanguage.am} AM
                  {preview.truncated ? " · capped preview" : ""}
                </p>
              ) : null}
            </div>
          </div>
        </section>

        <section className="grid gap-3">
          <SectionTitle>Schedule</SectionTitle>
          <div className="grid gap-1 border border-line p-1 sm:grid-cols-3">
            {(
              [
                { id: "now", label: "Send now" },
                { id: "once", label: "Once" },
                { id: "recurring", label: "Repeat" },
              ] as const
            ).map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => patch({ scheduleKind: option.id })}
                className={`min-h-10 px-3 font-mono text-xs font-semibold uppercase ${
                  state.scheduleKind === option.id ? "bg-accent text-accent-ink" : "text-muted"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {state.scheduleKind === "once" ? (
            <label className="grid gap-1.5 text-xs text-muted">
              <span className="kicker">Send at</span>
              <input
                type="datetime-local"
                className="field"
                value={state.startAt}
                onChange={(event) => patch({ startAt: event.target.value })}
              />
            </label>
          ) : null}

          {state.scheduleKind === "recurring" ? (
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="grid gap-1.5 text-xs text-muted">
                <span className="kicker">Start at (optional)</span>
                <input
                  type="datetime-local"
                  className="field"
                  value={state.startAt}
                  onChange={(event) => patch({ startAt: event.target.value })}
                />
              </label>
              <label className="grid gap-1.5 text-xs text-muted">
                <span className="kicker">Every</span>
                <input
                  type="number"
                  min={1}
                  className="field"
                  value={state.intervalValue}
                  onChange={(event) =>
                    patch({ intervalValue: Math.max(1, Number(event.target.value) || 1) })
                  }
                />
              </label>
              <label className="grid gap-1.5 text-xs text-muted">
                <span className="kicker">Unit</span>
                <select
                  className="field"
                  value={state.intervalUnit}
                  onChange={(event) =>
                    patch({ intervalUnit: event.target.value as IntervalUnit })
                  }
                >
                  {UNITS.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5 text-xs text-muted sm:col-span-3">
                <span className="kicker">Stop after (optional)</span>
                <input
                  type="datetime-local"
                  className="field"
                  value={state.endAt}
                  onChange={(event) => patch({ endAt: event.target.value })}
                />
              </label>
            </div>
          ) : null}
        </section>

        <section className="grid gap-2 rounded-xl border border-line p-3">
          <span className="kicker">Send a test</span>
          <div className="flex flex-wrap gap-2">
            <input
              className="field flex-1"
              placeholder="Your Telegram ID"
              value={testId}
              onChange={(event) => setTestId(event.target.value)}
            />
            <button
              type="button"
              className="btn btn-ghost"
              disabled={!/^\d+$/.test(testId.trim())}
              onClick={() => void runTest()}
            >
              Send test
            </button>
          </div>
          {testMsg ? <p className="text-xs text-muted">{testMsg}</p> : null}
        </section>

        <div className="sticky bottom-0 flex flex-wrap gap-2 border-t border-line bg-bg-elevated/95 py-3 backdrop-blur">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={!canSave || saving != null}
            onClick={() => void submit(false)}
          >
            {saving === "draft" ? "Saving…" : "Save draft"}
          </button>
          <button
            type="button"
            className="btn btn-primary flex-1"
            disabled={!canSave || saving != null}
            onClick={() => void submit(true)}
          >
            {saving === "start"
              ? "Working…"
              : state.scheduleKind === "now"
                ? "Send now"
                : "Schedule"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function groupButtons(buttons: ButtonDraft[]) {
  const map = new Map<number, { row: number; items: ButtonDraft[] }>();
  for (const button of buttons) {
    const row = map.get(button.row) ?? { row: button.row, items: [] };
    row.items.push(button);
    map.set(button.row, row);
  }
  return [...map.values()].sort((a, b) => a.row - b.row);
}

/** True when a stored mini_app value is one of the known web app destinations. */
function isKnownDestination(value: string): boolean {
  return WEBAPP_DESTINATIONS.some((option) => option.value === value);
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <label className="grid gap-1.5 text-xs text-muted">
      <span className="kicker">{label}</span>
      <input
        type="number"
        min={0}
        className="field"
        value={value ?? ""}
        placeholder="Any"
        onChange={(event) => {
          const raw = event.target.value.trim();
          onChange(raw === "" ? null : Math.max(0, Number(raw) || 0));
        }}
      />
    </label>
  );
}
