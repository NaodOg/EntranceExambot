"use client";

import { useMemo, useState } from "react";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import {
  ADMIN_EMAIL,
  useAdminMutation,
  useAdminPaginatedQuery,
  useAdminQuery,
} from "@/lib/admin-client";
import { Badge, Card, EmptyState, LoadMore, PageHeader } from "@/components/admin/ui";
import {
  QuestionEditorModal,
  type EditorQuestion,
} from "@/components/admin/QuestionEditorModal";
import { Pencil, Plus, Trash2 } from "lucide-react";

export default function AdminQuestionsPage() {
  const exams = useAdminQuery(api.admin.listExamOptions);
  const [examId, setExamId] = useState<Id<"exams"> | "">("");
  const questions = useAdminPaginatedQuery(
    api.admin.listQuestions,
    examId ? { examId } : "skip",
    { initialNumItems: 10 },
  );
  const remove = useAdminMutation(api.admin.deleteQuestion);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EditorQuestion | null>(null);

  const selectedExam = useMemo(
    () => (exams ?? []).find((exam) => exam._id === examId),
    [exams, examId],
  );

  function startCreate() {
    setEditing(null);
    setOpen(true);
  }

  function startEdit(question: EditorQuestion) {
    setEditing(question);
    setOpen(true);
  }

  return (
    <div className="grid min-w-0 gap-5">
      <PageHeader
        kicker="Bank"
        title="Questions"
        description="Pick an exam to review its questions, then edit or delete."
        action={
          <button
            type="button"
            className="btn btn-primary"
            disabled={!examId}
            onClick={startCreate}
          >
            <Plus size={16} /> New question
          </button>
        }
      />

      <select
        className="field w-full"
        value={examId}
        onChange={(e) => setExamId(e.target.value as Id<"exams">)}
      >
        <option value="">Select an exam</option>
        {(exams ?? []).map((exam) => (
          <option key={exam._id} value={exam._id}>
            {exam.subjectSlug} · {exam.titleEn ?? `${exam.year} ${exam.variant}`}
          </option>
        ))}
      </select>

      {selectedExam ? (
        <p className="font-mono text-xs text-muted">
          {selectedExam.questionCount} questions expected
        </p>
      ) : null}

      {examId ? (
        <>
          {questions.results.length === 0 && questions.status === "Exhausted" ? (
            <EmptyState title="No questions yet" description="Add the first one for this exam." />
          ) : (
            <div className="grid min-w-0 gap-3">
              {questions.results.map((question) => (
                <Card key={question._id} className="grid min-w-0 gap-2">
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <Badge tone="muted">Q{question.order}</Badge>
                        <Badge tone="accent">ans {question.correctKey}</Badge>
                        {question.chapter ? <Badge tone="muted">{question.chapter}</Badge> : null}
                        {question.isVerified ? null : <Badge tone="danger">unverified</Badge>}
                      </div>
                      <p className="mt-2 text-sm font-medium">{question.textEn}</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        aria-label="Edit question"
                        className="grid h-10 w-10 place-items-center rounded-lg border border-line-strong bg-surface active:bg-surface-2"
                        onClick={() => startEdit(question as EditorQuestion)}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        aria-label="Delete question"
                        className="grid h-10 w-10 place-items-center rounded-lg border border-line-strong bg-surface text-danger active:bg-surface-2"
                        onClick={() => {
                          if (window.confirm("Delete this question?")) {
                            void remove({ id: question._id, adminEmail: ADMIN_EMAIL });
                          }
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          <LoadMore
            status={questions.status}
            loadMore={questions.loadMore}
            count={questions.results.length}
          />
        </>
      ) : (
        <EmptyState
          title="No exam selected"
          description="Choose an exam above to load its questions."
        />
      )}

      {examId ? (
        <QuestionEditorModal
          key={editing?._id ?? "new"}
          open={open}
          onClose={() => setOpen(false)}
          examId={examId}
          question={editing}
          defaultOrder={questions.results.length + 1}
        />
      ) : null}
    </div>
  );
}
