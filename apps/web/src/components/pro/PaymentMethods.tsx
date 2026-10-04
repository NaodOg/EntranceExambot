"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { useAppCopy } from "@/lib/i18n/CopyProvider";
import { buzzSuccess, buzzTap } from "@/lib/feedback";

type Method = "telebirr" | "cbe";

const LOGOS: Record<Method, { src: string; alt: string; className: string }> = {
  telebirr: {
    src: "/logos/telebirr.webp",
    alt: "Telebirr",
    className: "h-16 w-16",
  },
  cbe: {
    src: "/logos/cbe.png",
    alt: "CBE",
    className: "h-10 w-10",
  },
};

export function PaymentMethods({
  telebirrNumber,
  cbeNumber,
  telebirrName,
  cbeName,
  lang,
  haptics = true,
  sound = false,
}: {
  telebirrNumber?: string;
  cbeNumber?: string;
  telebirrName?: string;
  cbeName?: string;
  lang: "am" | "en";
  haptics?: boolean;
  sound?: boolean;
}) {
  const t = useAppCopy(lang);
  const [selected, setSelected] = useState<Method | null>(null);
  const [copied, setCopied] = useState(false);

  const methods = [
    {
      id: "telebirr" as const,
      label: "Telebirr",
      number: (telebirrNumber ?? "").trim(),
      name: (telebirrName ?? "").trim(),
      logo: LOGOS.telebirr,
    },
    {
      id: "cbe" as const,
      label: "CBE",
      number: (cbeNumber ?? "").trim(),
      name: (cbeName ?? "").trim(),
      logo: LOGOS.cbe,
    },
  ].filter((method) => method.number.length > 0);

  if (methods.length === 0) return null;

  const active = methods.find((method) => method.id === selected);

  async function copyNumber(number: string) {
    await navigator.clipboard.writeText(number);
    setCopied(true);
    buzzSuccess(haptics, sound);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="grid gap-3">
      <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
        {t.proPayMethodLabel}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {methods.map((method) => {
          const on = selected === method.id;
          return (
            <button
              key={method.id}
              type="button"
              onClick={() => {
                buzzTap(haptics, sound);
                setSelected(method.id);
                setCopied(false);
              }}
              className={`flex min-h-16 items-center justify-center rounded-xl border p-3 transition-all ${
                on
                  ? "border-accent bg-accent/15 shadow-[0_0_0_1px_var(--accent)]"
                  : "border-line bg-surface active:bg-surface-2"
              }`}
              aria-pressed={on}
            >
              <img
                src={method.logo.src}
                alt={method.logo.alt}
                className={`object-contain ${method.logo.className}`}
                draggable={false}
              />
            </button>
          );
        })}
      </div>

      {active ? (
        <div className="rounded-xl border border-accent/40 bg-accent/10 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 truncate font-mono text-[10px] uppercase tracking-widest text-faint">
              {active.label}
              {active.name ? <span className="text-muted"> · {active.name}</span> : null}
            </p>
            <button
              type="button"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line bg-surface text-muted transition-colors active:bg-surface-2"
              aria-label={copied ? t.proNumberCopied : t.proCopyNumber}
              onClick={() => void copyNumber(active.number)}
            >
              {copied ? <Check size={14} className="text-accent" /> : <Copy size={14} />}
            </button>
          </div>
          <p className="mt-1 break-all font-mono text-lg font-bold tracking-wide text-accent">
            {active.number}
          </p>
          <p
            className={`mt-0.5 h-4 font-mono text-[10px] uppercase tracking-widest ${
              copied ? "text-accent" : "text-transparent"
            }`}
            aria-live="polite"
          >
            {t.proNumberCopied}
          </p>
        </div>
      ) : (
        <p className="text-xs text-faint">{t.proPayTapToSelect}</p>
      )}
    </div>
  );
}