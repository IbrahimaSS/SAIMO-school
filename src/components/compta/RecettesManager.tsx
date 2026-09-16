"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Search, CheckCircle, XCircle } from "lucide-react";
import type { RecetteRow } from "@/server/dal/compta";
import type { FraisRowDTO } from "@/server/dal/finance";
import { actionEnregistrerPaiement } from "@/server/actions/finance";
import { Modale, Champ, Selecteur, Err, ModalActions } from "@/components/portal/_ui";
import { formatGNF } from "@/lib/format";

const MODES = [
  { v: "especes", l: "Espèces" },
  { v: "mobile", l: "Mobile Money" },
  { v: "virement", l: "Virement" },
  { v: "cheque", l: "Chèque" },
];

export function RecettesManager({
  recettes,
  frais,
}: {
  recettes: RecetteRow[];
  frais: FraisRowDTO[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(false);
  const [erreur, setErreur] = useState("");
  const [fraisId, setFraisId] = useState("");
  const [rechFrais, setRechFrais] = useState("");

  const impayes = useMemo(
    () => frais.filter((f) => f.solde > 0),
    [frais],
  );
  const impayesFiltres = useMemo(
    () =>
      impayes
        .filter((f) =>
          `${f.eleve} ${f.classe} ${f.echeance}`
            .toLowerCase()
            .includes(rechFrais.toLowerCase()),
        )
        .slice(0, 50),
    [impayes, rechFrais],
  );
  const fraisChoisi = impayes.find((f) => f.id === fraisId);

  const recettesFiltrees = useMemo(
    () =>
      recettes.filter((r) =>
        `${r.eleve} ${r.numeroRecu} ${r.reference} ${r.motif}`
          .toLowerCase()
          .includes(q.toLowerCase()),
      ),
    [recettes, q],
  );

  const openModal = () => {
    setErreur("");
    setFraisId("");
    setRechFrais("");
    setModal(true);
  };

  const encaisser = (fd: FormData) => {
    setErreur("");
    if (!fd.get("fraisEleveId")) {
      setErreur("Sélectionnez un frais à encaisser.");
      return;
    }
    startTransition(async () => {
      const r = await actionEnregistrerPaiement(fd);
      if (!r.succes) {
        setErreur(r.erreur);
      } else {
        setModal(false);
        toast.success(`Encaissement enregistré — reçu ${r.data.numeroRecu}`);
        router.push(`/compta/recus/${r.data.paiementId}`);
      }
    });
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-neutral-900">
            Recettes &amp; encaissements
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Paiements reçus des élèves.
          </p>
        </div>
        <button
          onClick={openModal}
          className="inline-flex items-center gap-2 self-start rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-600/20 transition hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> Nouvel encaissement
        </button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
        <input
          type="text"
          placeholder="Chercher un élève, un n° de reçu, une référence…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full rounded-xl border border-neutral-200 bg-white py-2.5 pl-9 pr-4 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        />
      </div>

      <div className="overflow-hidden overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <table className="w-full text-left whitespace-nowrap">
          <thead>
            <tr className="border-b border-neutral-100 bg-neutral-50/50 text-xs uppercase tracking-wide text-neutral-500">
              <th className="px-6 py-4 font-semibold">Date</th>
              <th className="px-6 py-4 font-semibold">Élève</th>
              <th className="px-6 py-4 font-semibold">Motif</th>
              <th className="px-6 py-4 font-semibold">Montant</th>
              <th className="px-6 py-4 font-semibold">Méthode</th>
              <th className="px-6 py-4 font-semibold">Reçu</th>
              <th className="px-6 py-4 font-semibold">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {recettesFiltrees.map((r) => (
              <tr key={r.id} className="transition hover:bg-neutral-50">
                <td className="px-6 py-4 text-sm text-neutral-500">{r.date}</td>
                <td className="px-6 py-4">
                  <p className="text-sm font-bold text-neutral-900">{r.eleve}</p>
                  <p className="text-xs text-neutral-500">{r.classe}</p>
                </td>
                <td className="px-6 py-4 text-sm text-neutral-700">{r.motif}</td>
                <td className="px-6 py-4 font-mono text-sm font-bold text-emerald-600">
                  {formatGNF(r.montant)}
                </td>
                <td className="px-6 py-4 text-sm capitalize text-neutral-700">
                  {r.methode}
                  {r.reference ? (
                    <span className="block font-mono text-[10px] text-neutral-400">
                      {r.reference}
                    </span>
                  ) : null}
                </td>
                <td className="px-6 py-4 font-mono text-xs text-neutral-500">
                  {r.numeroRecu}
                </td>
                <td className="px-6 py-4">
                  {r.statut === "valide" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">
                      <CheckCircle className="h-3 w-3" /> Validé
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-bold text-neutral-500">
                      <XCircle className="h-3 w-3" /> Annulé
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {recettesFiltrees.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-sm text-neutral-500">
                  Aucune recette.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modale titre="Nouvel encaissement" onClose={() => setModal(false)} large>
          <form action={encaisser} className="space-y-4">
            <input type="hidden" name="fraisEleveId" value={fraisId} />
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-neutral-600">
                Rechercher un frais impayé
              </label>
              <input
                type="text"
                value={rechFrais}
                onChange={(e) => setRechFrais(e.target.value)}
                placeholder="Nom de l'élève, classe…"
                className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
              <div className="mt-2 max-h-44 space-y-1 overflow-y-auto rounded-xl border border-neutral-200 p-1">
                {impayesFiltres.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFraisId(f.id)}
                    className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                      fraisId === f.id
                        ? "bg-blue-50 ring-1 ring-blue-300"
                        : "hover:bg-neutral-50"
                    }`}
                  >
                    <span className="font-semibold text-neutral-800">{f.eleve}</span>
                    <span className="text-neutral-500">
                      {" "}
                      — {f.classe} · {f.echeance}
                    </span>
                    <span className="block font-mono text-xs text-red-600">
                      Solde {formatGNF(f.solde)}
                    </span>
                  </button>
                ))}
                {impayesFiltres.length === 0 && (
                  <p className="px-3 py-4 text-center text-xs text-neutral-400">
                    Aucun frais impayé.
                  </p>
                )}
              </div>
            </div>

            <Champ
              label="Montant (GNF)"
              name="montant"
              type="number"
              required
              defaultValue={fraisChoisi ? String(fraisChoisi.solde) : ""}
            />
            <Selecteur label="Mode de paiement" name="modePaiement" required>
              {MODES.map((m) => (
                <option key={m.v} value={m.v}>
                  {m.l}
                </option>
              ))}
            </Selecteur>
            <Champ label="Référence (optionnel)" name="reference" />

            {erreur && <Err msg={erreur} />}
            <ModalActions
              onCancel={() => setModal(false)}
              label="Enregistrer l'encaissement"
              pending={isPending}
            />
          </form>
        </Modale>
      )}
    </div>
  );
}
