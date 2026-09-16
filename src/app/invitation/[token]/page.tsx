import type { Metadata } from "next";
import { getInvitationEtat } from "@/server/dal/invitation";
import { InvitationForm } from "@/components/invitation/InvitationForm";

export const metadata: Metadata = {
  title: "Activer votre compte — SAIMO Ecole",
};

const MOTIFS: Record<string, string> = {
  introuvable: "Ce lien d'invitation est invalide.",
  expiree: "Ce lien d'invitation a expiré. Contactez SAIMO pour en recevoir un nouveau.",
  "deja-acceptee": "Ce lien a déjà été utilisé. Connectez-vous avec votre mot de passe.",
};

export default async function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const etat = await getInvitationEtat(token);

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-blue-600">
          SAIMO Ecole
        </p>
        {etat.valide ? (
          <>
            <h1 className="mb-1 text-xl font-bold text-neutral-900">
              Bienvenue chez {etat.etablissementNom}
            </h1>
            <p className="mb-6 text-sm text-neutral-500">
              Définissez votre mot de passe pour activer votre compte administrateur ({etat.email}).
            </p>
            <InvitationForm token={token} />
          </>
        ) : (
          <>
            <h1 className="mb-1 text-xl font-bold text-neutral-900">Lien invalide</h1>
            <p className="text-sm text-neutral-500">
              {MOTIFS[etat.motif ?? "introuvable"]}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
