import type { Metadata } from "next";
import { Sidebar } from "@/components/portal/Sidebar";
import { Topbar } from "@/components/portal/Topbar";
import { StatCards } from "@/components/portal/StatCards";
import { ClassChart } from "@/components/portal/ClassChart";
import { ActivityTable } from "@/components/portal/ActivityTable";
import { AdminDashboard } from "@/components/portal/AdminDashboard";
import {
  getStatsDashboard,
  getMoyennesParClasse,
  getActiviteRecente,
} from "@/server/dal/dashboard";
import { getCurrentUserView } from "@/server/context";

export const metadata: Metadata = {
  title: "Portail SAIMO — Administration",
  description: "Tableau de bord principal de l'administration SAIMO.",
};

export default async function PortailPage() {
  const [user, stats, moyennes, activite] = await Promise.all([
    getCurrentUserView(),
    getStatsDashboard(),
    getMoyennesParClasse(),
    getActiviteRecente(6),
  ]);

  return (
    <div className="min-h-screen bg-neutral-50">
      <Sidebar />

      <div className="lg:pl-64">
        <Topbar />

        <main className="mx-auto max-w-7xl px-6 py-8 lg:px-10">
          <div
            className="mb-8 rounded-2xl p-8 text-white overflow-hidden relative"
            style={{ background: `linear-gradient(to right, ${user.theme.sidebarFrom}, ${user.theme.sidebarTo})` }}
          >
            <div className="absolute inset-0 opacity-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PHBhdGggZD0iTTQwIDQwVjBIMHY0MHoiIGZpbGw9Im5vbmUiLz48cGF0aCBkPSJNMzkgNDBWMGgxdjQwek0wIDM5aDQwdjFIMHoiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMSkiLz48L3N2Zz4=')]" />
            <div className="relative">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/80">
                Administration
              </p>
              <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Tableau de bord
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/85">
                Bienvenue, {user.name.split(" ")[0]}. {stats.evaluationsEnAttente > 0
                  ? `${stats.evaluationsEnAttente} évaluation${stats.evaluationsEnAttente > 1 ? "s" : ""} en attente de validation.`
                  : "Toutes les évaluations sont à jour."}
              </p>
            </div>
          </div>

          <StatCards stats={stats} />

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <ClassChart classes={moyennes.classes} moyenneGenerale={moyennes.moyenneGenerale} />
            <ActivityTable items={activite} />
          </div>

          <div className="mt-8">
            <AdminDashboard stats={stats} />
          </div>
        </main>
      </div>
    </div>
  );
}
