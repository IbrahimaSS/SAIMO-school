import type { Metadata } from "next";
import { listerEtablissements } from "@/server/dal/saimo-admin";
import { EtablissementsManager } from "@/components/saimo-admin/EtablissementsManager";

export const metadata: Metadata = {
  title: "Établissements — Back-office SAIMO",
};

export default async function SaimoAdminPage() {
  const etablissements = await listerEtablissements();
  return <EtablissementsManager etablissements={etablissements} />;
}
