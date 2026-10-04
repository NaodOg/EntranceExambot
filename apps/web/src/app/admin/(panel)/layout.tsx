import { AdminShell } from "@/components/admin/AdminShell";
import { AdminTokenProvider } from "@/lib/admin-client";
import { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, isAdminAuthenticated } from "@/lib/admin-auth";

export default async function AdminPanelLayout({ children }: { children: ReactNode }) {
  const authed = await isAdminAuthenticated();
  if (!authed) {
    redirect("/admin/login");
  }

  const token = (await cookies()).get(ADMIN_COOKIE)?.value ?? "";

  return (
    <AdminTokenProvider token={token}>
      <AdminShell>{children}</AdminShell>
    </AdminTokenProvider>
  );
}
