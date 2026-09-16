"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Receipt, FileText, X } from "lucide-react";
import type { RecuRowDTO } from "@/server/dal/finance";
import { formatGNF } from "@/lib/format";

const MODE_LABEL: Record<string, string> = {
  especes: "Espèces",
  mobile: "Mobile Money",
  virement: "Virement",
  cheque: "Chèque",
};

function StatutBadge({ statut }: { statut: string }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
      statut === "Annulé" ? "bg-red-100 text-red-600"
      : statut === "Envoyé" ? "bg-green-100 text-green-700"
      : "bg-neutral-100 text-neutral-600"}`}>{statut}</span>
  );
}

export function RecusTable({ recus }: { recus: RecuRowDTO[] }) {
  const [query, setQuery] = useState("");
  const [eleveOuvert, setEleveOuvert] = useState<{ id: string; nom: string } | null>(null);

  const filtered = useMemo(
    () =>
      recus.filter(
        (r) =>
          r.eleve.toLowerCase().includes(query.toLowerCase()) ||
          r.numero.toLowerCase().includes(query.toLowerCase()),
      ),
    [recus, query],
  );

  // Un seul reçu par élève (le plus récent — recus arrive déjà trié par date desc).
  const dernierParEleve = useMemo(() => {
    const vus = new Set<string>();
    const rows: (RecuRowDTO & { nbAutres: number })[] = [];
    const compte = new Map<string, number>();
    for (const r of filtered) compte.set(r.eleveId, (compte.get(r.eleveId) ?? 0) + 1);
    for (const r of filtered) {
      if (vus.has(r.eleveId)) continue;
      vus.add(r.eleveId);
      rows.push({ ...r, nbAutres: (compte.get(r.eleveId) ?? 1) - 1 });
    }
    return rows;
  }, [filtered]);

  const paiementsEleveOuvert = eleveOuvert
    ? recus.filter((r) => r.eleveId === eleveOuvert.id)
    : [];

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white">
      <div className="border-b border-neutral-100 p-5">
        <div className="relative max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="N° reçu ou élève..." className="w-full rounded-xl border border-neutral-200 bg-neutral-50 py-2.5 pl-9 pr-3.5 text-xs outline-none focus:border-blue-400 transition" />
        </div>
      </div>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-neutral-100 bg-neutral-50/50 text-xs uppercase text-neutral-500">
            <th className="px-5 py-3">N° Reçu</th><th className="px-5 py-3">Élève</th>
            <th className="px-5 py-3">Montant</th><th className="px-5 py-3">Date</th>
            <th className="px-5 py-3">Mode</th><th className="px-5 py-3">Statut</th>
            <th className="px-5 py-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {dernierParEleve.map((r) => (
            <tr
              key={r.eleveId}
              onClick={() => r.nbAutres > 0 && setEleveOuvert({ id: r.eleveId, nom: r.eleve })}
              className={`hover:bg-neutral-50/60 ${r.nbAutres > 0 ? "cursor-pointer" : ""}`}
            >
              <td className="px-5 py-3 font-mono text-xs font-bold text-neutral-700">{r.numero}</td>
              <td className="px-5 py-3">
                <p className="font-medium text-neutral-800">
                  {r.eleve}
                  {r.nbAutres > 0 && (
                    <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                      +{r.nbAutres} autre{r.nbAutres > 1 ? "s" : ""}
                    </span>
                  )}
                </p>
                <p className="text-xs text-neutral-500">{r.classe}</p>
              </td>
              <td className="px-5 py-3 font-mono font-bold text-neutral-900">{formatGNF(r.montant)}</td>
              <td className="px-5 py-3 text-xs text-neutral-500">{r.date}</td>
              <td className="px-5 py-3 text-xs text-neutral-600">{MODE_LABEL[r.mode] ?? r.mode}</td>
              <td className="px-5 py-3"><StatutBadge statut={r.statut} /></td>
              <td className="px-5 py-3 text-right">
                <Link
                  href={`/portail/recus/${r.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
                >
                  <FileText className="h-3.5 w-3.5" /> Voir / PDF
                </Link>
              </td>
            </tr>
          ))}
          {dernierParEleve.length === 0 && (
            <tr><td colSpan={7} className="px-5 py-10 text-center text-neutral-500">
              <Receipt className="mx-auto mb-2 h-6 w-6 text-neutral-300" /> Aucun reçu.
            </td></tr>
          )}
        </tbody>
      </table>

      {eleveOuvert && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-neutral-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl max-h-[85vh] overflow-y-auto">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-bold text-neutral-900">
                Tous les paiements — {eleveOuvert.nom}
              </h3>
              <button onClick={() => setEleveOuvert(null)} className="text-neutral-400 hover:text-neutral-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-2">
              {paiementsEleveOuvert.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-xl border border-neutral-200 p-3">
                  <div>
                    <p className="font-mono text-xs font-bold text-neutral-700">{p.numero}</p>
                    <p className="text-xs text-neutral-500">{p.date} · {MODE_LABEL[p.mode] ?? p.mode}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-neutral-900">{formatGNF(p.montant)}</span>
                    <StatutBadge statut={p.statut} />
                    <Link href={`/portail/recus/${p.id}`} className="text-blue-600 hover:text-blue-800">
                      <FileText className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
