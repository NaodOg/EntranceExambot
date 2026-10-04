"use client";

import { useEffect, useState } from "react";
import { api } from "convex/_generated/api";
import type { Doc } from "convex/_generated/dataModel";
import {
  ADMIN_EMAIL,
  useAdminMutation,
  useAdminPaginatedQuery,
  useAdminQuery,
} from "@/lib/admin-client";
import { Badge, Card, EmptyState, LoadMore, PageHeader } from "@/components/admin/ui";
import {
  Ban,
  ChevronDown,
  Globe,
  RotateCcw,
  School,
  ShieldCheck,
  Star,
} from "lucide-react";

type AdminUser = Doc<"users"> & { isProActive?: boolean };

export default function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => setTerm(search.trim()), 250);
    return () => window.clearTimeout(id);
  }, [search]);

  const users = useAdminPaginatedQuery(
    api.users.listForAdmin,
    term ? { search: term } : {},
    { initialNumItems: 10 },
  );
  const tracks = useAdminQuery(api.admin.listTracks);
  const setPro = useAdminMutation(api.admin.setUserPro);
  const setBanned = useAdminMutation(api.admin.setUserBanned);
  const setTrack = useAdminMutation(api.admin.setUserTrack);
  const setLanguage = useAdminMutation(api.admin.setUserLanguage);
  const resetQuota = useAdminMutation(api.admin.resetUserQuota);

  return (
    <div className="grid gap-5">
      <PageHeader
        kicker="People"
        title="Users"
        description="Search students and manage access — Pro, track, language, quotas, and bans. Tap a student to expand."
      />

      <input
        className="field w-full sm:max-w-md"
        placeholder="Search name, telegram id, track…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {users.results.length === 0 && users.status === "Exhausted" ? (
        <EmptyState title="No students found" description="Try a different search." />
      ) : (
        <div className="grid gap-3">
          {users.results.map((user) => {
            const expanded = expandedId === user._id;
            const banned = Boolean(user.isBanned);
            return (
              <Card key={user._id} className="grid gap-3">
                <button
                  type="button"
                  className="flex w-full flex-wrap items-start justify-between gap-3 text-left"
                  onClick={() => setExpandedId(expanded ? null : user._id)}
                >
                  <span className="flex min-w-0 flex-wrap items-center gap-2">
                    <ChevronDown
                      size={16}
                      className={`shrink-0 text-muted transition-transform ${expanded ? "rotate-180" : ""}`}
                    />
                    <span className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">
                        {user.firstName ?? user.username ?? "Unnamed"}
                      </h3>
                      {user.username ? (
                        <span className="text-xs text-muted">@{user.username}</span>
                      ) : null}
                      <Badge tone={banned ? "danger" : user.isProActive ? "accent" : "muted"}>
                        {banned ? "banned" : user.isProActive ? "pro" : "free"}
                      </Badge>
                    </span>
                  </span>
                  <span className="text-right text-xs text-muted">
                    {new Date(user.lastActiveAt).toLocaleDateString()} last active
                  </span>
                </button>

                <div className="grid grid-cols-3 gap-2 text-sm">
                  <Meta label="Track" value={user.trackSlug ?? "—"} />
                  <Meta label="XP" value={user.xp} />
                  <Meta label="Streak" value={user.streakCount} />
                </div>

                {expanded ? (
                  <div className="grid gap-4 rounded-xl border border-line bg-bg/30 p-3">
                    <div className="grid gap-2 text-xs text-muted sm:grid-cols-2">
                      <Detail label="Telegram ID" value={user.telegramId} mono />
                      <Detail
                        label="Joined"
                        value={new Date(user.createdAt).toLocaleString()}
                      />
                      <Detail
                        label="Pro expires"
                        value={
                          user.proExpiresAt
                            ? new Date(user.proExpiresAt).toLocaleDateString()
                            : "—"
                        }
                      />
                      <Detail
                        label="Today's quota"
                        value={
                          user.dailyQuotaDate
                            ? `${user.dailyQuestionsUsed ?? 0} questions · ${user.dailyDuelsUsed ?? 0} duels`
                            : "not started"
                        }
                      />
                      {banned ? (
                        <Detail
                          label="Ban reason"
                          value={user.banReason ?? "No reason given"}
                        />
                      ) : null}
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        className="btn btn-ghost min-h-10 text-sm"
                        onClick={() =>
                          void setPro({
                            userId: user._id,
                            isPro: !user.isProActive,
                            adminEmail: ADMIN_EMAIL,
                          })
                        }
                      >
                        <Star size={14} /> {user.isProActive ? "Revoke Pro" : "Grant Pro"}
                      </button>
                      <button
                        type="button"
                        className={`btn min-h-10 text-sm ${
                          banned ? "btn-primary" : "btn-ghost text-danger"
                        }`}
                        onClick={() => {
                          if (banned) {
                            void setBanned({
                              userId: user._id,
                              isBanned: false,
                              adminEmail: ADMIN_EMAIL,
                            });
                            return;
                          }
                          const reason = window.prompt("Ban reason (optional — shown to the student):");
                          if (reason === null) return;
                          void setBanned({
                            userId: user._id,
                            isBanned: true,
                            reason: reason.trim() || undefined,
                            adminEmail: ADMIN_EMAIL,
                          });
                        }}
                      >
                        {banned ? <ShieldCheck size={14} /> : <Ban size={14} />}
                        {banned ? "Unban account" : "Ban account"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost min-h-10 text-sm"
                        onClick={() =>
                          void setLanguage({
                            userId: user._id,
                            language: user.language === "am" ? "en" : "am",
                            adminEmail: ADMIN_EMAIL,
                          })
                        }
                      >
                        <Globe size={14} /> Language →{" "}
                        {user.language === "am" ? "EN" : "AM"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost min-h-10 text-sm"
                        onClick={() =>
                          void resetQuota({ userId: user._id, adminEmail: ADMIN_EMAIL })
                        }
                      >
                        <RotateCcw size={14} /> Reset daily quota
                      </button>
                    </div>

                    <label className="grid gap-1.5 text-xs text-muted">
                      <span className="kicker flex items-center gap-1.5">
                        <School size={12} /> Switch track (admin override)
                      </span>
                      <select
                        className="field"
                        value={user.trackSlug ?? ""}
                        onChange={(event) => {
                          if (!event.target.value) return;
                          void setTrack({
                            userId: user._id,
                            trackSlug: event.target.value,
                            adminEmail: ADMIN_EMAIL,
                          });
                        }}
                      >
                        <option value="">
                          {user.trackSlug
                            ? `Current: ${user.trackSlug} — pick to switch`
                            : "No track — pick one"}
                        </option>
                        {(tracks ?? [])
                          .filter((d) => d.slug !== user.trackSlug)
                          .map((d) => (
                            <option key={d._id} value={d.slug}>
                              {d.nameEn}
                            </option>
                          ))}
                      </select>
                    </label>
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}

      <LoadMore status={users.status} loadMore={users.loadMore} count={users.results.length} />
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-bg/40 px-3 py-2">
      <p className="font-mono text-[10px] uppercase tracking-wider text-faint">{label}</p>
      <p className="mt-0.5 truncate font-semibold">{value}</p>
    </div>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <p>
      <span className="font-mono text-[10px] uppercase tracking-wider text-faint">
        {label}
      </span>
      <br />
      <span className={mono ? "font-mono text-ink" : "text-ink"}>{value}</span>
    </p>
  );
}