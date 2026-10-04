"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { ReportFlag } from "@/components/questions/ReportFlag";
import { optionTone, QuestionCardProps } from "@/components/questions/types";
import { useAppCopy } from "@/lib/i18n/CopyProvider";

function stem(props: QuestionCardProps) {
  return props.question.textEn;
}

function optText(props: QuestionCardProps, key: string) {
  const option = props.question.options.find((item) => item.key === key);
  if (!option) return "";
  return option.textEn;
}

function why(props: QuestionCardProps) {
  return props.question.explanationEn;
}

function reveal(props: QuestionCardProps) {
  return Boolean(props.instant && props.selected);
}

function rowTone(tone: ReturnType<typeof optionTone>) {
  if (tone === "correct") return "bg-sage/14";
  if (tone === "wrong") return "bg-danger/12";
  if (tone === "selected") return "q-option-selected";
  return "";
}

function Mark({
  letter,
  tone,
}: {
  letter: string;
  tone: ReturnType<typeof optionTone>;
}) {
  return (
    <span
      className={`grid h-7 w-7 shrink-0 place-items-center border text-xs font-bold transition-colors duration-200 ${
        tone === "idle"
          ? "border-line-strong bg-transparent"
          : tone === "selected"
            ? "border-accent bg-accent/20 text-accent"
            : tone === "wrong"
              ? "border-danger bg-danger text-white"
              : "border-transparent bg-accent text-accent-ink"
      }`}
    >
      {tone === "correct" ? (
        <Check size={13} />
      ) : tone === "wrong" ? (
        <X size={13} />
      ) : (
        letter
      )}
    </span>
  );
}

export function QuestionLedger(props: QuestionCardProps) {
  const t = useAppCopy();
  const shown = reveal(props);
  const questionText = stem(props);
  const compactText =
    questionText.length > 320
      ? "text-sm leading-relaxed"
      : questionText.length > 180
        ? "text-base leading-relaxed"
        : "";
  const questionTextClass = compactText || "text-lg leading-snug";
  return (
    <section className="cab relative">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-faint">{t.shellItem}</p>
          <p className="text-xs font-semibold text-accent">{props.question.unit}</p>
        </div>
        <ReportFlag onReport={props.onReport} reported={props.reported} embedded />
      </header>
      <div className="border-b border-line px-4 py-4">
        <h2 className={`font-semibold ${questionTextClass}`}>{questionText}</h2>
        {props.question.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={props.question.imageUrl} alt="" className="mt-3 max-h-40 w-full object-contain" />
        )}
      </div>
      <div>
        {props.question.options.map((option, index) => {
          const tone = optionTone(
            props.selected,
            option.key,
            props.question.correctKey,
            reveal(props),
          );
          const dim = shown && tone === "idle";
          return (
            <button
              key={option.key}
              type="button"
              disabled={props.locked && Boolean(props.selected)}
              onClick={() => props.onSelect(option.key)}
              className={`flex min-h-14 w-full items-center gap-3 border-t border-line px-4 text-left transition-colors duration-200 first:border-t-0 disabled:cursor-default ${rowTone(tone)} ${
                dim ? "opacity-40" : "opacity-100"
              }`}
            >
              <span className="font-mono w-6 text-[11px] text-faint">
                {String(index + 1).padStart(2, "0")}
              </span>
              <Mark letter={option.key} tone={tone} />
              <span className={`flex-1 ${compactText}`}>{optText(props, option.key)}</span>
            </button>
          );
        })}
      </div>
      <AnimatePresence>
        {shown && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="border-t border-dashed border-line px-4 py-4"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">{t.shellNote}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">{why(props)}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
