"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@/lib/authed-convex";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import { ArrowUpRight, ChevronDown, RotateCcw, Swords, Target, Zap } from "lucide-react";
import { buildGiftTelegramShareLink } from "@/lib/bot-links";
import { useAppCopy } from "@/lib/i18n/CopyProvider";
import { fillTemplate } from "@/lib/i18n/merge";
import { buzzCoin, buzzError, buzzSuccess, buzzTap } from "@/lib/feedback";
import { PaymentMethods } from "@/components/pro/PaymentMethods";

type Profile = {
  firstName?: string;
  username?: string;
  trackSlug?: string;
  subjectSlugs?: string[];
  language?: "am" | "en";
  hapticsEnabled?: boolean;
  soundEnabled?: boolean;
  proExpiresAt?: number;
};

export function ProLocker({
  telegramId,
  profile,
  price,
  seasonEnd,
  payNote,
  telebirrNumber,
  cbeNumber,
  telebirrName,
  cbeName,
}: {
  telegramId: string;
  profile: Profile;
  price: number;
  seasonEnd?: number;
  payNote: string;
  telebirrNumber?: string;
  cbeNumber?: string;
  telebirrName?: string;
  cbeName?: string;
}) {
  const lang = profile.language ?? "en";
  const t = useAppCopy(lang);
  const gifts = useQuery(api.gifts.listMine, { telegramId });
  const generateUploadUrl = useMutation(api.premium.generateUploadUrl);
  const submitRequest = useMutation(api.premium.submitRequest);
  const [giftOpen, setGiftOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const haptics = profile.hapticsEnabled ?? true;
  const sound = profile.soundEnabled ?? false;
  const subjects = useQuery(
    api.exams.listPublishedSubjects,
    profile.trackSlug ? { trackSlug: profile.trackSlug } : "skip",
  );
  const subject =
    profile.subjectSlugs?.find((slug) =>
      (subjects ?? []).some((row) => row.slug === slug),
    ) ?? subjects?.[0]?.slug ?? "";
  const locale = lang === "am" ? "am-ET" : "en-GB";
  const untilRaw = seasonEnd
    ? new Date(seasonEnd).toLocaleDateString(locale, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : t.proSeasonEndFallback;
  const untilLabel = fillTemplate(t.proUntilDate, { date: untilRaw.toUpperCase() });

  const heroBenefits = useMemo(
    () => [
      {
        id: "mock",
        title: t.proHeroExamTitle,
        kicker: t.proHeroExamKicker,
        sub: t.proHeroExamSub,
        href: (s: string) => `/app/exam?subject=${s}`,
        icon: Target,
        actionLabel: t.proHeroExamCta,
      },
      {
        id: "quick",
        title: t.proHeroQuickTitle,
        kicker: t.proHeroQuickKicker,
        sub: t.proHeroQuickSub,
        href: (s: string) => `/app/exam?subject=${s}&mode=quick`,
        icon: Zap,
        actionLabel: t.proHeroQuickCta,
      },
      {
        id: "mistakes",
        title: t.proHeroMistakesTitle,
        kicker: t.proHeroMistakesKicker,
        sub: t.proHeroMistakesSub,
        href: () => "/app/mistakes",
        icon: RotateCcw,
        actionLabel: t.proHeroMistakesCta,
      },
      {
        id: "duel",
        title: t.proHeroDuelTitle,
        kicker: t.proHeroDuelKicker,
        sub: t.proHeroDuelSub,
        href: () => "/app/duel",
        icon: Swords,
        actionLabel: t.proHeroDuelCta,
      },
    ],
    [t],
  );

  const pendingGift = (gifts ?? []).find((g) => g.status === "pending");
  const readyGifts = (gifts ?? []).filter((g) => g.status === "ready");

  async function onGift(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fileInput = form.elements.namedItem("proof") as HTMLInputElement;
    const file = fileInput.files?.[0];
    if (!file) {
      buzzError(haptics, sound);
      setMessage(t.proGiftAttach);
      return;
    }
    try {
      setUploading(true);
      buzzCoin(haptics, sound);
      const uploadUrl = await generateUploadUrl({});
      const uploadResult = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const { storageId } = (await uploadResult.json()) as { storageId: Id<"_storage"> };
      await submitRequest({
        telegramId,
        proofFileId: storageId,
        kind: "gift",
      });
      buzzSuccess(haptics, sound);
      setMessage(t.proGiftSubmitted);
      form.reset();
    } catch (error) {
      buzzError(haptics, sound);
      setMessage(error instanceof Error ? error.message : t.proUploadFailed);
    } finally {
      setUploading(false);
    }
  }

  async function copyCode(code: string) {
    await navigator.clipboard.writeText(code);
    setCopied(code);
    buzzTap(haptics, sound);
    window.setTimeout(() => setCopied(null), 1400);
  }

  return (
    <article className="pro-lock">
      <header className="pro-hero-hud cab" aria-label={t.proStatusSr}>
        <h1 className="sr-only">{t.proBenefitsSr}</h1>
        <div className="pro-hero-hud-top">
          <div className="pro-hero-pill">
            <span className="pro-hero-beacon" aria-hidden />
            <span>{t.proAccessUnlocked}</span>
          </div>
          <span className="pro-hero-until">{untilLabel}</span>
        </div>
        <p className="pro-hero-desc">{t.proMemberDesc}</p>
      </header>

      <section className="pro-hero-grid" aria-label={t.proBenefitsSr}>
        {heroBenefits.map((item) => (
          <Link
            key={item.id}
            href={item.href(subject)}
            className={`pro-hero-card pro-hero-card-${item.id} cab`}
            onClick={() => buzzTap(haptics, sound)}
          >
            <div className="pro-hero-card-head">
              <div className="pro-hero-chip">
                <item.icon size={20} strokeWidth={2} />
              </div>
              <span className="pro-hero-badge">{item.kicker}</span>
            </div>

            <div className="pro-hero-card-body">
              <h2 className="pro-hero-card-title">{item.title}</h2>
              <p className="pro-hero-card-sub">{item.sub}</p>
            </div>

            <div className="pro-hero-card-foot">
              <span className="pro-hero-cta">{item.actionLabel}</span>
              <ArrowUpRight size={14} className="pro-hero-cta-icon" />
            </div>
          </Link>
        ))}
      </section>

      <section className="pro-lock-gift cab">
        <button
          type="button"
          className="pro-lock-gift-toggle"
          aria-expanded={giftOpen}
          onClick={() => {
            buzzTap(haptics, sound);
            setGiftOpen((open) => !open);
          }}
        >
          <span>
            <span className="kicker block">{t.proGiftKicker}</span>
            <span className="pro-lock-gift-title">{t.proGiftTitle}</span>
          </span>
          <ChevronDown
            size={16}
            className={`pro-lock-chevron ${giftOpen ? "is-open" : ""}`}
          />
        </button>

        {giftOpen && (
          <div className="pro-lock-gift-body">
            <p className="pro-lock-gift-copy">
              {fillTemplate(t.proGiftPayCopy, { price })}
            </p>

            {readyGifts.length > 0 && (
              <ul className="pro-lock-codes">
                {readyGifts.map((gift) => (
                  <li key={gift._id}>
                    <div>
                      <b>{gift.code}</b>
                      <small>
                        {gift.recipientUsername
                          ? `@${gift.recipientUsername}`
                          : t.proGiftOpenCode}
                      </small>
                    </div>
                    <div className="pro-lock-code-actions">
                      <button type="button" onClick={() => void copyCode(gift.code)}>
                        {copied === gift.code ? t.proGiftCopied : t.proGiftCopyBtn}
                      </button>
                      <a
                        href={buildGiftTelegramShareLink(profile.firstName ?? t.proAppGiftShareFallback, gift.code)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {t.proGiftSendBtn}
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {(gifts ?? [])
              .filter((g) => g.status === "claimed")
              .slice(0, 3)
              .map((gift) => (
                <p key={gift._id} className="pro-lock-claimed">
                  {fillTemplate(t.proGiftClaimedBy, {
                    code: gift.code,
                    name:
                      gift.recipientName ?? gift.recipientUsername ?? profile.firstName ?? "—",
                  })}
                </p>
              ))}

            {!pendingGift ? (
              <form onSubmit={(e) => void onGift(e)} className="pro-lock-form">
                <p className="pro-lock-pay">{payNote}</p>
                <PaymentMethods
                  telebirrNumber={telebirrNumber}
                  cbeNumber={cbeNumber}
                  telebirrName={telebirrName}
                  cbeName={cbeName}
                  lang={lang}
                  haptics={haptics}
                  sound={sound}
                />
                <label>
                  {t.proScreenshotLabel}
                  <input name="proof" type="file" accept="image/*" className="field" />
                </label>
                <button type="submit" disabled={uploading} className="btn btn-primary">
                  {uploading
                    ? t.proProcessing
                    : fillTemplate(t.proGiftSubmitBtn, { price })}
                </button>
              </form>
            ) : (
              <p className="pro-lock-wait">{t.proGiftReviewWait}</p>
            )}
            {message && <p className="pro-lock-msg">{message}</p>}
          </div>
        )}
      </section>
    </article>
  );
}
