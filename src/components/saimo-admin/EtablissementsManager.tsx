"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Building2, Ban, RotateCcw, Mail, Clock, GraduationCap, ShieldCheck, Layers, Pencil } from "lucide-react";
import type { EtablissementRow } from "@/server/dal/saimo-admin";
import {
  actionCreerEtablissement,
  actionSuspendreEtablissement,
  actionReactiverEtablissement,
  actionModifierLimiteCycles,
} from "@/server/actions/saimo-admin";
import { Modale, Champ, Err, ModalActions } from "@/components/portal/_ui";
import { formatDateCourte } from "@/lib/format";

export function EtablissementsManager({
  etablissements,
}: {
  etablissements: EtablissementRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [modal, setModal] = useState(false);
  const [erreur, setErreur] = useState("");
  const [confirmSuspension, setConfirmSuspension] = useState<EtablissementRow | null>(null);
  const [editLimite, setEditLimite] = useState<EtablissementRow | null>(null);
  const [erreurLimite, setErreurLimite] = useState("");

  const creer = (fd: FormData) => {
    setErreur("");
    startTransition(async () => {
      const r = await actionCreerEtablissement(fd);
      if (!r.succes) setErreur(r.erreur);
      else {
        toast.success("Établissement créé, invitation envoyée à l'administrateur");
        setModal(false);
        router.refresh();
      }
    });
  };

  const stats = [
    {
      icon: Building2,
      label: "Établissements",
      value: etablissements.length,
      bg: "bg-violet-50",
      fg: "text-violet-600",
    },
    {
      icon: ShieldCheck,
      label: "Actifs",
      value: etablissements.filter((e) => e.actif).length,
      bg: "bg-emerald-50",
      fg: "text-emerald-600",
    },
    {
      icon: GraduationCap,
      label: "Élèves (total)",
      value: etablissements.reduce((s, e) => s + e.nbEleves, 0),
      bg: "bg-blue-50",
      fg: "text-blue-600",
    },
    {
      icon: Mail,
      label: "Invitations en attente",
      value: etablissements.filter((e) => e.adminInvitationEnAttente).length,
      bg: "bg-amber-50",
      fg: "text-amber-600",
    },
  ];

  const modifierLimite = (fd: FormData) => {
    if (!editLimite) return;
    setErreurLimite("");
    startTransition(async () => {
      const r = await actionModifierLimiteCycles(editLimite.id, fd);
      if (!r.succes) setErreurLimite(r.erreur);
      else {
        toast.success("Limite de cycles mise à jour");
        setEditLimite(null);
        router.refresh();
      }
    });
  };

  const toggle = () => {
    if (!confirmSuspension) return;
    const action = confirmSuspension.actif ? actionSuspendreEtablissement : actionReactiverEtablissement;
    startTransition(async () => {
      const r = await action(confirmSuspension.id);
      if (!r.succes) toast.error(r.erreur);
      else {
        toast.success(confirmSuspension.actif ? "Établissement suspendu" : "Établissement réactivé");
        setConfirmSuspension(null);
        router.refresh();
      }
    });
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-neutral-900">
            Établissements
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Les écoles clientes de la plateforme SAIMO.
          </p>
        </div>
        <button
          onClick={() => {
            setErreur("");
            setModal(true);
          }}
          className="inline-flex items-center gap-2 self-start rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-violet-600/20 transition hover:bg-violet-700"
        >
          <Plus className="h-4 w-4" /> Nouvel établissement
        </button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:shadow-md"
          >
            <div className="mb-3 flex items-center gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${s.bg}`}>
                <s.icon className={`h-4 w-4 ${s.fg}`} />
              </div>
              <p className="text-xs font-semibold text-neutral-500">{s.label}</p>
            </div>
            <p className="text-lg font-bold leading-tight text-neutral-900">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <table className="w-full text-left whitespace-nowrap">
          <thead>
            <tr className="border-b border-neutral-100 bg-neutral-50/50 text-xs uppercase tracking-wide text-neutral-500">
              <th className="px-6 py-4 font-semibold">Établissement</th>
              <th className="px-6 py-4 font-semibold">Localisation</th>
              <th className="px-6 py-4 font-semibold">Élèves</th>
              <th className="px-6 py-4 font-semibold">Cycles</th>
              <th className="px-6 py-4 font-semibold">Administrateur</th>
              <th className="px-6 py-4 font-semibold">Créé le</th>
              <th className="px-6 py-4 font-semibold">Statut</th>
              <th className="px-6 py-4 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {etablissements.map((e) => (
              <tr key={e.id} className="transition hover:bg-neutral-50">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-neutral-400" />
                    <div>
                      <p className="text-sm font-bold text-neutral-900">{e.nom}</p>
                      <span className="text-xs text-neutral-500">{e.code}</span>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-neutral-700">
                  {[e.ville, e.pays].filter(Boolean).join(", ")}
                </td>
                <td className="px-6 py-4 text-sm font-semibold text-neutral-900">{e.nbEleves}</td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => {
                      setErreurLimite("");
                      setEditLimite(e);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 py-1 text-xs font-semibold text-neutral-700 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700"
                    title="Modifier la limite de cycles"
                  >
                    <Layers className="h-3 w-3" />
                    {e.nbCycles} / {e.limiteCycles}
                    <Pencil className="h-3 w-3 opacity-50" />
                  </button>
                </td>
                <td className="px-6 py-4">
                  <p className="text-sm text-neutral-700">{e.adminEmail ?? "—"}</p>
                  {e.adminInvitationEnAttente && (
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                      <Mail className="h-3 w-3" /> Invitation en attente
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-neutral-500">{formatDateCourte(e.createdAt)}</td>
                <td className="px-6 py-4">
                  {e.actif ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">
                      Actif
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700">
                      Suspendu
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={() => setConfirmSuspension(e)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
                      e.actif
                        ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                        : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    }`}
                  >
                    {e.actif ? (
                      <>
                        <Ban className="h-3 w-3" /> Suspendre
                      </>
                    ) : (
                      <>
                        <RotateCcw className="h-3 w-3" /> Réactiver
                      </>
                    )}
                  </button>
                </td>
              </tr>
            ))}
            {etablissements.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center text-sm text-neutral-500">
                  Aucun établissement pour l&rsquo;instant.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modale titre="Nouvel établissement" onClose={() => setModal(false)} large>
          <form action={creer} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Champ label="Nom de l'établissement" name="nom" required />
              <Champ label="Code (identifiant unique)" name="code" required placeholder="EX: LYCEE-CONAKRY" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Champ label="Ville" name="ville" />
              <Champ label="Pays" name="pays" defaultValue="Guinée" />
            </div>
            <div>
              <Champ
                label="Nombre de cycles payés (Primaire/Collège/Lycée...)"
                name="limiteCycles"
                type="number"
                min={1}
                max={10}
                defaultValue={3}
                required
              />
              <p className="mt-1 text-xs text-neutral-500">
                L&rsquo;établissement ne pourra pas créer plus de cycles que ce nombre —
                ajustable ensuite depuis cette page.
              </p>
            </div>
            <div className="border-t border-neutral-100 pt-4">
              <p className="mb-3 text-sm font-semibold text-neutral-700">
                Administrateur de l&rsquo;établissement
              </p>
              <div className="grid grid-cols-2 gap-4">
                <Champ label="Prénom" name="adminPrenom" required />
                <Champ label="Nom" name="adminNom" required />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <Champ label="Email" name="adminEmail" type="email" required />
                <Champ label="Téléphone" name="adminTelephone" />
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-neutral-500">
                <Clock className="h-3 w-3" /> Un email d&rsquo;invitation avec lien d&rsquo;activation
                (7 jours) sera envoyé à cette adresse.
              </p>
            </div>

            {erreur && <Err msg={erreur} />}
            <ModalActions
              onCancel={() => setModal(false)}
              label="Créer l'établissement"
              pending={isPending}
            />
          </form>
        </Modale>
      )}

      {confirmSuspension && (
        <Modale
          titre={confirmSuspension.actif ? "Suspendre l'établissement" : "Réactiver l'établissement"}
          onClose={() => setConfirmSuspension(null)}
        >
          <form action={toggle} className="space-y-4">
            <p className="text-sm text-neutral-700">
              {confirmSuspension.actif ? (
                <>
                  Tous les membres de <strong>{confirmSuspension.nom}</strong> perdront
                  immédiatement l&rsquo;accès à leur espace, jusqu&rsquo;à réactivation.
                </>
              ) : (
                <>
                  Les membres de <strong>{confirmSuspension.nom}</strong> retrouveront l&rsquo;accès
                  à leur espace.
                </>
              )}
            </p>
            <ModalActions
              onCancel={() => setConfirmSuspension(null)}
              label={confirmSuspension.actif ? "Confirmer la suspension" : "Confirmer la réactivation"}
              pending={isPending}
            />
          </form>
        </Modale>
      )}

      {editLimite && (
        <Modale titre="Modifier la limite de cycles" onClose={() => setEditLimite(null)}>
          <form action={modifierLimite} className="space-y-4">
            <p className="text-sm text-neutral-700">
              <strong>{editLimite.nom}</strong> utilise actuellement{" "}
              <strong>{editLimite.nbCycles}</strong> cycle(s).
            </p>
            <Champ
              label="Nouvelle limite de cycles"
              name="limiteCycles"
              type="number"
              min={editLimite.nbCycles || 1}
              max={10}
              defaultValue={editLimite.limiteCycles}
              required
            />
            {erreurLimite && <Err msg={erreurLimite} />}
            <ModalActions
              onCancel={() => setEditLimite(null)}
              label="Enregistrer"
              pending={isPending}
            />
          </form>
        </Modale>
      )}
    </div>
  );
}
