"use client";

import { Flag } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAppCopy } from "@/lib/i18n/CopyProvider";

export function ReportFlag({
  onReport,
  reported,
  embedded,
}: {
  onReport?: (reason: string) => void;
  reported?: boolean;
  embedded?: boolean;
}) {
  const t = useAppCopy();
  const reasons = [
    { value: "Wrong answer", label: t.shellReportWrongAnswer },
    { value: "Typo", label: t.shellReportTypo },
    { value: "Unclear", label: t.shellReportUnclear },
    { value: "Other", label: t.shellReportOther },
  ];
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, []);

  return (
    <div ref={root} className={embedded ? "relative" : "absolute top-1.5 right-1.5 z-10"}>
      <button
        type="button"
        aria-label={reported ? t.shellQuestionReported : t.shellReportQuestion}
        aria-expanded={open}
        onClick={() => {
          if (reported || !onReport) return;
          setOpen((value) => !value);
        }}
        className={`grid h-11 w-11 place-items-center transition-colors duration-200 ${
          reported ? "text-clay" : "text-faint hover:text-ink"
        }`}
      >
        <Flag size={18} fill={reported ? "currentColor" : "none"} />
      </button>
      {open && onReport && (
        <div className="surface absolute top-11 right-0 w-44 p-1">
          {reasons.map((reason) => (
            <button
              key={reason.value}
              type="button"
              className="block w-full px-3 py-2 text-left font-mono text-xs uppercase tracking-wider hover:bg-surface-2"
              onClick={() => {
                onReport(reason.value);
                setOpen(false);
              }}
            >
              {reason.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
