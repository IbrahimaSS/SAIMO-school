import type { ReactNode } from "react";
import { SaimoAdminSidebar } from "@/components/saimo-admin/SaimoAdminSidebar";
import { SaimoAdminTopbar } from "@/components/saimo-admin/SaimoAdminTopbar";

export function SaimoAdminShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-50/50">
      <SaimoAdminSidebar />
      <div className="lg:pl-64">
        <SaimoAdminTopbar />
        <main className="mx-auto max-w-7xl px-6 py-8 lg:px-10">{children}</main>
      </div>
    </div>
  );
}
