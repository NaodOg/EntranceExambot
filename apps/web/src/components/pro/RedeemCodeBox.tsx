"use client";

import { FormEvent, useEffect, useId, useState } from "react";
import { useMutation } from "@/lib/authed-convex";
import { api } from "convex/_generated/api";
import { type AppCopy, type Lang } from "@/lib/copy";
import { useAppCopy } from "@/lib/i18n/CopyProvider";
import { buzzError, buzzSuccess } from "@/lib/feedback";

function redeemMessage(error: string, t: AppCopy): string {
  if (error.includes("You already have Pro")) return t.redeemAlreadyPro;
  if (error.includes("Gift code not found")) return t.redeemNotFound;
  if (error.includes("You cannot redeem your own gift")) return t.redeemOwnGift;
  if (error.includes("This gift is still being reviewed")) return t.redeemPending;
  if (error.includes("This gift was already claimed")) return t.redeemClaimed;
  if (error.includes("This gift is no longer valid")) return t.redeemInvalid;
  return error || t.redeemFailed;
}

export function RedeemCodeBox({
  telegramId,
  language = "en",
  haptics = true,
  sound = false,
  initialCode = "",
}: {
  telegramId: string;
  language?: Lang;
  haptics?: boolean;
  sound?: boolean;
  initialCode?: string;
}) {
  const redeemGift = useMutation(api.gifts.redeem);
  const [code, setCode] = useState(initialCode);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useAppCopy(language);
  const statusId = useId();
  const inputId = useId();

  useEffect(() => {
    if (initialCode) setCode(initialCode.toUpperCase());
  }, [initialCode]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = code.trim();
    setOk(false);
    if (!trimmed) {
      buzzError(haptics, sound);
      setError(t.redeemEmpty);
      return;
    }
    try {
      setBusy(true);
      setError(null);
      await redeemGift({ telegramId, code: trimmed });
      buzzSuccess(haptics, sound);
      setOk(true);
      setCode("");
    } catch (caught) {
      buzzError(haptics, sound);
      setError(
        redeemMessage(
          caught instanceof Error ? caught.message : "",
          t,
        ),
      );
    } finally {
      setBusy(false);
    }
    
  }

  return (
    <section className="cab grid min-w-0 gap-3 overflow-hidden p-5">
      <p className="kicker">{t.redeemKicker}</p>
      <div className="min-w-0">
        <h2 className="font-mono text-sm font-semibold uppercase tracking-wider">
          {t.redeemTitle}
        </h2>
        <p className="mt-1 text-sm text-muted">{t.redeemHint}</p>
      </div>
      <form onSubmit={(event) => void onSubmit(event)} className="grid min-w-0 gap-2">
        <div className="pro-redeem-row">
          <label htmlFor={inputId} className="sr-only">
            {t.redeemPlaceholder}
          </label>
          <input
            id={inputId}
            name="giftCode"
            type="text"
            className="field min-w-0 flex-1 font-mono uppercase tracking-widest"
            value={code}
            onChange={(event) => {
              setCode(event.target.value.toUpperCase());
              setOk(false);
              if (error) setError(null);
            }}
            placeholder={t.redeemPlaceholder}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            inputMode="text"
            aria-invalid={error ? true : undefined}
            aria-describedby={error || ok ? statusId : undefined}
          />
          <button type="submit" disabled={busy} className="btn btn-primary shrink-0">
            {busy ? t.saving : t.redeemAction}
          </button>
        </div>
        {error && (
          <p
            id={statusId}
            role="alert"
            className="min-w-0 wrap-break-word font-mono text-xs uppercase tracking-wider text-danger"
          >
            {error}
          </p>
        )}
        {ok && !error && (
          <p
            id={statusId}
            role="status"
            className="min-w-0 wrap-break-word font-mono text-xs uppercase tracking-wider text-accent"
          >
            {t.redeemSuccess}
          </p>
        )}
      </form>
    </section>
  );
}
