"use client";

import { useEffect } from "react";

export default function GlobalError({
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
    <html lang="fr">
      <body>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "sans-serif" }}>
          <div style={{ maxWidth: 420, textAlign: "center", border: "1px solid #e5e5e5", borderRadius: 16, padding: 32 }}>
            <h2 style={{ fontWeight: 700, fontSize: 18, color: "#111" }}>Une erreur est survenue</h2>
            <p style={{ marginTop: 8, fontSize: 14, color: "#666" }}>
              {error.message || "Impossible de charger la page. Réessayez dans un instant."}
            </p>
            <button
              onClick={reset}
              style={{ marginTop: 24, borderRadius: 999, background: "#2563eb", color: "#fff", padding: "10px 20px", fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer" }}
            >
              Réessayer
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
