"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search, CheckCircle, AlertTriangle, Wallet2 } from "lucide-react";
import type { FraisRowDTO } from "@/server/dal/finance";
import type { ClasseOption } from "@/server/dal/pedagogie";
import { actionEnregistrerPaiement } from "@/server/actions/finance";
import { Modale, Champ, Selecteur, Err, ModalActions } from "@/components/portal/_ui";
import { formatGNF } from "@/lib/format";

const MODES = [
  { v: "especes", l: "Espèces" },
  { v: "mobile", l: "Mobile Money" },
  { v: "virement", l: "Virement" },
  { v: "cheque", l: "Chèque" },
];

export function PaiementsTable({
  frais,
  classes,
}: {
  frais: FraisRowDTO[];
  classes: ClasseOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [filtreClasse, setFiltreClasse] = useState("Toutes");
  const [cible, setCible] = useState<FraisRowDTO | null>(null);
  const [erreur, setErreur] = useState("");

  const filtered = useMemo(
    () =>
      frais.filter((f) => {
        const q = f.eleve.toLowerCase().includes(query.toLowerCase());
        const c = filtreClasse === "Toutes" || f.classe === filtreClasse;
        return q && c;
      }),
    [frais, query, filtreClasse],
  );

  const totaux = useMemo(() => {
    return frais.reduce(
      (acc, f) => {
        acc.du += f.montantDu;
        acc.paye += f.montantPaye;
        acc.solde += f.solde;
        return acc;
      },
      { du: 0, paye: 0, solde: 0 },
    );
  }, [frais]);

  const encaisser = (fd: FormData) => {
    if (!cible) return;
    fd.set("fraisEleveId", cible.id);
    setErreur("");
    startTransition(async () => {
      const r = await actionEnregistrerPaiement(fd);
      if (!r.succes) setErreur(r.erreur);
      else {
        setCible(null);
        toast.success(`Paiement encaissé — reçu ${r.data.numeroRecu}`);
        router.push(`/portail/recus/${r.data.paiementId}`);
      }
    });
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi label="Total dû" value={formatGNF(totaux.du)} />
        <Kpi label="Encaissé" value={formatGNF(totaux.paye)} accent="text-green-600" />
        <Kpi label="Reste à recouvrer" value={formatGNF(totaux.solde)} accent="text-orange-600" />
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-neutral-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Chercher un élève..." className="w-full rounded-xl border border-neutral-200 bg-neutral-50 py-2.5 pl-9 pr-3.5 text-xs outline-none focus:border-blue-400 transition" />
          </div>
          <select value={filtreClasse} onChange={(e) => setFiltreClasse(e.target.value)} className="rounded-xl border border-neutral-200 bg-white py-2 px-3 text-xs font-medium text-neutral-700 outline-none focus:border-blue-400">
            <option>Toutes</option>
            {classes.map((c) => (<option key={c.id}>{c.nom}</option>))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50/50 text-xs uppercase text-neutral-500">
                <th className="px-5 py-3">Élève / Classe</th><th className="px-5 py-3">Frais</th>
                <th className="px-5 py-3">Dû</th><th className="px-5 py-3">Payé</th>
                <th className="px-5 py-3">Solde</th><th className="px-5 py-3">Statut</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filtered.map((f) => (
                <tr key={f.id} className="hover:bg-neutral-50/60">
                  <td className="px-5 py-3">
                    <p className="font-semibold text-neutral-800">{f.eleve}</p>
                    <p className="text-xs text-neutral-500">{f.classe}</p>
                  </td>
                  <td className="px-5 py-3 text-neutral-700">{f.echeance}</td>
                  <td className="px-5 py-3 font-mono">{formatGNF(f.montantDu)}</td>
                  <td className="px-5 py-3 font-mono font-bold text-green-700">{formatGNF(f.montantPaye)}</td>
                  <td className="px-5 py-3 font-mono">{f.solde > 0 ? formatGNF(f.solde) : "—"}</td>
                  <td className="px-5 py-3">
                    {f.statut === "Soldé" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700"><CheckCircle className="h-3 w-3" /> Soldé</span>
                    ) : f.statut === "Partiel" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700">Partiel</span>
                    ) : f.statut === "Annulé" ? (
                      <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-[11px] font-semibold text-neutral-600">Annulé</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700"><AlertTriangle className="h-3 w-3" /> Impayé</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {f.solde > 0 && f.statut !== "Annulé" && (
                      <button onClick={() => setCible(f)} className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700">
                        <Wallet2 className="h-3.5 w-3.5" /> Encaisser
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-neutral-500">Aucun frais. Configurez les échéances et générez les frais.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {cible && (
        <Modale titre={`Encaisser — ${cible.eleve}`} onClose={() => setCible(null)}>
          <form action={encaisser} className="space-y-4">
            <div className="rounded-xl bg-neutral-50 p-3 text-sm text-neutral-600">
              {cible.echeance} · {cible.classe} · Solde <strong>{formatGNF(cible.solde)}</strong>
            </div>
            <Champ name="montant" label="Montant (GNF)" type="number" min="1" max={cible.solde} defaultValue={cible.solde} required />
            <Selecteur name="modePaiement" label="Mode de paiement" defaultValue="especes" required>
              {MODES.map((m) => (<option key={m.v} value={m.v}>{m.l}</option>))}
            </Selecteur>
            <Champ name="reference" label="Référence (optionnel)" placeholder="N° transaction, chèque…" />
            {erreur && <Err msg={erreur} />}
            <ModalActions pending={isPending} onCancel={() => setCible(null)} label="Valider le paiement" />
          </form>
        </Modale>
      )}
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5">
      <p className={`font-display text-xl font-black ${accent ?? "text-neutral-900"}`}>{value}</p>
      <p className="mt-0.5 text-sm text-neutral-500">{label}</p>
    </div>
  );
}
