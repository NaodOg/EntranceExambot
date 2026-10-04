"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { api } from "convex/_generated/api";
import {
  ADMIN_EMAIL,
  useAdminMutation,
  useAdminPaginatedQuery,
  useAdminQuery,
} from "@/lib/admin-client";
import {
  Badge,
  Card,
  EmptyState,
  LoadMore,
  PageHeader,
  SectionTitle,
} from "@/components/admin/ui";
import {
  QuestionEditorModal,
  type EditorQuestion,
} from "@/components/admin/QuestionEditorModal";
import { Check, Pencil, Sparkles, Trash2, X } from "lucide-react";

type ReportStatus = "open" | "resolved" | "dismissed";
type Filter = ReportStatus | "all";

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
  { value: "dismissed", label: "Dismissed" },
  { value: "all", label: "All" },
];

function fmt(value: number | undefined) {
  return value !== undefined ? value.toLocaleString() : "—";
}

function MetricRow({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | undefined;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line/80 py-2 last:border-0 last:pb-0 first:pt-0">
      <div className="min-w-0">
        <span className="text-sm text-muted">{label}</span>
        {hint ? <p className="text-[11px] text-faint">{hint}</p> : null}
      </div>
      <span className="shrink-0 font-display text-xl tabular-nums leading-none">{fmt(value)}</span>
    </div>
  );
}

function SnapshotColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-w-0 px-0 py-3 first:pt-0 last:pb-0 sm:px-4 sm:py-0">
      <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-faint">{title}</p>
      {children}
    </div>
  );
}

export default function AdminReportsPage() {
  const nowMs = useMemo(() => Date.now(), []);
  const stats = useAdminQuery(api.users.getStats, { nowMs });
  const reconcileStats = useAdminMutation(api.users.reconcileAppStats);
  const [reconciling, setReconciling] = useState(false);
  const audit = useAdminQuery(api.admin.listAudit, { limit: 10 });

  const [filter, setFilter] = useState<Filter>("open");
  const reports = useAdminPaginatedQuery(
    api.admin.listReports,
    filter === "all" ? {} : { status: filter },
    { initialNumItems: 10 },
  );

  const resolve = useAdminMutation(api.admin.resolveReport);
  const resolveAll = useAdminMutation(api.admin.resolveQuestionReports);
  const deleteQuestion = useAdminMutation(api.admin.deleteReportedQuestion);

  const [editing, setEditing] = useState<EditorQuestion | null>(null);

  async function onReconcileCounters() {
    setReconciling(true);
    try {
      await reconcileStats({});
    } finally {
      setReconciling(false);
    }
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        kicker="Quality"
        title="Flagged questions"
        description="Review what students flagged. Fix the question, then resolve — the reporter gets a Telegram notification automatically."
      />

      <section className="grid min-w-0 gap-3 sm:grid-cols-2">
        <Card
          className={`flex items-center justify-between gap-4 ${
            (stats?.openReports ?? 0) > 0 ? "border-accent/40" : ""
          }`}
        >
          <div>
            <p className="kicker">Needs review</p>
            <p className="font-display mt-1 text-4xl tabular-nums leading-none">
              {fmt(stats?.openReports)}
            </p>
            <p className="mt-1 text-sm text-muted">Open flagged questions</p>
          </div>
          <p className="hidden text-right text-xs text-muted sm:block">
            {fmt(stats?.resolvedReports)} resolved
            <br />
            {fmt(stats?.dismissedReports)} dismissed
          </p>
        </Card>

        <Link href="/admin/premium" className="block">
          <Card
            className={`flex h-full items-center justify-between gap-4 transition-colors hover:border-accent/40 ${
              (stats?.pendingPremium ?? 0) > 0 ? "border-accent/30" : ""
            }`}
          >
            <div>
              <p className="kicker">Premium</p>
              <p className="font-display mt-1 text-4xl tabular-nums leading-none">
                {fmt(stats?.pendingPremium)}
              </p>
              <p className="mt-1 text-sm text-muted">Awaiting approval</p>
            </div>
            <span className="grid h-11 w-11 place-items-center rounded-lg bg-surface-2 text-accent">
              <Sparkles size={20} />
            </span>
          </Card>
        </Link>
      </section>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="kicker">Snapshot</p>
            <p className="mt-0.5 text-xs text-muted">
              Totals from counters; activity uses indexed scans (not full-table reads).
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost text-xs"
            disabled={reconciling}
            onClick={() => void onReconcileCounters()}
          >
            {reconciling ? "Reconciling…" : "Reconcile counters"}
          </button>
        </div>
        <div className="mt-4 grid min-w-0 divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <SnapshotColumn title="Students">
            <MetricRow label="Registered" value={stats?.totalUsers} />
            <MetricRow label="Pro active" value={stats?.proUsers} />
            <MetricRow label="New today" value={stats?.newUsersToday} />
            <MetricRow label="Active today" value={stats?.activeToday} />
            <MetricRow label="Active 7 days" value={stats?.activeWeek} />
          </SnapshotColumn>
          <SnapshotColumn title="Content">
            <MetricRow
              label="Published exams"
              value={stats?.publishedExams}
              hint={stats ? `${fmt(stats.exams)} in catalog` : undefined}
            />
            <MetricRow
              label="Live questions"
              value={stats?.publishedQuestions}
              hint={stats ? `${fmt(stats.questions)} in bank` : undefined}
            />
            <MetricRow
              label="Published tracks"
              value={stats?.publishedTracks}
              hint={stats ? `${fmt(stats.tracks)} total` : undefined}
            />
          </SnapshotColumn>
          <SnapshotColumn title="Activity">
            <MetricRow label="Attempts today" value={stats?.attemptsToday} />
            <MetricRow label="Attempts all time" value={stats?.attempts} />
          </SnapshotColumn>
        </div>
      </Card>

      <section className="flex min-w-0 flex-wrap items-center gap-1.5 rounded-xl border border-line-strong bg-surface/60 p-1">
        {FILTERS.map((option) => {
          const active = filter === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilter(option.value)}
              className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                active ? "bg-accent text-accent-ink" : "text-muted hover:bg-surface-2 hover:text-ink"
              }`}
            >
              {option.label}
              {option.value !== "all" ? (
                <span className={`font-mono text-[10px] ${active ? "opacity-70" : "text-faint"}`}>
                  {option.value === "open"
                    ? (stats?.openReports ?? 0)
                    : option.value === "resolved"
                      ? (stats?.resolvedReports ?? 0)
                      : (stats?.dismissedReports ?? 0)}
                </span>
              ) : (
                <span className={`font-mono text-[10px] ${active ? "opacity-70" : "text-faint"}`}>
                  {stats?.totalReports ?? 0}
                </span>
              )}
            </button>
          );
        })}
      </section>

      {reports.results.length === 0 && reports.status === "Exhausted" ? (
        <EmptyState
          title={filter === "open" ? "No open reports" : "Nothing here"}
          description={
            filter === "open"
              ? "Students haven’t flagged any questions."
              : "No reports with this status."
          }
        />
      ) : (
        <div className="grid min-w-0 gap-3">
          {reports.results.map((report) => {
            const question = report.question;
            const isOpen = report.status === "open";
            const reporterName =
              report.user?.firstName ?? report.reporterUsername ?? "Unknown";
            const reporterHandle =
              report.reporterUsername ?? report.user?.username ?? null;
            const reporterTelegram =
              report.reporterTelegramId ?? report.user?.telegramId ?? null;
            return (
              <Card key={report._id} className="grid min-w-0 gap-3">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <Badge tone={isOpen ? "danger" : "muted"}>{report.status}</Badge>
                  <span className="text-xs text-muted">
                    {report.createdAt ? new Date(report.createdAt).toLocaleString() : ""}
                  </span>
                </div>

                <div className="rounded-lg border border-line bg-bg/30 p-2.5">
                  <p className="text-[11px] uppercase tracking-wider text-muted">
                    Student’s reason
                  </p>
                  <p className="mt-0.5 text-sm">{report.reason}</p>
                  <p className="mt-1 text-xs text-muted">
                    {reporterName}
                    {reporterHandle ? (
                      <a
                        href={`https://t.me/${reporterHandle}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-accent hover:underline"
                      >
                        {" "}
                        @{reporterHandle}
                      </a>
                    ) : null}
                    {reporterTelegram ? (
                      <span className="text-faint"> · TG {reporterTelegram}</span>
                    ) : null}
                    {report.notifiedAt ? (
                      <span className="text-sage"> · notified ✓</span>
                    ) : null}
                  </p>
                  {report.note ? (
                    <p className="mt-1 text-xs text-accent">Note: {report.note}</p>
                  ) : null}
                </div>

                {question ? (
                  <QuestionPreview
                    question={question}
                    onEdit={() => setEditing(question as EditorQuestion)}
                  />
                ) : (
                  <p className="text-sm text-muted">Deleted question</p>
                )}

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {question ? (
                    <button
                      type="button"
                      onClick={() => setEditing(question as EditorQuestion)}
                      className="inline-flex min-h-10 min-w-0 items-center justify-center gap-1.5 overflow-hidden rounded-lg border border-line-strong bg-surface px-2 text-[11px] font-semibold uppercase tracking-wide active:bg-surface-2"
                    >
                      <Pencil size={14} /> <span className="truncate">Edit</span>
                    </button>
                  ) : null}
                  {question ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          window.confirm(
                            "Delete this question permanently and close its reports?",
                          )
                        ) {
                          void deleteQuestion({
                            questionId: question._id,
                            adminEmail: ADMIN_EMAIL,
                          });
                        }
                      }}
                      className="inline-flex min-h-10 min-w-0 items-center justify-center gap-1.5 overflow-hidden rounded-lg border border-line-strong bg-surface px-2 text-[11px] font-semibold uppercase tracking-wide text-danger active:bg-surface-2"
                    >
                      <Trash2 size={14} /> <span className="truncate">Delete</span>
                    </button>
                  ) : null}
                  {isOpen ? (
                    <button
                      type="button"
                      onClick={() =>
                        void resolve({
                          id: report._id,
                          status: "resolved",
                          adminEmail: ADMIN_EMAIL,
                        })
                      }
                      className="inline-flex min-h-10 min-w-0 items-center justify-center gap-1.5 overflow-hidden rounded-lg bg-accent px-2 text-[11px] font-semibold uppercase tracking-wide text-accent-ink"
                    >
                      <Check size={14} /> <span className="truncate">Resolve & notify</span>
                    </button>
                  ) : null}
                  {isOpen ? (
                    <button
                      type="button"
                      onClick={() =>
                        void resolve({
                          id: report._id,
                          status: "dismissed",
                          adminEmail: ADMIN_EMAIL,
                        })
                      }
                      className="inline-flex min-h-10 min-w-0 items-center justify-center gap-1.5 overflow-hidden rounded-lg border border-line-strong bg-surface px-2 text-[11px] font-semibold uppercase tracking-wide text-muted active:bg-surface-2"
                    >
                      <X size={14} /> <span className="truncate">Dismiss</span>
                    </button>
                  ) : null}
                </div>

                {question ? (
                  <button
                    type="button"
                    onClick={() =>
                      void resolveAll({
                        questionId: question._id,
                        status: "resolved",
                        adminEmail: ADMIN_EMAIL,
                      })
                    }
                    className="justify-self-start text-[11px] font-semibold uppercase tracking-wide text-accent hover:underline"
                  >
                    Resolve all & notify reporters
                  </button>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}

      <LoadMore
        status={reports.status}
        loadMore={reports.loadMore}
        count={reports.results.length}
      />

      <section className="grid gap-3">
        <SectionTitle>Recent activity</SectionTitle>
        <Card className="grid gap-2">
          {(audit ?? []).length === 0 ? (
            <p className="text-sm text-muted">No activity yet.</p>
          ) : (
            (audit ?? []).map((item) => (
              <div
                key={item._id}
                className="flex items-center justify-between gap-3 border-b border-line py-1.5 text-sm last:border-0"
              >
                <span className="font-mono text-xs font-semibold">{item.action}</span>
                <span className="text-xs text-muted">
                  {new Date(item.createdAt).toLocaleString()}
                </span>
              </div>
            ))
          )}
        </Card>
      </section>

      {editing ? (
        <QuestionEditorModal
          key={editing._id}
          open={editing !== null}
          onClose={() => setEditing(null)}
          examId={editing.examId}
          question={editing}
        />
      ) : null}
    </div>
  );
}

function QuestionPreview({
  question,
  onEdit,
}: {
  question: EditorQuestion;
  onEdit: () => void;
}) {
  return (
    <div className="grid min-w-0 gap-2">
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <Badge tone="muted">Q{question.order}</Badge>
        {question.unit ? <Badge tone="muted">{question.unit}</Badge> : null}
        {question.chapter ? <Badge tone="muted">{question.chapter}</Badge> : null}
        <Badge tone={question.isVerified ? "sage" : "danger"}>
          {question.isVerified ? "verified" : "unverified"}
        </Badge>
      </div>
      <p className="text-sm font-medium">{question.textEn}</p>
      <div className="grid gap-1">
        {question.options.map((option) => {
          const correct = option.key === question.correctKey;
          return (
            <div
              key={option.key}
              className={`flex min-w-0 items-start gap-2 rounded-lg border px-2.5 py-1.5 text-sm ${
                correct ? "border-sage/50 bg-sage/5" : "border-line bg-bg/30"
              }`}
            >
              <span className="shrink-0 font-mono text-xs font-bold">{option.key}</span>
              <span className="min-w-0 flex-1">{option.textEn}</span>
              {correct ? <Check size={14} className="mt-0.5 shrink-0 text-sage" /> : null}
            </div>
          );
        })}
      </div>
      {question.explanationEn ? (
        <p className="text-xs text-muted">Explanation: {question.explanationEn}</p>
      ) : null}
      <button
        type="button"
        onClick={onEdit}
        className="justify-self-start text-[11px] font-semibold uppercase tracking-wide text-accent hover:underline"
      >
        Edit this question
      </button>
    </div>
  );
}
