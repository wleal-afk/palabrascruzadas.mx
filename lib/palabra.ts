// Lógica pura de "La Palabra del Día": sin React ni navegador, para poder probarla con node --test.

export type Estado = "correcta" | "presente" | "ausente";

export const LARGO = 5;
export const INTENTOS = 6;
export const FECHA_INICIO = "2026-10-10";

// Mayúsculas y sin acentos, pero la Ñ se conserva como letra propia.
export function normalizar(texto: string): string {
  return texto
    .toUpperCase()
    .replace(/Ñ/g, "\u0000")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\u0000/g, "Ñ");
}

// Dos pasadas para que las letras repetidas se marquen como en Wordle:
// primero las exactas, luego las presentes mientras queden en la respuesta.
export function evaluar(intento: string, respuesta: string): Estado[] {
  const resultado: Estado[] = Array(intento.length).fill("ausente");
  const restantes = new Map<string, number>();
  for (let i = 0; i < respuesta.length; i++) {
    if (intento[i] === respuesta[i]) {
      resultado[i] = "correcta";
    } else {
      restantes.set(respuesta[i], (restantes.get(respuesta[i]) ?? 0) + 1);
    }
  }
  for (let i = 0; i < intento.length; i++) {
    if (resultado[i] === "correcta") continue;
    const n = restantes.get(intento[i]) ?? 0;
    if (n > 0) {
      resultado[i] = "presente";
      restantes.set(intento[i], n - 1);
    }
  }
  return resultado;
}

// Fecha local del jugador en formato AAAA-MM-DD, como el Wordle original.
export function fechaLocal(d: Date = new Date()): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function numeroDeJuego(fecha: string): number {
  const ms = Date.parse(`${fecha}T00:00:00Z`) - Date.parse(`${FECHA_INICIO}T00:00:00Z`);
  return Math.round(ms / 86_400_000) + 1;
}

// Si un día no tiene palabra programada, se toma una de las ya publicadas
// para que el juego nunca se quede vacío.
export function palabraDelDia(fecha: string, calendario: Record<string, string>): string {
  if (calendario[fecha]) return calendario[fecha];
  const reserva = Object.keys(calendario).sort().map((f) => calendario[f]);
  const n = Math.abs(numeroDeJuego(fecha));
  return reserva[n % reserva.length];
}

const CUADRO: Record<Estado, string> = { correcta: "🟩", presente: "🟨", ausente: "⬜" };

export function textoParaCompartir(numero: number, filas: Estado[][], gano: boolean): string {
  const marcador = gano ? `${filas.length}/${INTENTOS}` : `X/${INTENTOS}`;
  const cuadricula = filas.map((f) => f.map((e) => CUADRO[e]).join("")).join("\n");
  return `La Palabra del Día #${numero} ${marcador}\n\n${cuadricula}`;
}
