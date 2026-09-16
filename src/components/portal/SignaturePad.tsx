"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser, PenLine, ImageUp } from "lucide-react";
import { toast } from "sonner";

/**
 * Zone de signature manuscrite (souris / tactile).
 * Émet un PNG transparent en data URI via `onChange` (null si effacée).
 */
export function SignaturePad({
  value,
  onChange,
  width = 420,
  height = 150,
}: {
  value: string | null;
  onChange: (dataUri: string | null) => void;
  width?: number;
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dessine = useRef(false);
  const dernier = useRef<{ x: number; y: number } | null>(null);
  const [vide, setVide] = useState(!value);

  // Prépare le canvas (résolution nette) et précharge la signature existante.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f172a";

    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, width, height);
      img.src = value;
      setVide(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height]);

  const pos = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent) => {
    e.preventDefault();
    dessine.current = true;
    dernier.current = pos(e);
    canvasRef.current?.setPointerCapture(e.pointerId);
  };

  const move = (e: React.PointerEvent) => {
    if (!dessine.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !dernier.current) return;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(dernier.current.x, dernier.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    dernier.current = p;
    setVide(false);
  };

  const end = () => {
    if (!dessine.current) return;
    dessine.current = false;
    dernier.current = null;
    const canvas = canvasRef.current;
    if (canvas) onChange(canvas.toDataURL("image/png"));
  };

  const effacer = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setVide(true);
    onChange(null);
  };

  const importer = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choisissez un fichier image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image trop lourde (5 Mo max).");
      return;
    }
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // Insère l'image en conservant ses proportions (mode "contain").
        ctx.clearRect(0, 0, width, height);
        const ratio = Math.min(width / img.width, height / img.height);
        const w = img.width * ratio;
        const h = img.height * ratio;
        ctx.drawImage(img, (width - w) / 2, (height - h) / 2, w, h);
        setVide(false);
        onChange(canvas.toDataURL("image/png"));
      };
      img.onerror = () => toast.error("Image illisible");
      img.src = reader.result as string;
    };
    reader.onerror = () => toast.error("Lecture du fichier impossible");
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <div className="inline-block rounded-xl border border-neutral-300 bg-white">
        <canvas
          ref={canvasRef}
          style={{ width, height, touchAction: "none" }}
          className="cursor-crosshair rounded-xl"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
        />
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs text-neutral-500">
        <PenLine className="h-3.5 w-3.5" />
        <span>{vide ? "Signez dans le cadre" : "Signature enregistrée à l'enregistrement du profil"}</span>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={importer} />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-semibold text-blue-600 hover:bg-blue-50"
        >
          <ImageUp className="h-3.5 w-3.5" /> Importer
        </button>
        <button
          type="button"
          onClick={effacer}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-semibold text-red-600 hover:bg-red-50"
        >
          <Eraser className="h-3.5 w-3.5" /> Effacer
        </button>
      </div>
    </div>
  );
}
