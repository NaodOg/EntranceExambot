"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "convex/_generated/api";
import { ADMIN_EMAIL, useAdminMutation, useAdminQuery } from "@/lib/admin-client";
import { Modal } from "@/components/admin/Modal";
import { Badge, Batched, Card, EmptyState, PageHeader } from "@/components/admin/ui";
import { ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";

const empty = {
  nameEn: "",
  nameAm: "",
  slug: "",
  isProOnly: false,
  isPublished: true,
  sortOrder: 1,
  icon: "atom",
  accent: "azure",
  descriptionEn: "",
  descriptionAm: "",
};

export default function AdminTracksPage() {
  const tracks = useAdminQuery(api.admin.listTracks);
  const upsert = useAdminMutation(api.admin.upsertTrack);
  const remove = useAdminMutation(api.admin.deleteTrack);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<NonNullable<typeof tracks>[number] | null>(null);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState<string | null>(null);

  function startCreate() {
    setEditing(null);
    setForm({ ...empty, sortOrder: (tracks?.length ?? 0) + 1 });
    setOpen(true);
  }

  function startEdit(track: NonNullable<typeof tracks>[number]) {
    setEditing(track);
    setForm({
      nameEn: track.nameEn,
      nameAm: track.nameAm,
      slug: track.slug,
      isProOnly: track.isProOnly,
      isPublished: track.isPublished,
      sortOrder: track.sortOrder,
      icon: track.icon ?? "atom",
      accent: track.accent ?? "azure",
      descriptionEn: track.descriptionEn ?? "",
      descriptionAm: track.descriptionAm ?? "",
    });
    setOpen(true);
  }

  async function onSave() {
    try {
      setError(null);
      await upsert({ id: editing?._id, ...form, adminEmail: ADMIN_EMAIL });
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  return (
    <div className="grid gap-5">
      <PageHeader
        kicker="Catalog"
        title="Tracks"
        description="Study tracks students browse, e.g. Natural Science and Social Science."
        action={
          <button type="button" onClick={startCreate} className="btn btn-primary">
            <Plus size={16} /> New track
          </button>
        }
      />

      {tracks && tracks.length === 0 ? (
        <EmptyState
          title="No tracks"
          description="Create a track, then add its examinable subjects."
        />
      ) : (
        <Batched
          items={tracks ?? []}
          empty={<p className="py-5 text-center text-sm text-muted">Loading…</p>}
          renderItem={(track) => (
            <Card key={track._id} className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-semibold">{track.nameEn}</h3>
                <p className="text-xs text-muted">
                  {track.nameAm} · {track.slug}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <Badge tone="muted">
                    {track.subjectCount} subject{track.subjectCount === 1 ? "" : "s"}
                  </Badge>
                  <Badge tone="muted">{track.examCount} exams</Badge>
                  <Badge tone="accent">{track.totalMaxMarks} marks</Badge>
                  <Badge tone={track.isPublished ? "sage" : "muted"}>
                    {track.isPublished ? "published" : "hidden"}
                  </Badge>
                  {track.isProOnly ? <Badge tone="accent">pro</Badge> : null}
                </div>
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/admin/subjects?track=${encodeURIComponent(track.slug)}`}
                  className="btn btn-ghost min-h-10 px-3"
                  title={`Manage ${track.nameEn} subjects`}
                >
                  <ChevronRight size={16} />
                </Link>
                <button
                  type="button"
                  className="btn btn-ghost min-h-10 px-3"
                  onClick={() => startEdit(track)}
                >
                  <Pencil size={16} />
                </button>
                <button
                  type="button"
                  className="btn btn-ghost min-h-10 px-3 text-danger"
                  onClick={() => {
                    if (
                      window.confirm(
                        `Delete ${track.nameEn}? This also deletes its subjects and every exam inside them.`,
                      )
                    ) {
                      void remove({ id: track._id, adminEmail: ADMIN_EMAIL, cascade: true });
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
        title={editing ? "Edit track" : "New track"}
        onClose={() => setOpen(false)}
      >
        <div className="grid gap-3">
          <input className="field" placeholder="Name (English)" value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} />
          <input className="field" placeholder="Name (Amharic)" value={form.nameAm} onChange={(e) => setForm({ ...form, nameAm: e.target.value })} />
          <input className="field" placeholder="slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          <input className="field" placeholder="Icon key (atom, landmark...)" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} />
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