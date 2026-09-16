"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, ArrowDownRight, ArrowUpRight,
  Calculator, FileBarChart, Wallet, ChevronRight,
  Megaphone, MessageSquare
} from "lucide-react";
import { LogoutButton } from "@/components/auth/LogoutButton";
import {
  useCurrentUserOptional,
  libelleRole,
  initiales,
} from "@/components/providers/UserProvider";

const NAV = [
  { icon: LayoutDashboard, label: "Tableau de bord",        href: "/compta" },
  { icon: ArrowDownRight,  label: "Recettes",               href: "/compta/recettes" },
  { icon: ArrowUpRight,    label: "Dépenses",               href: "/compta/depenses" },
  { icon: Calculator,      label: "Salaires & Paie",        href: "/compta/salaires" },
  { icon: Megaphone,       label: "Annonces & Relances",    href: "/compta/annonces" },
  { icon: MessageSquare,   label: "Messagerie",             href: "/compta/messagerie" },
  { icon: FileBarChart,    label: "Rapports Financiers",    href: "/compta/rapports" },
];

export function ComptaSidebar() {
  const pathname = usePathname();
  const user = useCurrentUserOptional();
  const nom = user?.name ?? "Utilisateur";
  const roleLabel = user ? libelleRole(user.role) : "Comptabilité";
  const nomEtab = user?.etablissementNom;
  const logo = user?.etablissementLogo;
  const isActive = (href: string) =>
    href === "/compta" ? pathname === href : pathname.startsWith(href);

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col lg:flex overflow-hidden">
      {/* Fond bleu — même famille que l'admin, légèrement plus profond */}
      <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, #1e3a8a, #1d4ed8)" }} />
      {/* Texture subtile identique à l'admin */}
      <div className="absolute inset-0 opacity-[0.07] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PHBhdGggZD0iTTQwIDQwVjBIMHY0MHoiIGZpbGw9Im5vbmUiLz48cGF0aCBkPSJNMzkgNDBWMGgxdjQwek0wIDM5aDQwdjFIMHoiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMSkiLz48L3N2Zz4=')]" />
      {/* Accent top bar cyan — identifiant comptable */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-500" />

      <div className="relative flex flex-col h-full z-10">
        {/* Logo */}
        <div className="flex h-16 flex-shrink-0 items-center gap-3 px-6 border-b border-slate-700/60 mt-1">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt={nomEtab ?? "Logo"} className="h-9 w-9 rounded-xl object-cover flex-shrink-0" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 shadow-lg shadow-violet-500/30 flex-shrink-0">
              <Wallet className="h-4.5 w-4.5 text-white h-5 w-5" />
            </div>
          )}
          <div className="leading-none min-w-0">
            <p className="text-sm font-bold text-white tracking-wide truncate">{nomEtab ?? "SAIMO"}</p>
            <p className="text-[10px] uppercase tracking-widest text-blue-200/60">Finance & Compta</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-1">
          <p className="px-3 text-[9px] uppercase tracking-widest text-blue-200/40 font-bold mb-3">Navigation</p>
          {NAV.map(item => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 group ${
                  active
                    ? "bg-white/15 text-white border border-white/20"
                    : "text-blue-100/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                <item.icon className={`h-4 w-4 flex-shrink-0 transition-colors ${active ? "text-white" : "text-blue-200/50 group-hover:text-white"}`} />
                <span className="flex-1 truncate">{item.label}</span>
                {active && <ChevronRight className="h-3.5 w-3.5 text-white/40" />}
              </Link>
            );
          })}
        </nav>

        {/* Comptable info */}
        <div className="border-t border-slate-700/60 p-4 space-y-3">
          <div className="flex items-center gap-3 px-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-blue-500 text-xs font-bold text-white flex-shrink-0">
              {initiales(nom)}
            </div>
            <div className="leading-none min-w-0">
              <p className="text-sm font-semibold text-white truncate">{nom}</p>
              <p className="text-[11px] text-cyan-300 font-medium">{roleLabel}</p>
            </div>
          </div>
          <LogoutButton
            label="Déconnexion"
            className="flex items-center justify-center gap-2 w-full rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold text-blue-100/70 transition hover:bg-red-500/15 hover:text-red-400 border border-transparent hover:border-red-500/20"
          />
        </div>
      </div>
    </aside>
  );
}
