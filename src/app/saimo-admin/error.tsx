"use client";

import { useEffect } from "react";
import { RotateCcw } from "lucide-react";

export default function SaimoAdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
      <div className="max-w-md rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
        <h2 className="font-display text-lg font-bold text-neutral-900">Une erreur est survenue</h2>
        <p className="mt-2 text-sm text-neutral-500">
          {error.message || "Impossible de charger cette page. Réessayez dans un instant."}
        </p>
        <button
          onClick={reset}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
        >
          <RotateCcw className="h-4 w-4" /> Réessayer
        </button>
      </div>
    </div>
  );
}
