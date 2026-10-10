// Arma el JSON de un crucigrama a partir de una cuadrícula ya llena (texto con
// "#" para las casillas negras) y un diccionario de pistas por palabra.
// Uso: node scripts/armar_crucigrama.mjs <id> <archivo-cuadricula> <archivo-pistas.json>
import { readFileSync, writeFileSync } from "node:fs";

const [, , id, archivoGrid, archivoPistas] = process.argv;
if (!id || !archivoGrid || !archivoPistas) {
  console.error("Uso: node armar_crucigrama.mjs <id> <cuadricula.txt> <pistas.json>");
  process.exit(1);
}

const filas = readFileSync(archivoGrid, "utf8").trim().split("\n");
const TAM = filas.length;
if (filas.some((f) => f.length !== TAM)) throw new Error("La cuadrícula no es cuadrada");
const negra = (f, c) => filas[f][c] === "#";

const pistas = JSON.parse(readFileSync(archivoPistas, "utf8"));

let numero = 1;
const entradas = [];
const numeros = {}; // "f,c" -> numero

for (let f = 0; f < TAM; f++) {
  for (let c = 0; c < TAM; c++) {
    if (negra(f, c)) continue;
    const empiezaH = (c === 0 || negra(f, c - 1)) && c + 1 < TAM && !negra(f, c + 1);
    const empiezaV = (f === 0 || negra(f - 1, c)) && f + 1 < TAM && !negra(f + 1, c);
    if (!empiezaH && !empiezaV) continue;
    numeros[`${f},${c}`] = numero;
    if (empiezaH) {
      let palabra = "";
      let cc = c;
      while (cc < TAM && !negra(f, cc)) palabra += filas[f][cc++];
      entradas.push({ numero, dir: "H", fila: f, col: c, palabra });
    }
    if (empiezaV) {
      let palabra = "";
      let ff = f;
      while (ff < TAM && !negra(ff, c)) palabra += filas[ff++][c];
      entradas.push({ numero, dir: "V", fila: f, col: c, palabra });
    }
    numero++;
  }
}

const faltantes = entradas.filter((e) => !pistas[e.palabra]);
if (faltantes.length) {
  console.error(
    `Faltan pistas para: ${[...new Set(faltantes.map((e) => e.palabra))].join(", ")}`,
  );
  process.exit(1);
}

const salida = {
  id,
  tamano: TAM,
  negras: Array.from({ length: TAM }, (_, f) =>
    Array.from({ length: TAM }, (_, c) => negra(f, c)),
  ),
  entradas: entradas.map((e) => ({ ...e, pista: pistas[e.palabra] })),
};

writeFileSync(
  new URL(`../content/crucigramas/${id}.json`, import.meta.url),
  JSON.stringify(salida) + "\n",
);
console.log(`${entradas.length} entradas escritas en content/crucigramas/${id}.json`);
