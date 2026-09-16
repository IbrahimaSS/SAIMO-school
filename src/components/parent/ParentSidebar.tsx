"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, BookOpen, FileText,
  CalendarX2, Wallet2, MessageSquare,
  Bell, User, GraduationCap, ChevronDown,
} from "lucide-react";
import { useEnfants } from "@/components/parent/EnfantsProvider";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { useCurrentUserOptional } from "@/components/providers/UserProvider";

const NAV = [
  { icon: LayoutDashboard, label: "Tableau de bord", href: "/parent" },
  { icon: BookOpen,        label: "Notes",           href: "/parent/notes" },
  { icon: FileText,        label: "Bulletins",       href: "/parent/bulletins" },
  { icon: CalendarX2,      label: "Absences",        href: "/parent/absences" },
  { icon: Wallet2,         label: "Paiements",       href: "/parent/paiements" },
  { icon: MessageSquare,   label: "Messagerie",      href: "/parent/messagerie" },
];

export function ParentSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { enfants, estEleve } = useEnfants();
  const user = useCurrentUserOptional();
  const nomEtab = user?.etablissementNom;
  const logo = user?.etablissementLogo;

  const enfantId = searchParams.get("enfant") || enfants[0]?.id || "";
  const currentEnfant = enfants.find((e) => e.id === enfantId) || enfants[0] || null;

  const isActive = (href: string) =>
    href === "/parent" ? pathname === href : pathname.startsWith(href);
  const getHref = (baseHref: string) =>
    enfantId ? `${baseHref}?enfant=${enfantId}` : baseHref;

  const nav = estEleve ? NAV.filter((n) => n.href !== "/parent/paiements") : NAV;

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col overflow-hidden lg:flex">
      <div className="absolute inset-0 bg-gradient-to-b from-emerald-700 to-teal-800" />
      <div className="absolute inset-0 opacity-[0.07] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PHBhdGggZD0iTTQwIDQwVjBIMHY0MHoiIGZpbGw9Im5vbmUiLz48cGF0aCBkPSJNMzkgNDBWMGgxdjQwek0wIDM5aDQwdjFIMHoiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMSkiLz48L3N2Zz4=')]" />

      <div className="relative flex h-full flex-col">
        <div className="flex h-16 flex-shrink-0 items-center gap-3 border-b border-white/15 px-6">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt={nomEtab ?? "Logo"} className="h-9 w-9 rounded-xl object-cover flex-shrink-0" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
          )}
          <div className="leading-none min-w-0">
            <p className="font-display text-sm font-bold text-white truncate">{nomEtab ?? "SAIMO"}</p>
            <p className="text-[10px] uppercase tracking-widest text-white/60">
              {estEleve ? "Espace Élève" : "Espace Parent"}
            </p>
          </div>
        </div>

        {/* Sélecteur enfant */}
        {currentEnfant && (
          <div className="mx-3 mt-4 rounded-xl border border-white/15 bg-white/10 px-4 py-3">
            <p className="mb-1 text-[10px] uppercase tracking-wider text-white/50">
              {estEleve ? "Mon compte" : "Mon enfant"}
            </p>
            {enfants.length > 1 ? (
              <div className="relative">
                <select
                  value={enfantId}
                  onChange={(e) => router.push(`${pathname}?enfant=${e.target.value}`)}
                  className="w-full cursor-pointer appearance-none bg-transparent pr-6 text-sm font-bold text-white outline-none"
                >
                  {enfants.map((enfant) => (
                    <option key={enfant.id} value={enfant.id} className="text-neutral-900">
                      {enfant.nomComplet}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 text-white/70" />
              </div>
            ) : (
              <p className="text-sm font-bold text-white">{currentEnfant.nomComplet}</p>
            )}
            <p className="mt-0.5 text-xs text-white/60">
              {currentEnfant.classe} &bull; {currentEnfant.anneeScolaire}
            </p>
          </div>
        )}

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {nav.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={getHref(item.href)}
                className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-150 ${
                  active
                    ? "bg-white text-emerald-700 shadow-md"
                    : "text-white/80 hover:bg-white/15 hover:text-white"
                }`}
              >
                <item.icon
                  className={`h-[17px] w-[17px] flex-shrink-0 ${active ? "text-emerald-600" : ""}`}
                />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}

          <div className="my-2 mx-3 border-b border-white/10" />

          <Link
            href={getHref("/parent/notifications")}
            className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all ${
              pathname === "/parent/notifications"
                ? "bg-white text-emerald-700"
                : "text-white/80 hover:bg-white/15 hover:text-white"
            }`}
          >
            <Bell className="h-[17px] w-[17px]" />
            <span>Notifications</span>
          </Link>

          <Link
            href={getHref("/parent/profil")}
            className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all ${
              pathname === "/parent/profil"
                ? "bg-white text-emerald-700"
                : "text-white/80 hover:bg-white/15 hover:text-white"
            }`}
          >
            <User className="h-[17px] w-[17px]" />
            <span>Mon Profil</span>
          </Link>
        </nav>

        <div className="flex-shrink-0 border-t border-white/15 p-3">
          <LogoutButton
            label="Déconnexion"
            className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-white/70 transition hover:bg-red-500/20 hover:text-red-200"
          />
        </div>
      </div>
    </aside>
  );
}
