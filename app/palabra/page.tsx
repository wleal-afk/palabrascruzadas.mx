import type { Metadata } from "next";
import JuegoPalabra from "@/components/JuegoPalabra";

export const metadata: Metadata = { title: "La Palabra del Día · Palabras Cruzadas MX" };

export default function PaginaPalabra() {
  return <JuegoPalabra />;
}
