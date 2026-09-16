"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Building2, ChevronRight } from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { useCurrentUserOptional, initiales } from "@/components/providers/UserProvider";

const NAV = [{ icon: Building2, label: "Établissements", href: "/saimo-admin" }];

export function SaimoAdminSidebar() {
  const pathname = usePathname();
  const user = useCurrentUserOptional();
  const nom = user?.name ?? "Super Admin";

  const isActive = (href: string) =>
    href === "/saimo-admin" ? pathname === href : pathname.startsWith(href);

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col lg:flex overflow-hidden">
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(to bottom, #1e1b4b, #3730a3)" }}
      />
      <div className="absolute inset-0 opacity-[0.07] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PHBhdGggZD0iTTQwIDQwVjBIMHY0MHoiIGZpbGw9Im5vbmUiLz48cGF0aCBkPSJNMzkgNDBWMGgxdjQwek0wIDM5aDQwdjFIMHoiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMSkiLz48L3N2Zz4=')]" />
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-fuchsia-400 via-indigo-400 to-violet-500" />

      <div className="relative flex flex-col h-full z-10">
        <div className="flex h-16 flex-shrink-0 items-center gap-2.5 border-b border-white/15 px-6">
          <LogoMark className="h-8 w-8" />
          <div className="leading-none">
            <p className="font-display text-sm font-bold text-white">SAIMO</p>
            <p className="text-[10px] uppercase tracking-widest text-white/60">Back-office</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-1">
          <p className="px-3 text-[9px] uppercase tracking-widest text-white/40 font-bold mb-3">
            Plateforme
          </p>
          {NAV.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 group ${
                  active
                    ? "bg-white/15 text-white border border-white/20"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                <item.icon
                  className={`h-4 w-4 flex-shrink-0 transition-colors ${
                    active ? "text-white" : "text-white/50 group-hover:text-white"
                  }`}
                />
                <span className="flex-1 truncate">{item.label}</span>
                {active && <ChevronRight className="h-3.5 w-3.5 text-white/40" />}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/15 p-4 space-y-3">
          <div className="flex items-center gap-3 px-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-500 text-xs font-bold text-white flex-shrink-0">
              {initiales(nom)}
            </div>
            <div className="leading-none min-w-0">
              <p className="text-sm font-semibold text-white truncate">{nom}</p>
              <p className="text-[11px] text-fuchsia-300 font-medium">Super Admin</p>
            </div>
          </div>
          <LogoutButton
            label="Déconnexion"
            className="flex items-center justify-center gap-2 w-full rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold text-white/70 transition hover:bg-red-500/15 hover:text-red-400 border border-transparent hover:border-red-500/20"
          />
        </div>
      </div>
    </aside>
  );
}
