"use client";

import { motion } from "framer-motion";
import { useMutation, useQuery } from "@/lib/authed-convex";
import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import { useTelegramId } from "@/hooks/useTelegramId";
import { useAppCopy } from "@/lib/i18n/CopyProvider";
import { fillTemplate } from "@/lib/i18n/merge";
import { buzzCoin, buzzError, buzzSuccess } from "@/lib/feedback";
import { Check } from "lucide-react";
import { ProSkeleton } from "@/components/ui/Skeleton";
import { ArcadeCoinSlot } from "@/components/ui/ArcadeCoinSlot";
import { ProLocker } from "@/components/pro/ProLocker";
import { PaymentMethods } from "@/components/pro/PaymentMethods";
import { RedeemCodeBox } from "@/components/pro/RedeemCodeBox";

export default function ProPage() {
  const searchParams = useSearchParams();
  const { telegramId, userArg, startParam } = useTelegramId();
  const settings = useQuery(api.settings.get);
  const profile = useQuery(api.users.getByTelegramId, userArg);
  const myRequest = useQuery(api.premium.getMyRequest, userArg);
  const generateUploadUrl = useMutation(api.premium.generateUploadUrl);
  const submitRequest = useMutation(api.premium.submitRequest);
  const [uploading, setUploading] = useState(false);
  const [coinInserted, setCoinInserted] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const t = useAppCopy(profile?.language ?? "en");
  const haptics = profile?.hapticsEnabled ?? true;
  const sound = profile?.soundEnabled ?? false;
  const lang = profile?.language === "am" ? ("am" as const) : ("en" as const);
  const locale = lang === "am" ? "am-ET" : "en-GB";
  const seasonEndDate = settings?.examSeasonEndAt
    ? new Date(settings.examSeasonEndAt).toLocaleDateString(locale, {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  const incomingGift =
    searchParams.get("gift") ??
    (startParam?.startsWith("gift_") ? startParam.slice(5) : "");

  if (settings === undefined || profile === undefined) {
    return <ProSkeleton />;
  }

  if (profile?.isProActive) {
    return (
      <main className="p-4 pt-6">
        <ProLocker
          telegramId={telegramId}
          profile={profile}
          price={settings?.proPriceEtb ?? 200}
          seasonEnd={settings?.examSeasonEndAt ?? profile.proExpiresAt}
          payNote={
            profile.language === "am"
              ? settings?.paymentInstructionsAm ?? ""
              : settings?.paymentInstructionsEn ?? ""
          }
          telebirrNumber={settings?.telebirrNumber}
          cbeNumber={settings?.cbeNumber}
          telebirrName={settings?.telebirrName}
          cbeName={settings?.cbeName}
        />
      </main>
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fileInput = form.elements.namedItem("proof") as HTMLInputElement;
    const file = fileInput.files?.[0];
    if (!file) {
      buzzError(haptics, sound);
      setMessage(t.proAttachScreenshot);
      return;
    }
    if (!file.type.startsWith("image/")) {
      buzzError(haptics, sound);
      setMessage(t.proImageOnly);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      buzzError(haptics, sound);
      setMessage(t.proImageMaxSize);
      return;
    }
    try {
      setUploading(true);
      setCoinInserted(true);
      buzzCoin(haptics, sound);
      const uploadUrl = await generateUploadUrl({});
      const uploadResult = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!uploadResult.ok) {
        throw new Error(t.proUploadFailedMsg);
      }
      const { storageId } = (await uploadResult.json()) as { storageId: Id<"_storage"> };
      await submitRequest({
        telegramId,
        proofFileId: storageId,
        kind: "self",
      });
      buzzSuccess(haptics, sound);
      setMessage(t.proSubmittedAdmin);
      form.reset();
    } catch (error) {
      buzzError(haptics, sound);
      setCoinInserted(false);
      setMessage(error instanceof Error ? error.message : t.proUploadFailed);
    } finally {
      setUploading(false);
    }
  }

  return (
    <main className="flex flex-col gap-4 p-4 pt-6">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="cab p-5"
      >
        <p className="kicker">{t.proPageKicker}</p>
        <h1 className="font-mono mt-3 text-3xl font-bold tracking-wide">
          {t.proInsertCoin}
        </h1>
        <p className="font-mono mt-1 text-xl text-accent">
          {fillTemplate(t.proAppPriceLine, { price: settings?.proPriceEtb ?? 200 })}
        </p>
        <p className="mt-2 text-sm text-muted">{t.proOnePayment}</p>
        {seasonEndDate ? (
          <p className="mt-1 font-mono text-xs font-semibold uppercase tracking-wider text-accent">
            {fillTemplate(t.proSeasonEndsOn, { date: seasonEndDate })}
          </p>
        ) : null}
        <div className="mt-5 flex items-center justify-between gap-3">
          <ul className="grid flex-1 gap-2 font-mono text-xs uppercase tracking-wider min-w-0">
            {[
              t.proCheckoutPerk1,
              t.proCheckoutPerk2,
              t.proCheckoutPerk3,
              t.proCheckoutPerk4,
              t.proCheckoutPerk5,
              t.proCheckoutPerk6,
            ].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <Check size={14} className="text-accent shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <ArcadeCoinSlot
            face="etb"
            price={settings?.proPriceEtb ?? 200}
            inserting={uploading}
            spent={coinInserted || myRequest?.status === "pending"}
            processing={uploading || myRequest?.status === "pending"}
          />
        </div>
      </motion.section>

      {myRequest?.status === "pending" && (
        <div className="border border-accent/40 bg-accent/15 px-4 py-3 font-mono text-xs uppercase tracking-wider text-accent">{t.pending}</div>
      )}
      {myRequest?.status === "rejected" && (
        <div className="border border-danger/40 bg-danger/15 px-4 py-3 font-mono text-xs uppercase tracking-wider text-danger">
          {t.rejected}: {myRequest.rejectionReason}
        </div>
      )}

      {myRequest?.status !== "pending" && (
        <form onSubmit={(e) => void onSubmit(e)} className="cab grid gap-4 p-5">
          <div>
            <h2 className="font-mono text-sm font-semibold uppercase tracking-wider">{t.proPaymentHeading}</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted">
              {profile?.language === "am"
                ? settings?.paymentInstructionsAm
                : settings?.paymentInstructionsEn}
            </p>
            <div className="mt-4">
              <PaymentMethods
                telebirrNumber={settings?.telebirrNumber}
                cbeNumber={settings?.cbeNumber}
                telebirrName={settings?.telebirrName}
                cbeName={settings?.cbeName}
                lang={lang}
                haptics={haptics}
                sound={sound}
              />
            </div>
          </div>
          <label className="grid gap-2 font-mono text-xs uppercase tracking-wider">
            {t.proScreenshotLabel}
            <input name="proof" type="file" accept="image/*" className="field" />
          </label>
          <button
            type="submit"
            disabled={uploading}
            className="btn btn-primary"
          >
            {uploading ? t.proProcessing : t.submitPay}
          </button>
        </form>
      )}
      {message && <p className="text-sm text-muted">{message}</p>}
      <RedeemCodeBox
        telegramId={telegramId}
        language={profile?.language ?? "en"}
        haptics={haptics}
        sound={sound}
        initialCode={incomingGift}
      />
    </main>
  );
}
