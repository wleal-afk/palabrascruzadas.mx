"use client";

import { useEffect, useState } from "react";
import type { Crucigrama } from "@/lib/crucigrama";
import { fechaLocal } from "@/lib/palabra";
import JuegoCrucigrama from "@/components/JuegoCrucigrama";

export default function PaginaCrucigrama() {
  const [cg, setCg] = useState<Crucigrama | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`/api/crucigrama?fecha=${fechaLocal()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setCg)
      .catch(() => setError(true));
  }, []);

  if (error) return <main className="juego">No se pudo cargar el crucigrama de hoy.</main>;
  if (!cg) return <main className="crucigrama" />;
  return <JuegoCrucigrama crucigrama={cg} />;
}
