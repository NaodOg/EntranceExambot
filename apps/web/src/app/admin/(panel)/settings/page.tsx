"use client";

import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { useEffect, useState } from "react";
import { ADMIN_EMAIL, useAdminMutation } from "@/lib/admin-client";
import { Card, PageHeader } from "@/components/admin/ui";

export default function AdminSettingsPage() {
  const settings = useQuery(api.settings.get);
  const ensure = useAdminMutation(api.settings.ensureDefaults);
  const update = useAdminMutation(api.settings.update);
  const [form, setForm] = useState({
    proPriceEtb: 200,
    examSeasonEndAt: "",
    paymentInstructionsAm: "",
    paymentInstructionsEn: "",
    telebirrNumber: "",
    cbeNumber: "",
    telebirrName: "",
    cbeName: "",
    freeMockLimitPerMonth: 3,
    freeDailyQuestionCap: 20,
    allowManualMarkEntry: false,
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void ensure({});
  }, [ensure]);

  useEffect(() => {
    if (!settings) return;
    setForm({
      proPriceEtb: settings.proPriceEtb,
      examSeasonEndAt: new Date(settings.examSeasonEndAt).toISOString().slice(0, 10),
      paymentInstructionsAm: settings.paymentInstructionsAm,
      paymentInstructionsEn: settings.paymentInstructionsEn,
      telebirrNumber: settings.telebirrNumber ?? "",
      cbeNumber: settings.cbeNumber ?? "",
      telebirrName: settings.telebirrName ?? "",
      cbeName: settings.cbeName ?? "",
      freeMockLimitPerMonth: settings.freeMockLimitPerMonth,
      freeDailyQuestionCap: settings.freeDailyQuestionCap ?? 20,
      allowManualMarkEntry: settings.allowManualMarkEntry ?? false,
    });
  }, [settings]);

  async function onSave() {
    await update({
      proPriceEtb: form.proPriceEtb,
      examSeasonEndAt: new Date(form.examSeasonEndAt).getTime(),
      paymentInstructionsAm: form.paymentInstructionsAm,
      paymentInstructionsEn: form.paymentInstructionsEn,
      telebirrNumber: form.telebirrNumber,
      cbeNumber: form.cbeNumber,
      telebirrName: form.telebirrName,
      cbeName: form.cbeName,
      freeMockLimitPerMonth: form.freeMockLimitPerMonth,
      freeDailyQuestionCap: form.freeDailyQuestionCap,
      allowManualMarkEntry: form.allowManualMarkEntry,
      adminEmail: ADMIN_EMAIL,
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  }

  return (
    <div className="grid gap-5">
      <PageHeader
        kicker="House rules"
        title="Settings"
        description="Pricing, season dates, free-tier limits, and broadcast tools."
      />

      <Card className="grid gap-4">
        <Field label="Pro price (ETB)">
          <input className="field" type="number" value={form.proPriceEtb} onChange={(e) => setForm({ ...form, proPriceEtb: Number(e.target.value) })} />
        </Field>
        <Field label="Season end">
          <input className="field" type="date" value={form.examSeasonEndAt} onChange={(e) => setForm({ ...form, examSeasonEndAt: e.target.value })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Free full exams / month">
            <input className="field" type="number" value={form.freeMockLimitPerMonth} onChange={(e) => setForm({ ...form, freeMockLimitPerMonth: Number(e.target.value) })} />
          </Field>
          <Field label="Free daily question cap">
            <input className="field" type="number" value={form.freeDailyQuestionCap} onChange={(e) => setForm({ ...form, freeDailyQuestionCap: Number(e.target.value) })} />
          </Field>
        </div>
        <Field label="Allow manual mark entry">
          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={form.allowManualMarkEntry}
              onChange={(e) => setForm({ ...form, allowManualMarkEntry: e.target.checked })}
            />
            Students may type in their own off-platform paper scores.
          </label>
        </Field>
        <Field label="Telebirr number (shown on Pro page)">
          <input className="field" inputMode="numeric" placeholder="e.g. 0911 234 567" value={form.telebirrNumber} onChange={(e) => setForm({ ...form, telebirrNumber: e.target.value })} />
        </Field>
        <Field label="Telebirr account name (shown on Pro page)">
          <input className="field" placeholder="e.g. Abel Tesfaye" value={form.telebirrName} onChange={(e) => setForm({ ...form, telebirrName: e.target.value })} />
        </Field>
        <Field label="CBE number (shown on Pro page)">
          <input className="field" inputMode="numeric" placeholder="e.g. 1000 1234 5678" value={form.cbeNumber} onChange={(e) => setForm({ ...form, cbeNumber: e.target.value })} />
        </Field>
        <Field label="CBE account name (shown on Pro page)">
          <input className="field" placeholder="e.g. Abel Tesfaye" value={form.cbeName} onChange={(e) => setForm({ ...form, cbeName: e.target.value })} />
        </Field>
        <Field label="Payment instructions (EN)">
          <textarea className="field min-h-28" value={form.paymentInstructionsEn} onChange={(e) => setForm({ ...form, paymentInstructionsEn: e.target.value })} />
        </Field>
        <Field label="Payment instructions (AM)">
          <textarea className="field min-h-28" value={form.paymentInstructionsAm} onChange={(e) => setForm({ ...form, paymentInstructionsAm: e.target.value })} />
        </Field>
        <button type="button" className="btn btn-primary" onClick={() => void onSave()}>
          {saved ? "Saved" : "Save settings"}
        </button>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm text-muted">
      <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-ink">
        {label}
      </span>
      {children}
    </label>
  );
}
