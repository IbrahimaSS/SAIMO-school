"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  ClipboardCheck,
  CalendarX2,
  CalendarRange,
  FileBadge2,
  Megaphone,
  MessageSquare,
  Sparkles,
  UserCircle2,
} from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { useCurrentUserOptional } from "@/components/providers/UserProvider";

const NAV = [
  { icon: LayoutDashboard, label: "Tableau de bord", href: "/enseignant" },
  { icon: ClipboardCheck, label: "Mes notes", href: "/enseignant/notes" },
  { icon: CalendarX2, label: "Absences", href: "/enseignant/absences" },
  { icon: CalendarRange, label: "Emploi du temps", href: "/enseignant/emploi-du-temps" },
  { icon: FileBadge2, label: "Bulletins", href: "/enseignant/bulletins" },
  { icon: Megaphone, label: "Annonces", href: "/enseignant/annonces" },
  { icon: MessageSquare, label: "Messagerie", href: "/enseignant/messagerie" },
  { icon: Sparkles, label: "Assistant IA", href: "/enseignant/ia" },
];

export function EnseignantSidebar() {
  const pathname = usePathname();
  const user = useCurrentUserOptional();
  const nomEtab = user?.etablissementNom;
  const logo = user?.etablissementLogo;
  const isActive = (href: string) =>
    href === "/enseignant" ? pathname === href : pathname.startsWith(href);

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col overflow-hidden bg-gradient-to-b from-blue-700 to-blue-600 lg:flex">
      <div className="flex h-16 flex-shrink-0 items-center gap-2.5 border-b border-white/15 px-6">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt={nomEtab ?? "Logo"} className="h-8 w-8 rounded-lg object-cover" />
        ) : (
          <LogoMark className="h-8 w-8" />
        )}
        <div className="leading-none min-w-0">
          <p className="font-display text-sm font-bold text-white truncate">{nomEtab ?? "SAIMO"}</p>
          <p className="text-[10px] uppercase tracking-widest text-white/60">Enseignant</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3.5 py-2 text-sm font-medium transition ${
                active
                  ? "bg-white text-blue-600 shadow-md shadow-blue-900/20"
                  : "text-white/80 hover:bg-white/15 hover:text-white"
              }`}
            >
              <item.icon
                className={`h-[17px] w-[17px] flex-shrink-0 ${active ? "text-orange-500" : ""}`}
              />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="flex-shrink-0 space-y-1 border-t border-white/15 p-3">
        <Link
          href="/enseignant/profil"
          className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
            pathname === "/enseignant/profil"
              ? "bg-white/20 text-white shadow-md"
              : "text-white/70 hover:bg-white/15 hover:text-white"
          }`}
        >
          <UserCircle2 className="h-[18px] w-[18px]" /> Mon profil
        </Link>
        <LogoutButton className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-white/70 transition hover:bg-red-500/20 hover:text-red-200" />
      </div>
    </aside>
  );
}
