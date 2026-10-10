import { readFileSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import calendario from "@/content/crucigrama-calendario.json";
import { idCrucigramaDelDia } from "@/lib/crucigrama";

// El id viene siempre del calendario (nunca directo de la petición), así que
// no hay forma de pedir un archivo fuera de content/crucigramas/.
export function GET(request: Request) {
  const fecha = new URL(request.url).searchParams.get("fecha");
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return NextResponse.json({ error: "Falta ?fecha=AAAA-MM-DD" }, { status: 400 });
  }
  const id = idCrucigramaDelDia(fecha, calendario as Record<string, string>);
  const ruta = path.join(process.cwd(), "content", "crucigramas", `${id}.json`);
  const datos = JSON.parse(readFileSync(ruta, "utf8"));
  return NextResponse.json(datos, { headers: { "Cache-Control": "public, max-age=3600" } });
}
