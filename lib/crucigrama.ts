// Lógica pura del crucigrama: sin React ni navegador, para poder probarla con node --test.

export type Direccion = "H" | "V";

export type Entrada = {
  numero: number;
  dir: Direccion;
  fila: number;
  col: number;
  palabra: string;
  pista: string;
};

export type Crucigrama = {
  id: string;
  tamano: number;
  negras: boolean[][];
  entradas: Entrada[];
};

export type Celda = {
  negra: boolean;
  numero?: number;
  h?: number; // índice en crucigrama.entradas de la entrada horizontal que cubre esta celda
  v?: number; // índice de la entrada vertical
};

// Si un día no tiene crucigrama programado, se toma uno ya publicado (según la
// fecha) para que el juego nunca se quede vacío — igual que en palabraDelDia.
export function idCrucigramaDelDia(fecha: string, calendario: Record<string, string>): string {
  if (calendario[fecha]) return calendario[fecha];
  const reserva = Object.keys(calendario)
    .sort()
    .map((f) => calendario[f]);
  const dias = Math.floor(Date.parse(`${fecha}T00:00:00Z`) / 86_400_000);
  return reserva[((dias % reserva.length) + reserva.length) % reserva.length];
}

// Una tabla fila×col con, para cada celda blanca, a qué entrada(s) pertenece.
export function construirTablero(cg: Crucigrama): Celda[][] {
  const tablero: Celda[][] = Array.from({ length: cg.tamano }, (_, f) =>
    Array.from({ length: cg.tamano }, (_, c) => ({ negra: cg.negras[f][c] })),
  );
  cg.entradas.forEach((e, i) => {
    for (let n = 0; n < e.palabra.length; n++) {
      const f = e.dir === "V" ? e.fila + n : e.fila;
      const c = e.dir === "H" ? e.col + n : e.col;
      tablero[f][c][e.dir === "H" ? "h" : "v"] = i;
      if (n === 0) tablero[f][c].numero = e.numero;
    }
  });
  return tablero;
}

// La celda siguiente dentro de la misma entrada, o la primera celda de la
// siguiente entrada en esa dirección si ya se llegó al final (da la vuelta).
export function siguienteCelda(
  cg: Crucigrama,
  tablero: Celda[][],
  entradaIdx: number,
  pos: number,
): { fila: number; col: number; entradaIdx: number } {
  const e = cg.entradas[entradaIdx];
  if (pos + 1 < e.palabra.length) {
    const fila = e.dir === "V" ? e.fila + pos + 1 : e.fila;
    const col = e.dir === "H" ? e.col + pos + 1 : e.col;
    return { fila, col, entradaIdx };
  }
  const mismaDir = cg.entradas
    .map((x, i) => ({ x, i }))
    .filter(({ x }) => x.dir === e.dir);
  const actual = mismaDir.findIndex(({ i }) => i === entradaIdx);
  const sig = mismaDir[(actual + 1) % mismaDir.length];
  return { fila: sig.x.fila, col: sig.x.col, entradaIdx: sig.i };
}

export function celdaAnterior(
  cg: Crucigrama,
  entradaIdx: number,
  pos: number,
): { fila: number; col: number; pos: number } | null {
  if (pos === 0) return null;
  const e = cg.entradas[entradaIdx];
  const fila = e.dir === "V" ? e.fila + pos - 1 : e.fila;
  const col = e.dir === "H" ? e.col + pos - 1 : e.col;
  return { fila, col, pos: pos - 1 };
}

export function posEnEntrada(e: Entrada, fila: number, col: number): number {
  return e.dir === "H" ? col - e.col : fila - e.fila;
}

export function estaCompleto(cg: Crucigrama, letras: Record<string, string>): boolean {
  return cg.entradas.every((e) =>
    [...e.palabra].every((letra, n) => {
      const f = e.dir === "V" ? e.fila + n : e.fila;
      const c = e.dir === "H" ? e.col + n : e.col;
      return letras[`${f},${c}`] === letra;
    }),
  );
}

export function contarCorrectas(
  cg: Crucigrama,
  letras: Record<string, string>,
): { correctas: number; total: number } {
  let correctas = 0;
  let total = 0;
  for (let f = 0; f < cg.tamano; f++) {
    for (let c = 0; c < cg.tamano; c++) {
      if (cg.negras[f][c]) continue;
      total++;
    }
  }
  // Recorrido por celdas (no por entradas) para no contar ninguna dos veces.
  for (let f = 0; f < cg.tamano; f++) {
    for (let c = 0; c < cg.tamano; c++) {
      if (cg.negras[f][c]) continue;
      // Buscar la letra correcta de esa celda a partir de cualquier entrada que la cubra.
      const entrada = cg.entradas.find((e) =>
        e.dir === "H"
          ? e.fila === f && c >= e.col && c < e.col + e.palabra.length
          : e.col === c && f >= e.fila && f < e.fila + e.palabra.length,
      );
      if (!entrada) continue;
      const correcta =
        entrada.dir === "H" ? entrada.palabra[c - entrada.col] : entrada.palabra[f - entrada.fila];
      if (letras[`${f},${c}`] === correcta) correctas++;
    }
  }
  return { correctas, total };
}
