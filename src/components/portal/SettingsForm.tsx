"use client";

import { toast } from "sonner";

import { useRef, useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Save, Building, Palette, CalendarClock, Loader2, CheckCircle2, Check,
  Plus, CircleCheck, ImagePlus, Type, ClipboardList, Trash2,
} from "lucide-react";
import { COLOR_MAP, GRADIENT_MAP, FONT_MAP, TAILLE_MAP } from "@/lib/theme";
import {
  actionMajEtablissement,
  actionMajApparence,
  actionCreerPeriode,
  actionActiverPeriode,
} from "@/server/actions/admin";
import {
  actionCreerTypeEvaluation,
  actionSupprimerTypeEvaluation,
} from "@/server/actions/pedagogie";
import { Modale, Champ, Err, ModalActions } from "@/components/portal/_ui";
import { useFormStatus } from "react-dom";

const champ = "w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition";

// Redimensionne l'image choisie en un carré <= 256px et renvoie un data URI JPEG.
function fichierVersDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Lecture du fichier impossible"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Image illisible"));
      img.onload = () => {
        const taille = 256;
        const canvas = document.createElement("canvas");
        canvas.width = taille;
        canvas.height = taille;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas indisponible"));
        const cote = Math.min(img.width, img.height);
        const sx = (img.width - cote) / 2;
        const sy = (img.height - cote) / 2;
        ctx.drawImage(img, sx, sy, cote, cote, 0, 0, taille, taille);
        resolve(canvas.toDataURL("image/jpeg", 0.9));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

type Props = {
  etablissement: {
    nom: string; code: string; logo: string | null; telephone: string | null; email: string | null;
    adresse: string | null; ville: string | null; pays: string; devise: string;
    siteWeb: string | null; mentionsLegales: string | null;
    couleurTheme: string; degradeTheme: string; police: string; tailleTexte: string;
  };
  annees: {
    id: string;
    libelle: string;
    active: boolean;
    verrouillee: boolean;
    debut: string;
    fin: string;
    periodes: { id: string; nom: string; active: boolean; debut: string; fin: string }[];
  }[];
  typesEvaluation: { id: string; nom: string; noteMaximale: number }[];
};

function SubmitBtn({ label = "Enregistrer" }: { label?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {label}
    </button>
  );
}

export function SettingsForm({ etablissement, annees, typesEvaluation }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"infos" | "apparence" | "annee" | "evaluations">("infos");
  const [ok, setOk] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [modalPeriode, setModalPeriode] = useState(false);
  const [erreurPeriode, setErreurPeriode] = useState("");
  const [modalType, setModalType] = useState(false);
  const [erreurType, setErreurType] = useState("");

  const [logo, setLogo] = useState<string | null>(etablissement.logo);
  const [logoChargement, setLogoChargement] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [couleurTheme, setCouleurTheme] = useState(etablissement.couleurTheme);
  const [degradeTheme, setDegradeTheme] = useState(etablissement.degradeTheme);
  const [police, setPolice] = useState(etablissement.police);
  const [tailleTexte, setTailleTexte] = useState(etablissement.tailleTexte);

  const anneeActive = annees.find((a) => a.active);

  // Chaque changement d'apparence est enregistré et appliqué immédiatement
  // (pas de bouton « Enregistrer » séparé) — c'est une identité d'établissement,
  // pas un brouillon.
  const appliquerApparence = (
    changement: Partial<{ couleurTheme: string; degradeTheme: string; police: string; tailleTexte: string }>,
  ) => {
    const next = { couleurTheme, degradeTheme, police, tailleTexte, ...changement };
    setCouleurTheme(next.couleurTheme);
    setDegradeTheme(next.degradeTheme);
    setPolice(next.police);
    setTailleTexte(next.tailleTexte);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("couleurTheme", next.couleurTheme);
      fd.set("degradeTheme", next.degradeTheme);
      fd.set("police", next.police);
      fd.set("tailleTexte", next.tailleTexte);
      const r = await actionMajApparence(fd);
      if (!r.succes) toast.error(r.erreur);
      else router.refresh();
    });
  };

  const creerPeriode = (fd: FormData) => {
    if (!anneeActive) return;
    setErreurPeriode("");
    startTransition(async () => {
      const r = await actionCreerPeriode(anneeActive.id, fd);
      if (!r.succes) setErreurPeriode(r.erreur);
      else {
        toast.success("Période créée");
        setModalPeriode(false);
        router.refresh();
      }
    });
  };

  const activerPeriode = (id: string) => {
    startTransition(async () => {
      const r = await actionActiverPeriode(id);
      if (!r.succes) toast.error(r.erreur);
      else {
        toast.success("Période activée");
        router.refresh();
      }
    });
  };

  const creerTypeEvaluation = (fd: FormData) => {
    setErreurType("");
    startTransition(async () => {
      const r = await actionCreerTypeEvaluation(fd);
      if (!r.succes) setErreurType(r.erreur);
      else {
        toast.success("Type d'évaluation créé");
        setModalType(false);
        router.refresh();
      }
    });
  };

  const supprimerTypeEvaluation = (id: string) => {
    startTransition(async () => {
      const r = await actionSupprimerTypeEvaluation(id);
      if (!r.succes) toast.error(r.erreur);
      else {
        toast.success("Type d'évaluation supprimé");
        router.refresh();
      }
    });
  };

  useEffect(() => {
    if (!ok) return;
    const t = setTimeout(() => setOk(false), 3000);
    return () => clearTimeout(t);
  }, [ok]);

  const choisirLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choisissez un fichier image.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image trop lourde (10 Mo max).");
      return;
    }
    setLogoChargement(true);
    try {
      setLogo(await fichierVersDataUri(file));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Traitement de l'image impossible");
    } finally {
      setLogoChargement(false);
    }
  };

  const submitInfos = (fd: FormData) => {
    fd.set("logo", logo ?? "");
    startTransition(async () => {
      const r = await actionMajEtablissement(fd);
      if (r.succes) { setOk(true); router.refresh(); }
      else toast.error(r.erreur);
    });
  };

  return (
    <div>
      <div className="mb-6 flex gap-1 rounded-full border border-neutral-200 bg-white p-1 w-fit">
        {[
          { id: "infos", label: "Informations", icon: Building },
          { id: "apparence", label: "Apparence", icon: Palette },
          { id: "annee", label: "Année scolaire", icon: CalendarClock },
          { id: "evaluations", label: "Évaluations", icon: ClipboardList },
        ].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id as typeof tab)} className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${tab === t.id ? "bg-navy-950 text-white" : "text-ink-500 hover:text-navy-900"}`}>
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {ok && <p className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700"><CheckCircle2 className="mr-1.5 inline h-4 w-4" />Modifications enregistrées.</p>}

      {tab === "infos" && (
        <form action={submitInfos} className="rounded-2xl border border-neutral-200 bg-white p-6 md:p-8 space-y-5">
          <div className="flex items-center gap-4 border-b border-neutral-100 pb-5">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="Logo" className="h-16 w-16 rounded-2xl object-cover border border-neutral-200" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-400">
                <Building className="h-6 w-6" />
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-neutral-700 mb-1">Logo de l&rsquo;établissement</p>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={choisirLogo} />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={logoChargement}
                className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-bold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-60"
              >
                {logoChargement ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                Changer le logo
              </button>
              <p className="mt-1.5 text-xs text-neutral-400">Affiché dans le menu de tous les espaces (portail, compta, parent, enseignant).</p>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div><label className="text-sm font-semibold text-neutral-700">Nom de l&rsquo;établissement</label><input name="nom" defaultValue={etablissement.nom} className={champ} /></div>
            <div><label className="text-sm font-semibold text-neutral-700">Code</label><input defaultValue={etablissement.code} disabled className={`${champ} bg-neutral-100`} /></div>
            <div><label className="text-sm font-semibold text-neutral-700">Téléphone</label><input name="telephone" defaultValue={etablissement.telephone ?? ""} className={champ} /></div>
            <div><label className="text-sm font-semibold text-neutral-700">Email</label><input name="email" type="email" defaultValue={etablissement.email ?? ""} className={champ} /></div>
            <div><label className="text-sm font-semibold text-neutral-700">Ville</label><input name="ville" defaultValue={etablissement.ville ?? ""} className={champ} /></div>
            <div><label className="text-sm font-semibold text-neutral-700">Devise</label><input name="devise" defaultValue={etablissement.devise} className={champ} /></div>
            <div className="sm:col-span-2"><label className="text-sm font-semibold text-neutral-700">Adresse</label><input name="adresse" defaultValue={etablissement.adresse ?? ""} className={champ} /></div>
            <div className="sm:col-span-2"><label className="text-sm font-semibold text-neutral-700">Site web</label><input name="siteWeb" defaultValue={etablissement.siteWeb ?? ""} className={champ} /></div>
            <div className="sm:col-span-2"><label className="text-sm font-semibold text-neutral-700">Mentions légales (pied de reçu)</label><textarea name="mentionsLegales" rows={2} defaultValue={etablissement.mentionsLegales ?? ""} className={champ} /></div>
          </div>
          <div className="flex justify-end border-t border-neutral-100 pt-5"><SubmitBtn /></div>
        </form>
      )}

      {tab === "apparence" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 md:p-8">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-display text-sm font-bold text-navy-900 mb-1">Couleur principale</h3>
                <p className="text-xs text-neutral-500">Identité visuelle de l&rsquo;établissement, vue par tout le personnel.</p>
              </div>
              {isPending && <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />}
            </div>
            <div className="flex flex-wrap gap-3">
              {Object.entries(COLOR_MAP).map(([value, c]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => appliquerApparence({ couleurTheme: value })}
                  className={`flex items-center gap-2 rounded-xl border-2 px-4 py-2.5 text-sm font-semibold transition ${couleurTheme === value ? "border-blue-500" : "border-neutral-200 hover:border-neutral-300"}`}
                >
                  <span className="h-4 w-4 rounded-full" style={{ background: c.primary }} />
                  {c.label}
                  {couleurTheme === value && <Check className="h-4 w-4 text-blue-600" />}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-6 md:p-8">
            <h3 className="font-display text-sm font-bold text-navy-900 mb-1">Dégradé du menu</h3>
            <p className="mb-4 text-xs text-neutral-500">Fond du menu latéral de l&rsquo;espace administrateur.</p>
            <div className="flex flex-wrap gap-3">
              {Object.entries(GRADIENT_MAP).map(([value, g]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => appliquerApparence({ degradeTheme: value })}
                  className={`flex items-center gap-2 rounded-xl border-2 px-4 py-2.5 text-sm font-semibold transition ${degradeTheme === value ? "border-blue-500" : "border-neutral-200 hover:border-neutral-300"}`}
                >
                  <span className="h-4 w-8 rounded-md" style={{ background: `linear-gradient(to right, ${g.from}, ${g.to})` }} />
                  {g.label}
                  {degradeTheme === value && <Check className="h-4 w-4 text-blue-600" />}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-6 md:p-8">
            <h3 className="flex items-center gap-2 font-display text-sm font-bold text-navy-900 mb-4">
              <Type className="h-4 w-4" /> Police et taille du texte
            </h3>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="text-sm font-semibold text-neutral-700">Police</label>
                <select
                  value={police}
                  onChange={(e) => appliquerApparence({ police: e.target.value })}
                  className={champ}
                >
                  {Object.entries(FONT_MAP).map(([value, f]) => (
                    <option key={value} value={value}>{f.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold text-neutral-700">Taille du texte</label>
                <select
                  value={tailleTexte}
                  onChange={(e) => appliquerApparence({ tailleTexte: e.target.value })}
                  className={champ}
                >
                  {Object.entries(TAILLE_MAP).map(([value, t]) => (
                    <option key={value} value={value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "annee" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead><tr className="border-b border-neutral-100 bg-neutral-50/50 text-xs uppercase text-neutral-500"><th className="px-5 py-3">Année</th><th className="px-5 py-3">Période</th><th className="px-5 py-3">Statut</th></tr></thead>
              <tbody className="divide-y divide-neutral-100">
                {annees.map((a) => (
                  <tr key={a.id}>
                    <td className="px-5 py-3 font-medium text-neutral-800">{a.libelle}</td>
                    <td className="px-5 py-3 text-neutral-500">{a.debut} → {a.fin}</td>
                    <td className="px-5 py-3">
                      {a.active && <span className="rounded-full bg-green-100 px-2.5 py-1 text-[11px] font-semibold text-green-600">Active</span>}
                      {a.verrouillee && <span className="ml-2 rounded-full bg-neutral-800 px-2.5 py-1 text-[11px] font-semibold text-white">Verrouillée</span>}
                      {!a.active && !a.verrouillee && <span className="text-xs text-neutral-400">Archive</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {anneeActive && (
            <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
              <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
                <div>
                  <h3 className="text-sm font-bold text-neutral-900">
                    Périodes de {anneeActive.libelle}
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Trimestres ou semestres — utilisés pour les évaluations et bulletins.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setErreurPeriode("");
                    setModalPeriode(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-blue-700"
                >
                  <Plus className="h-3.5 w-3.5" /> Ajouter une période
                </button>
              </div>

              {anneeActive.periodes.length === 0 ? (
                <p className="px-5 py-6 text-center text-sm text-neutral-500">
                  Aucune période. Ajoutez-en une pour pouvoir créer des évaluations.
                </p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-neutral-100 bg-neutral-50/50 text-xs uppercase text-neutral-500">
                      <th className="px-5 py-3">Nom</th>
                      <th className="px-5 py-3">Dates</th>
                      <th className="px-5 py-3">Statut</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {anneeActive.periodes.map((p) => (
                      <tr key={p.id}>
                        <td className="px-5 py-3 font-medium text-neutral-800">{p.nom}</td>
                        <td className="px-5 py-3 text-neutral-500">{p.debut} → {p.fin}</td>
                        <td className="px-5 py-3">
                          {p.active ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-[11px] font-semibold text-green-600">
                              <CircleCheck className="h-3 w-3" /> Active
                            </span>
                          ) : (
                            <span className="text-xs text-neutral-400">Inactive</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right">
                          {!p.active && (
                            <button
                              onClick={() => activerPeriode(p.id)}
                              disabled={isPending}
                              className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 transition hover:bg-blue-100 disabled:opacity-60"
                            >
                              Activer
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      {tab === "evaluations" && (
        <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
            <div>
              <h3 className="text-sm font-bold text-neutral-900">Types d&rsquo;évaluation</h3>
              <p className="text-xs text-neutral-500">
                Devoir, Composition, Examen... — utilisés pour créer une évaluation dans Notes.
              </p>
            </div>
            <button
              onClick={() => {
                setErreurType("");
                setModalType(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-blue-700"
            >
              <Plus className="h-3.5 w-3.5" /> Ajouter un type
            </button>
          </div>

          {typesEvaluation.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-neutral-500">
              Aucun type d&rsquo;évaluation. Ajoutez-en un pour pouvoir créer une évaluation.
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50/50 text-xs uppercase text-neutral-500">
                  <th className="px-5 py-3">Nom</th>
                  <th className="px-5 py-3">Barème</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {typesEvaluation.map((t) => (
                  <tr key={t.id}>
                    <td className="px-5 py-3 font-medium text-neutral-800">{t.nom}</td>
                    <td className="px-5 py-3 text-neutral-500">/ {t.noteMaximale}</td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => supprimerTypeEvaluation(t.id)}
                        disabled={isPending}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-60"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Supprimer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {modalPeriode && anneeActive && (
        <Modale titre="Nouvelle période" onClose={() => setModalPeriode(false)}>
          <form action={creerPeriode} className="space-y-4">
            <Champ label="Nom" name="nom" placeholder="Ex: 1er Trimestre" required />
            <div className="grid grid-cols-2 gap-4">
              <Champ label="Date de début" name="dateDebut" type="date" required />
              <Champ label="Date de fin" name="dateFin" type="date" required />
            </div>
            {erreurPeriode && <Err msg={erreurPeriode} />}
            <ModalActions
              onCancel={() => setModalPeriode(false)}
              label="Créer la période"
              pending={isPending}
            />
          </form>
        </Modale>
      )}

      {modalType && (
        <Modale titre="Nouveau type d'évaluation" onClose={() => setModalType(false)}>
          <form action={creerTypeEvaluation} className="space-y-4">
            <Champ label="Nom" name="nom" placeholder="Ex: Devoir, Composition, Examen" required />
            <Champ label="Barème (note maximale)" name="noteMaximale" type="number" min={1} defaultValue={20} required />
            {erreurType && <Err msg={erreurType} />}
            <ModalActions
              onCancel={() => setModalType(false)}
              label="Créer le type"
              pending={isPending}
            />
          </form>
        </Modale>
      )}
    </div>
  );
}
