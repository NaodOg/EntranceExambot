"use client";

import { useState } from "react";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import { ADMIN_EMAIL, useAdminMutation } from "@/lib/admin-client";
import { Modal } from "./Modal";
import { Badge } from "./ui";
import { Plus, Trash2 } from "lucide-react";

export type EditorQuestion = {
  _id: Id<"questions">;
  examId: Id<"exams">;
  order: number;
  unit: string;
  chapter: string;
  bloomLevel?: string;
  textEn: string;
  textAm: string;
  options: Array<{ key: string; textEn: string; textAm: string }>;
  correctKey: string;
  explanationEn: string;
  explanationAm: string;
  imageId?: Id<"_storage">;
  isVerified: boolean;
};

type OptionDraft = { text: string };

type Form = {
  order: number;
  unit: string;
  chapter: string;
  bloomLevel: string;
  textEn: string;
  options: OptionDraft[];
  correctIndex: number;
  explanationEn: string;
  isVerified: boolean;
};

const MAX_OPTIONS = 8;

function keyFor(index: number) {
  return String.fromCharCode(65 + index);
}

function toForm(question: EditorQuestion | null | undefined, defaultOrder: number): Form {
  if (!question) {
    return {
      order: defaultOrder,
      unit: "",
      chapter: "",
      bloomLevel: "",
      textEn: "",
      options: [
        { text: "" },
        { text: "" },
        { text: "" },
        { text: "" },
      ],
      correctIndex: 0,
      explanationEn: "",
      isVerified: true,
    };
  }
  const correctIndex = Math.max(
    0,
    question.options.findIndex((option) => option.key === question.correctKey),
  );
  return {
    order: question.order,
    unit: question.unit,
    chapter: question.chapter,
    bloomLevel: question.bloomLevel ?? "",
    textEn: question.textEn,
    options: question.options.map((option) => ({ text: option.textEn })),
    correctIndex,
    explanationEn: question.explanationEn,
    isVerified: question.isVerified,
  };
}

export function QuestionEditorModal({
  open,
  onClose,
  examId,
  question,
  defaultOrder = 1,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  examId: Id<"exams">;
  question?: EditorQuestion | null;
  defaultOrder?: number;
  onSaved?: (id: Id<"questions">) => void;
}) {
  const upsert = useAdminMutation(api.admin.upsertQuestion);
  const [form, setForm] = useState<Form>(() => toForm(question, defaultOrder));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setOption(index: number, patch: Partial<OptionDraft>) {
    setForm((prev) => {
      const options = [...prev.options];
      options[index] = { ...options[index], ...patch };
      return { ...prev, options };
    });
  }

  function addOption() {
    setForm((prev) =>
      prev.options.length >= MAX_OPTIONS
        ? prev
        : { ...prev, options: [...prev.options, { text: "" }] },
    );
  }

  function removeOption(index: number) {
    setForm((prev) => {
      if (prev.options.length <= 2) return prev;
      const options = prev.options.filter((_, i) => i !== index);
      let correctIndex = prev.correctIndex;
      if (index === prev.correctIndex) correctIndex = 0;
      else if (index < prev.correctIndex) correctIndex -= 1;
      return { ...prev, options, correctIndex };
    });
  }

  async function save() {
    if (!form.textEn.trim()) {
      setError("Question text is required");
      return;
    }
    if (form.options.some((option) => !option.text.trim())) {
      setError("Every option needs text");
      return;
    }
    setBusy(true);
    try {
      setError(null);
      const id = await upsert({
        id: question?._id,
        examId,
        order: form.order,
        unit: form.unit.trim(),
        chapter: form.chapter.trim(),
        bloomLevel: form.bloomLevel.trim() || undefined,
        textEn: form.textEn.trim(),
        textAm: "",
        options: form.options.map((option, index) => ({
          key: keyFor(index),
          textEn: option.text.trim(),
          textAm: "",
        })),
        correctKey: keyFor(form.correctIndex),
        explanationEn: form.explanationEn.trim(),
        explanationAm: "",
        imageId: question?.imageId,
        isVerified: form.isVerified,
        adminEmail: ADMIN_EMAIL,
      });
      onSaved?.(id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} title={question ? "Edit question" : "New question"} onClose={onClose}>
      <div className="grid min-w-0 gap-3">
        <div className="grid grid-cols-3 gap-2">
          <Field label="Order">
            <input
              className="field min-w-0"
              type="number"
              value={form.order}
              onChange={(e) => setForm({ ...form, order: Number(e.target.value) })}
            />
          </Field>
          <Field label="Unit">
            <input
              className="field min-w-0"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
            />
          </Field>
          <Field label="Chapter">
            <input
              className="field min-w-0"
              value={form.chapter}
              onChange={(e) => setForm({ ...form, chapter: e.target.value })}
            />
          </Field>
        </div>

        <Field label="Question">
          <textarea
            className="field min-h-24 min-w-0"
            value={form.textEn}
            onChange={(e) => setForm({ ...form, textEn: e.target.value })}
          />
        </Field>

        <div className="grid min-w-0 gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
              Options · tap the circle to set the answer
            </span>
            <button
              type="button"
              onClick={addOption}
              disabled={form.options.length >= MAX_OPTIONS}
              className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-line-strong px-2.5 text-[11px] font-semibold uppercase tracking-wide disabled:opacity-40"
            >
              <Plus size={13} /> Option
            </button>
          </div>

          {form.options.map((option, index) => {
            const isCorrect = form.correctIndex === index;
            return (
              <div
                key={index}
                className={`grid min-w-0 gap-2 rounded-lg border p-2.5 ${
                  isCorrect ? "border-accent/60 bg-accent/5" : "border-line bg-bg/30"
                }`}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, correctIndex: index })}
                    aria-label={`Mark ${keyFor(index)} correct`}
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px] font-bold ${
                      isCorrect ? "border-accent bg-accent text-accent-ink" : "border-line-strong text-muted"
                    }`}
                  >
                    {keyFor(index)}
                  </button>
                  {isCorrect ? <Badge tone="accent">answer</Badge> : null}
                  <span className="flex-1" />
                  <button
                    type="button"
                    onClick={() => removeOption(index)}
                    disabled={form.options.length <= 2}
                    aria-label={`Remove option ${keyFor(index)}`}
                    className="grid h-8 w-8 place-items-center rounded-lg text-danger disabled:opacity-30"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <input
                  className="field min-h-10! min-w-0 text-sm!"
                  placeholder={`Option ${keyFor(index)}`}
                  value={option.text}
                  onChange={(e) => setOption(index, { text: e.target.value })}
                />
              </div>
            );
          })}
        </div>

        <Field label="Explanation">
          <textarea
            className="field min-h-20 min-w-0"
            value={form.explanationEn}
            onChange={(e) => setForm({ ...form, explanationEn: e.target.value })}
          />
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Bloom level">
            <input
              className="field min-h-10! min-w-0 text-sm!"
              value={form.bloomLevel}
              onChange={(e) => setForm({ ...form, bloomLevel: e.target.value })}
            />
          </Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input
              type="checkbox"
              checked={form.isVerified}
              onChange={(e) => setForm({ ...form, isVerified: e.target.checked })}
            />
            Verified
          </label>
        </div>

        {question?.imageId ? (
          <p className="text-xs text-muted">This question has an image; it will be kept.</p>
        ) : null}
        {error ? <p className="break-words text-sm text-danger">{error}</p> : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-primary min-h-10!"
            disabled={busy}
            onClick={() => void save()}
          >
            {busy ? "Saving…" : "Save question"}
          </button>
          <button type="button" className="btn btn-ghost min-h-10!" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid min-w-0 gap-1 text-[11px] uppercase tracking-wider text-muted">
      {label}
      {children}
    </label>
  );
}
