import type { Metadata } from "next";
import PaginaCrucigrama from "@/components/PaginaCrucigrama";

export const metadata: Metadata = { title: "Crucigrama · Palabras Cruzadas MX" };

export default function Crucigrama() {
  return <PaginaCrucigrama />;
}
