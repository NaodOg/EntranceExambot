import { ConvexClientProvider } from "@/lib/convex";
import Script from "next/script";
import { ReactNode } from "react";
import { AppShell } from "@/components/app/AppShell";
import { CopyProvider } from "@/lib/i18n/CopyProvider";

export const dynamic = "force-dynamic";

export default function MiniAppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      <ConvexClientProvider>
        <CopyProvider>
          <AppShell>{children}</AppShell>
        </CopyProvider>
      </ConvexClientProvider>
    </>
  );
}
