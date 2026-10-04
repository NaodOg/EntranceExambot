"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useAppCopy } from "@/lib/i18n/CopyProvider";

export function TimeoutModal({
  open,
  answered,
  total,
  submitting,
  onContinue,
  copy,
}: {
  open: boolean;
  answered: number;
  total: number;
  submitting?: boolean;
  onContinue: () => void;
  copy: {
    timeUp: string;
    pencilsDown: string;
    timeUpBody: string;
    seeResults: string;
    posting: string;
  };
}) {
  const t = useAppCopy();
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <div className="absolute inset-0 bg-black/80" />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="timeout-title"
            initial={{ opacity: 0, y: 22, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className="timeout-cab cab relative w-full max-w-md p-5 shadow-2xl"
          >
            <p className="kicker">▚ {copy.timeUp}</p>
            <div className="timeout-stamp" aria-hidden>
              00:00
            </div>
            <h2 id="timeout-title" className="font-mono mt-2 text-3xl font-bold tracking-wide">
              {copy.pencilsDown}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">{copy.timeUpBody}</p>
            <p className="timeout-tally">
              <b>{answered}</b>
              <span>{t.shellLockedIn.replace("{total}", String(total))}</span>
            </p>
            <button
              type="button"
              disabled={submitting}
              onClick={onContinue}
              className="btn btn-primary mt-5 w-full"
            >
              {submitting ? copy.posting : copy.seeResults}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
