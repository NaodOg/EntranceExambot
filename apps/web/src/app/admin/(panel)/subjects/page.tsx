"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "convex/_generated/api";
import { ADMIN_EMAIL, useAdminMutation, useAdminQuery } from "@/lib/admin-client";
import { Modal } from "@/components/admin/Modal";
import { Badge, Batched, Card, EmptyState, PageHeader } from "@/components/admin/ui";
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";

type Subject = NonNullable<ReturnType<typeof useSubjects>>[number];
type Track = NonNullable<ReturnType<typeof useTracks>>[number];

const empty = {
  nameEn: "",
  nameAm: "",
  slug: "",
  maxMarks: 100,
  isProOnly: false,
  isPublished: true,
  sortOrder: 1,
  icon: "",
  accent: "",
  descriptionEn: "",
  descriptionAm: "",
};

function useTracks() {
  return useAdminQuery(api.admin.listTracks);
}

function useSubjects(trackSlug: string | undefined) {
  return useAdminQuery(
    api.admin.listSubjects,
    trackSlug ? { trackSlug } : "skip",
  );
}

function SubjectsView() {
  const params = useSearchParams();
  const requested = params.get("track") ?? undefined;
  const tracks = useTracks();

  // Until ?track= is supplied, fall back to the first published track so the
  // page is never an empty shell.
  const fallbackSlug =
    requested ?? tracks?.find((t) => t.isPublished)?.slug ?? tracks?.[0]?.slug;
  const subjects = useSubjects(fallbackSlug);

  const upsert = useAdminMutation(api.admin.upsertSubject);
  const remove = useAdminMutation(api.admin.deleteSubject);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState<string | null>(null);

  const activeTrack: Track | undefined =
    tracks?.find((t) => t.slug === fallbackSlug) ?? tracks?.[0];

  function startCreate() {
    setEditing(null);
    setForm({ ...empty, sortOrder: (subjects?.length ?? 0) + 1 });
    setOpen(true);
  }

  function startEdit(subject: Subject) {
    setEditing(subject);
    setForm({
      nameEn: subject.nameEn,
      nameAm: subject.nameAm,
      slug: subject.slug,
      maxMarks: subject.maxMarks ?? 100,
      isProOnly: subject.isProOnly,
      isPublished: subject.isPublished,
      sortOrder: subject.sortOrder,
      icon: subject.icon ?? "",
      accent: subject.accent ?? "",
      descriptionEn: subject.descriptionEn ?? "",
      descriptionAm: subject.descriptionAm ?? "",
    });
    setOpen(true);
  }

  async function onSave() {
    if (!activeTrack) {
      setError("Create a track first.");
      return;
    }
    try {
      setError(null);
      await upsert({
        id: editing?._id,
        trackSlug: activeTrack.slug,
        ...form,
        adminEmail: ADMIN_EMAIL,
      });
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  return (
    <div className="grid gap-5">
      <PageHeader
        kicker="Catalog"
        title="Subjects"
        description="Examinable subjects and the marks each one is worth. The track total is the sum of its published subjects."
        action={
          <button
            type="button"
            onClick={startCreate}
            className="btn btn-primary"
            disabled={!activeTrack}
          >
            <Plus size={16} /> New subject
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Link href="/admin/tracks" className="btn btn-ghost min-h-10 px-3">
          <ArrowLeft size={16} /> Tracks
        </Link>
        {tracks?.map((track) => (
          <Link
            key={track._id}
            href={`/admin/subjects?track=${encodeURIComponent(track.slug)}`}
            className={
              track.slug === activeTrack?.slug
                ? "btn btn-primary min-h-10 px-3"
                : "btn btn-ghost min-h-10 px-3"
            }
          >
            {track.nameEn}
          </Link>
        ))}
      </div>

      {activeTrack ? (
        <p className="text-sm text-muted">
          {activeTrack.nameEn} ·{" "}
          <span className="font-medium text-fg">
            {activeTrack.publishedSubjectCount} published ·{" "}
            {activeTrack.totalMaxMarks} marks
          </span>
        </p>
      ) : null}

      {subjects && subjects.length === 0 ? (
        <EmptyState
          title="No subjects"
          description="Add the first examinable subject for this track."
        />
      ) : (
        <Batched
          items={subjects ?? []}
          empty={<p className="py-5 text-center text-sm text-muted">Loading…</p>}
          renderItem={(subject) => (
            <Card
              key={subject._id}
              className="flex flex-wrap items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <h3 className="font-semibold">{subject.nameEn}</h3>
                <p className="text-xs text-muted">
                  {subject.nameAm} · {subject.slug}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <Badge tone="accent">{subject.maxMarks ?? 100} marks</Badge>
                  <Badge tone="muted">{subject.examCount} exams</Badge>
                  <Badge tone={subject.isPublished ? "sage" : "muted"}>
                    {subject.isPublished ? "published" : "hidden"}
                  </Badge>
                  {subject.isProOnly ? <Badge tone="accent">pro</Badge> : null}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-ghost min-h-10 px-3"
                  onClick={() => startEdit(subject)}
                >
                  <Pencil size={16} />
                </button>
                <button
                  type="button"
                  className="btn btn-ghost min-h-10 px-3 text-danger"
                  onClick={() => {
                    if (
                      window.confirm(
                        `Delete ${subject.nameEn}? This also deletes every exam inside it.`,
                      )
                    ) {
                      void remove({
                        id: subject._id,
                        adminEmail: ADMIN_EMAIL,
                        cascade: true,
                      });
                    }
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </Card>
          )}
        />
      )}

      <Modal
        open={open}
        title={editing ? "Edit subject" : "New subject"}
        onClose={() => setOpen(false)}
      >
        <div className="grid gap-3">
          <p className="text-xs text-muted">
            Track: <span className="font-medium text-fg">{activeTrack?.nameEn ?? "—"}</span>
          </p>
          <input className="field" placeholder="Name (English)" value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} />
          <input className="field" placeholder="Name (Amharic)" value={form.nameAm} onChange={(e) => setForm({ ...form, nameAm: e.target.value })} />
          <input className="field" placeholder="slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          <label className="grid gap-1 text-sm">
            <span className="text-muted">Marks</span>
            <input
              className="field"
              type="number"
              min={1}
              value={form.maxMarks}
              onChange={(e) => setForm({ ...form, maxMarks: Number(e.target.value) })}
            />
          </label>
          <input className="field" placeholder="Icon key (sigma, atom, flask...)" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} />
          <input className="field" placeholder="Accent" value={form.accent} onChange={(e) => setForm({ ...form, accent: e.target.value })} />
          <textarea className="field min-h-20" placeholder="Description EN" value={form.descriptionEn} onChange={(e) => setForm({ ...form, descriptionEn: e.target.value })} />
          <textarea className="field min-h-20" placeholder="Description AM" value={form.descriptionAm} onChange={(e) => setForm({ ...form, descriptionAm: e.target.value })} />
          <input className="field" type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm({ ...form, isPublished: e.target.checked })} /> Published
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isProOnly} onChange={(e) => setForm({ ...form, isProOnly: e.target.checked })} /> Pro only
          </label>
          {error && <p className="text-sm text-danger">{error}</p>}
          <button type="button" className="btn btn-primary" onClick={() => void onSave()}>
            Save
          </button>
        </div>
      </Modal>
    </div>
  );
}

export default function AdminSubjectsPage() {
  return (
    <Suspense fallback={<p className="py-5 text-center text-sm text-muted">Loading…</p>}>
      <SubjectsView />
    </Suspense>
  );
}