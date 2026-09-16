"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ShieldAlert, RotateCcw } from "lucide-react";

export default function ParentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const estAcces = /autoris|permission|Accès/i.test(error.message);

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
      <div className="max-w-md rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 text-orange-500">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h2 className="mt-4 font-display text-lg font-bold text-neutral-900">
          {estAcces ? "Accès non autorisé" : "Une erreur est survenue"}
        </h2>
        <p className="mt-2 text-sm text-neutral-500">
          {estAcces
            ? "Votre rôle ne permet pas d'accéder à cette section."
            : error.message || "Impossible de charger cette page. Réessayez dans un instant."}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/parent" className="rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50">
            Tableau de bord
          </Link>
          {!estAcces && (
            <button onClick={reset} className="inline-flex items-center gap-2 rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800">
              <RotateCcw className="h-4 w-4" /> Réessayer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
