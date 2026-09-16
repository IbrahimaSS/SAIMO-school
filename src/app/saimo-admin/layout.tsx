import { redirect } from "next/navigation";
import { getCurrentUserView, homeForRole } from "@/server/context";
import { UserProvider } from "@/components/providers/UserProvider";
import { SaimoAdminShell } from "@/components/saimo-admin/SaimoAdminShell";

export default async function SaimoAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const view = await getCurrentUserView();
  if (view.role !== "SUPER_ADMIN_SAIMO") redirect(homeForRole(view.role));

  return (
    <UserProvider value={view}>
      <SaimoAdminShell>{children}</SaimoAdminShell>
    </UserProvider>
  );
}
