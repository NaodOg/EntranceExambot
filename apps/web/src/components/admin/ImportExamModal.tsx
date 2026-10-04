"use client";

import { useMemo, useRef, useState } from "react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { ADMIN_EMAIL, useAdminMutation } from "@/lib/admin-client";
import { Modal } from "@/components/admin/Modal";
import { SectionTitle } from "@/components/admin/ui";
import { Check, Copy, FileJson, Upload } from "lucide-react";

export const EXAMPLE_EXAM_JSON = `[
  {
    "order": 1,
    "unit": "Algebra",
    "chapter": "Quadratic Equations",
    "text": "What is the average time complexity of a lookup in a well-balanced binary search tree?",
    "options": [
      { "key": "A", "text": "O(1)" },
      { "key": "B", "text": "O(log n)" },
      { "key": "C", "text": "O(n)" },
      { "key": "D", "text": "O(n log n)" }
    ],
    "correctKey": "B",
    "explanation": "A balanced BST halves the search space at every step, giving logarithmic lookups.",
    "isVerified": true
  }
]`;

type ParsedOption = { key: string; text: string };
type ParsedQuestion = {
  order: number;
  unit: string;
  chapter: string;
  bloomLevel?: string;
  text: string;
  options: ParsedOption[];
  correctKey: string;
  explanation: string;
  isVerified: boolean;
};

type ImportExamModalProps = {
  open: boolean;
  onClose: () => void;
  subjects:
    | Array<{ slug: string; nameEn: string; trackSlug: string }>
    | undefined;
  onImported: (message: string) => void;
};

type FormState = {
  subjectSlug: string;
  year: number;
  variant: "regular" | "model";
  title: string;
  durationMinutes: number;
  isPublished: boolean;
  isProOnly: boolean;
  mode: "create" | "merge";
};

const EMPTY_FORM: FormState = {
  subjectSlug: "",
  year: new Date().getFullYear(),
  variant: "regular",
  title: "",
  durationMinutes: 150,
  isPublished: false,
  isProOnly: false,
  mode: "create",
};

/**
 * Validates raw exam JSON on the client so obvious problems surface before
 * hitting the server. Mirrors the Convex sourcedQuestionValidator shape.
 */
function validateExamJson(raw: string): {
  questions: ParsedQuestion[];
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { questions: [], errors: ["Invalid JSON — check brackets, commas and quotes."], warnings };
  }

  const list = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && Array.isArray((parsed as { questions?: unknown }).questions)
      ? ((parsed as { questions: unknown[] }).questions)
      : null;
  if (!list) {
    return {
      questions: [],
      errors: ['Expected a JSON array of questions, or an object with a "questions" array.'],
      warnings,
    };
  }
  if (list.length === 0) {
    return { questions: [], errors: ["The questions array is empty."], warnings };
  }

  const questions: ParsedQuestion[] = [];
  list.forEach((item, index) => {
    const label = `Question ${index + 1}`;
    const q = (item ?? {}) as Record<string, unknown>;

    const text = String(q.text ?? "").trim();
    if (!text) errors.push(`${label}: "text" is required.`);

    const optionsRaw = Array.isArray(q.options) ? q.options : [];
    if (optionsRaw.length < 2) errors.push(`${label}: needs at least 2 options.`);

    const options: ParsedOption[] = [];
    const keys: string[] = [];
    optionsRaw.forEach((optionItem, optionIndex) => {
      const o = (optionItem ?? {}) as Record<string, unknown>;
      const key = String(o.key ?? "").trim().toUpperCase();
      const optionText = String(o.text ?? "").trim();
      if (!key) errors.push(`${label}: option ${optionIndex + 1} is missing "key".`);
      if (!optionText) errors.push(`${label}: option ${optionIndex + 1} is missing "text".`);
      if (keys.includes(key)) errors.push(`${label}: duplicate option key "${key}".`);
      keys.push(key);
      options.push({ key: key || "?", text: optionText });
    });

    const correctKey = String(q.correctKey ?? "").trim().toUpperCase();
    if (!correctKey) errors.push(`${label}: "correctKey" is required.`);
    else if (!keys.includes(correctKey))
      errors.push(`${label}: correctKey "${correctKey}" doesn't match any option (${keys.join(", ")}).`);

    const explanation = String(q.explanation ?? "").trim();
    if (!explanation) warnings.push(`${label}: no explanation — students will see an empty rationale.`);

    questions.push({
      order: Number.isFinite(Number(q.order)) ? Number(q.order) : index + 1,
      unit: String(q.unit ?? "").trim() || "General",
      chapter: String(q.chapter ?? "").trim() || "General",
      ...(q.bloomLevel ? { bloomLevel: String(q.bloomLevel).trim() } : {}),
      text,
      options,
      correctKey: correctKey || "?",
      explanation,
      isVerified: q.isVerified !== false,
    });
  });

  return { questions, errors, warnings };
}

export function ImportExamModal({
  open,
  onClose,
  subjects,
  onImported,
}: ImportExamModalProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [raw, setRaw] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createImport = useAdminMutation(api.admin.importSourcedExam);
  const mergeImport = useAdminMutation(api.admin.mergeSourcedExam);

  const { questions, errors, warnings } = useMemo(
    () => (open ? validateExamJson(raw) : { questions: [], errors: [], warnings: [] }),
    [open, raw],
  );

  const ready =
    raw.trim().length > 0 &&
    errors.length === 0 &&
    questions.length > 0 &&
    form.subjectSlug.length > 0 &&
    form.title.trim().length > 0 &&
    !busy;

  function onFilePicked(file: File | null) {
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setRaw(String(reader.result ?? ""));
    reader.readAsText(file);
  }

  async function submit() {
    setBusy(true);
    setServerError(null);
    try {
      const shared = {
        subjectSlug: form.subjectSlug,
        year: form.year,
        variant: form.variant,
        title: form.title.trim(),
        durationMinutes: form.durationMinutes,
        isPublished: form.isPublished,
        isProOnly: form.isProOnly,
        questions,
        adminEmail: ADMIN_EMAIL,
      };
      if (form.mode === "merge") {
        const result = (await mergeImport(shared)) as {
          createdExam: boolean;
          addedQuestions: number;
          skippedDuplicates: number;
          totalQuestions: number;
        };
        onImported(
          result.createdExam
            ? `Created exam with ${result.addedQuestions} questions.`
            : `Added ${result.addedQuestions} new questions (${result.skippedDuplicates} duplicates skipped, ${result.totalQuestions} total).`,
        );
      } else {
        const result = (await createImport(shared)) as {
          examId: Id<"exams">;
          questionCount: number;
        };
        onImported(`Imported exam with ${result.questionCount} questions.`);
      }
      setRaw("");
      setFileName(null);
      setForm(EMPTY_FORM);
      onClose();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Import exam from JSON"
      onClose={onClose}
      wide
    >
      <div className="grid gap-5">
        <SectionTitle>Exam details</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm text-muted">
            <span className="kicker">Subject</span>
            <select
              className="field"
              value={form.subjectSlug}
              onChange={(e) => setForm({ ...form, subjectSlug: e.target.value })}
            >
              <option value="">Select subject…</option>
              {(subjects ?? []).map((d) => (
                <option key={d.slug} value={d.slug}>
                  {d.nameEn}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm text-muted">
            <span className="kicker">Exam type</span>
            <select
              className="field"
              value={form.variant}
              onChange={(e) =>
                setForm({ ...form, variant: e.target.value as FormState["variant"] })
              }
            >
              <option value="regular">Past national paper</option>
              <option value="model">Mock exam (university model)</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-sm text-muted">
            <span className="kicker">Year</span>
            <input
              className="field"
              type="number"
              value={form.year}
              onChange={(e) => setForm({ ...form, year: Number(e.target.value) })}
            />
          </label>
          <label className="grid gap-1.5 text-sm text-muted">
            <span className="kicker">Duration (minutes)</span>
            <input
              className="field"
              type="number"
              value={form.durationMinutes}
              onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })}
            />
          </label>
          <label className="grid gap-1.5 text-sm text-muted sm:col-span-2">
            <span className="kicker">Title</span>
            <input
              className="field"
              placeholder="e.g. Physics 2016"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isPublished}
              onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
            />{" "}
            Publish immediately
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isProOnly}
              onChange={(e) => setForm({ ...form, isProOnly: e.target.checked })}
            />{" "}
            Pro only
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.mode === "merge"}
              onChange={(e) => setForm({ ...form, mode: e.target.checked ? "merge" : "create" })}
            />{" "}
            Merge into existing exam (skip duplicates)
          </label>
        </div>

        <SectionTitle>Questions JSON</SectionTitle>

        <div
          className="grid cursor-pointer place-items-center gap-2 rounded-xl border border-dashed border-line p-5 text-center text-sm text-muted transition-colors hover:border-accent/60"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            onFilePicked(e.dataTransfer.files?.[0] ?? null);
          }}
        >
          <FileJson size={24} />
          <p>
            {fileName ? (
              <>
                Loaded <span className="text-accent">{fileName}</span> — drop another file to
                replace
              </>
            ) : (
              <>Drop a .json file here or click to browse</>
            )}
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => onFilePicked(e.target.files?.[0] ?? null)}
          />
        </div>

        <textarea
          className="field min-h-40 font-mono text-xs"
          placeholder="…or paste exam JSON here"
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value);
            setFileName(null);
          }}
        />

        <div className="rounded-xl bg-surface-2 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-[10px] uppercase tracking-widest text-faint">
              Example format
            </p>
            <button
              type="button"
              className="btn btn-ghost min-h-8 px-2 text-[11px]"
              onClick={() => {
                void navigator.clipboard.writeText(EXAMPLE_EXAM_JSON);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <pre className="mt-2 max-h-64 overflow-auto rounded-lg border border-line bg-bg/40 p-3 font-mono text-[11px] leading-relaxed text-muted">
            {EXAMPLE_EXAM_JSON}
          </pre>
        </div>

        {raw.trim() ? (
          <div className="grid gap-2 rounded-xl border border-line p-3 text-sm">
            <p className="font-semibold">
              {errors.length === 0 && questions.length > 0
                ? `✅ ${questions.length} question${questions.length === 1 ? "" : "s"} look${questions.length === 1 ? "s" : ""} valid`
                : `❌ ${errors.length} problem${errors.length === 1 ? "" : "s"} found`}
            </p>
            {errors.slice(0, 8).map((error) => (
              <p key={error} className="text-xs text-danger">
                • {error}
              </p>
            ))}
            {errors.length > 8 ? (
              <p className="text-xs text-faint">…and {errors.length - 8} more</p>
            ) : null}
            {warnings.slice(0, 4).map((warning) => (
              <p key={warning} className="text-xs text-muted">
                ⚠ {warning}
              </p>
            ))}
          </div>
        ) : null}

        {serverError ? <p className="text-sm text-danger">{serverError}</p> : null}

        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-line bg-bg-elevated/95 py-3 backdrop-blur">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!ready}
            onClick={() => void submit()}
          >
            <Upload size={14} /> {busy ? "Importing…" : `Import ${questions.length || ""} questions`}
          </button>
        </div>
      </div>
    </Modal>
  );
}