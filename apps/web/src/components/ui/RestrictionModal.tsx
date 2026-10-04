"use client";

import { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { ArrowUpRight, Check, Lock, Sparkles, Swords, X, Zap } from "lucide-react";
import { useAppCopy } from "@/lib/i18n/CopyProvider";

export type RestrictionType =
  | "questions"
  | "duels"
  | "mistakes"
  | "pro_stage"
  | "general";

export function RestrictionModal({
  open,
  onClose,
  type = "questions",
  customTitle,
  customMessage,
  secondaryAction,
}: {
  open: boolean;
  onClose: () => void;
  type?: RestrictionType;
  customTitle?: string;
  customMessage?: string;
  secondaryAction?: {
    label: string;
    onClick: () => void;
    icon?: ReactNode;
  };
}) {
  const t = useAppCopy();

  const contentByType = {
    questions: {
      kicker: t.restrictQuestionsKicker,
      title: t.restrictQuestionsTitle,
      badge: t.restrictQuestionsBadge,
      icon: <Zap size={18} className="text-accent" />,
      desc: t.restrictQuestionsDesc,
    },
    duels: {
      kicker: t.restrictDuelsKicker,
      title: t.restrictDuelsTitle,
      badge: t.restrictDuelsBadge,
      icon: <Swords size={18} className="text-accent" />,
      desc: t.restrictDuelsDesc,
    },
    mistakes: {
      kicker: t.restrictMistakesKicker,
      title: t.restrictMistakesTitle,
      badge: t.restrictMistakesBadge,
      icon: <Lock size={18} className="text-accent" />,
      desc: t.restrictMistakesDesc,
    },
    pro_stage: {
      kicker: t.restrictProStageKicker,
      title: t.restrictProStageTitle,
      badge: t.restrictProStageBadge,
      icon: <Lock size={18} className="text-accent" />,
      desc: t.restrictProStageDesc,
    },
    general: {
      kicker: t.restrictGeneralKicker,
      title: t.restrictGeneralTitle,
      badge: t.restrictGeneralBadge,
      icon: <Sparkles size={18} className="text-accent" />,
      desc: t.restrictGeneralDesc,
    },
  } as const;

  const content = contentByType[type];
  const perks = [
    t.restrictPerk1,
    t.restrictPerk2,
    t.restrictPerk3,
    t.restrictPerk4,
    t.restrictPerk5,
  ];

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
          <button
            type="button"
            aria-label={t.shellCloseModal}
            className="absolute inset-0 bg-black/75 cursor-default"
            onClick={onClose}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={customTitle ?? content.title}
            initial={{ opacity: 0, y: 22, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className="cab relative w-full max-w-md max-h-[90dvh] overflow-y-auto p-5 text-ink shadow-2xl border-line-strong"
          >
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-accent font-bold">
                {content.icon}
                <span>▚ {content.kicker}</span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="grid h-8 w-8 place-items-center rounded border border-line text-muted hover:text-ink hover:border-accent transition-colors"
                aria-label={t.shellClose}
              >
                <X size={15} />
              </button>
            </div>

            <div className="mt-4 flex items-center justify-between rounded border border-accent/40 bg-accent/10 px-3 py-2 font-mono text-[11px] uppercase tracking-wider">
              <span className="inline-flex items-center gap-1.5 text-accent font-bold">
                <Sparkles size={12} />
                <span>{content.badge}</span>
              </span>
              <span className="font-bold text-ink">{t.shellProBadge}</span>
            </div>

            <div className="mt-4">
              <h2 className="font-mono text-2xl font-bold tracking-tight text-ink">
                {customTitle ?? content.title}
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-muted font-sans">
                {customMessage ?? content.desc}
              </p>
            </div>

            <div className="mt-4 rounded border border-line bg-surface/50 p-3">
              <span className="block font-mono text-[10px] uppercase tracking-widest text-muted">
                {t.shellProPrivileges}
              </span>
              <ul className="mt-2 grid gap-1.5 font-mono text-xs text-ink/90">
                {perks.map((perk) => (
                  <li key={perk} className="flex items-start gap-2">
                    <Check size={13} className="text-accent shrink-0 mt-0.5" />
                    <span>{perk}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-5 flex flex-col gap-2">
              <Link
                href="/app/pro"
                onClick={onClose}
                className="btn btn-primary flex w-full items-center justify-center gap-2 font-mono text-xs font-bold uppercase tracking-wider py-3"
              >
                <span>{t.restrictUpgrade}</span>
                <ArrowUpRight size={15} />
              </Link>

              {secondaryAction && (
                <button
                  type="button"
                  onClick={() => {
                    secondaryAction.onClick();
                  }}
                  className="btn btn-ghost flex w-full items-center justify-center gap-2 font-mono text-xs uppercase tracking-wider py-2.5 border border-line hover:border-ink"
                >
                  {secondaryAction.icon}
                  <span>{secondaryAction.label}</span>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="font-mono text-[11px] uppercase tracking-widest text-muted hover:text-ink text-center py-1 mt-1 transition-colors"
              >
                {t.restrictClose}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
