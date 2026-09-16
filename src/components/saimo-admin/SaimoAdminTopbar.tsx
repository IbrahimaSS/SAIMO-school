"use client";

import { useCurrentUserOptional, initiales } from "@/components/providers/UserProvider";

export function SaimoAdminTopbar() {
  const user = useCurrentUserOptional();
  const nom = user?.name ?? "Super Admin";

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-neutral-200 bg-white/80 px-6 backdrop-blur-md lg:pl-10">
      <div>
        <p className="text-sm font-bold text-neutral-900">Administration de la plateforme</p>
        <p className="text-xs text-neutral-500">Gestion des établissements clients SAIMO</p>
      </div>

      <div className="flex items-center gap-2.5 border-l border-neutral-200 pl-4 ml-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700 shadow-sm border border-violet-200">
          {initiales(nom)}
        </div>
        <div className="hidden sm:block leading-none">
          <p className="text-sm font-bold text-neutral-900">{nom}</p>
          <p className="text-[11px] text-violet-600 font-medium">Super Admin</p>
        </div>
      </div>
    </header>
  );
}
