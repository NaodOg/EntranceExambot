import { ConvexClientProvider } from "@/lib/convex";
import { ReactNode } from "react";

export const dynamic = "force-dynamic";

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return (
    <ConvexClientProvider>
      <div className="admin-theme min-h-dvh bg-bg text-ink">{children}</div>
    </ConvexClientProvider>
  );
}
