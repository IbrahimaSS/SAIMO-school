import type { Metadata } from "next";
import { Sidebar } from "@/components/portal/Sidebar";
import { Topbar } from "@/components/portal/Topbar";
import { SettingsForm } from "@/components/portal/SettingsForm";
import { getParametresEtablissement } from "@/server/dal/admin";
import { listerTypesEvaluation } from "@/server/dal/evaluations";

export const metadata: Metadata = {
  title: "Paramètres — Portail SAIMO",
  description: "Configuration du système et de l'établissement.",
};

export default async function ParametresPage() {
  const [data, typesEvaluation] = await Promise.all([
    getParametresEtablissement(),
    listerTypesEvaluation(),
  ]);

  return (
    <div className="min-h-screen bg-paper-100">
      <Sidebar />
      <div className="lg:pl-64">
        <Topbar />
        <main className="mx-auto max-w-4xl px-6 py-8 lg:px-10">
          <div className="mb-7">
            <h1 className="font-display text-2xl font-bold tracking-tight text-navy-900">Paramètres</h1>
            <p className="mt-1 text-sm text-ink-500">Identité de l&rsquo;établissement, apparence et année académique.</p>
          </div>
          <SettingsForm
            etablissement={data.etablissement}
            annees={data.annees}
            typesEvaluation={typesEvaluation}
          />
        </main>
      </div>
    </div>
  );
}
