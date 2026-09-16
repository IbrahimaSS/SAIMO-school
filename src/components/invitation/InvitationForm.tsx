"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { actionAccepterInvitation } from "@/server/actions/invitation";
import { Champ, Err, ModalActions } from "@/components/portal/_ui";

export function InvitationForm({ token }: { token: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [erreur, setErreur] = useState("");

  const soumettre = (fd: FormData) => {
    setErreur("");
    startTransition(async () => {
      const r = await actionAccepterInvitation(fd);
      if (!r.succes) setErreur(r.erreur);
      else {
        toast.success("Compte activé, vous pouvez maintenant vous connecter");
        router.push("/connexion");
      }
    });
  };

  return (
    <form action={soumettre} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <Champ label="Nouveau mot de passe" name="motDePasse" type="password" required />
      <Champ label="Confirmer le mot de passe" name="confirmation" type="password" required />
      {erreur && <Err msg={erreur} />}
      <ModalActions
        onCancel={() => router.push("/connexion")}
        label="Activer mon compte"
        pending={isPending}
      />
    </form>
  );
}
