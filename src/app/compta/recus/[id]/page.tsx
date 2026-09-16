import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ComptaShell } from "@/components/compta/ComptaShell";
import { RecuImprimable } from "@/components/portal/RecuImprimable";
import { BoutonPdf } from "@/components/portal/BoutonPdf";
import { BoutonImprimer } from "@/components/portal/BoutonImprimer";
import { getRecuDetail } from "@/server/dal/finance";

export const metadata = { title: "Reçu de paiement — Portail comptable SAIMO" };

export default async function RecuDetailComptaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const r = await getRecuDetail(id);

  return (
    <ComptaShell wide={false}>
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Link
          href="/compta/recettes"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-neutral-900"
        >
          <ArrowLeft className="h-4 w-4" /> Retour aux recettes
        </Link>
        <div className="flex items-center gap-2">
          <BoutonPdf fichier={`Recu-${r.numero}`} label="Télécharger le PDF" />
          <BoutonImprimer label="Imprimer" />
        </div>
      </div>

      <RecuImprimable r={r} />
    </ComptaShell>
  );
}
