// Revisa el calendario de "La Palabra del Día" antes de publicarlo.
// Lo corre la tarea programada después de generar palabras nuevas, y también CI.
import { readFileSync, readdirSync } from "node:fs";

const calendario = JSON.parse(readFileSync(new URL("../content/palabra-del-dia.json", import.meta.url)));
const validas = new Set(JSON.parse(readFileSync(new URL("../data/palabras-validas.json", import.meta.url))));
const validasCrucigrama = new Set(
  readFileSync(new URL("../data/palabras-crucigrama.txt", import.meta.url), "utf8").trim().split("\n"),
);
const DIAS_SIN_REPETIR = 365;

const errores = [];
const ultimaVez = new Map();
const fechas = Object.keys(calendario).sort();

for (const fecha of fechas) {
  const palabra = calendario[fecha];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(Date.parse(fecha))) {
    errores.push(`${fecha}: fecha inválida`);
  }
  if (!/^[A-ZÑ]{5}$/.test(palabra)) {
    errores.push(`${fecha}: "${palabra}" debe ser de 5 letras, mayúsculas y sin acentos`);
  } else if (!validas.has(palabra)) {
    errores.push(`${fecha}: "${palabra}" no está en la lista de palabras válidas`);
  }
  const anterior = ultimaVez.get(palabra);
  if (anterior) {
    const dias = (Date.parse(fecha) - Date.parse(anterior)) / 86_400_000;
    if (dias < DIAS_SIN_REPETIR) errores.push(`${fecha}: "${palabra}" ya salió el ${anterior}`);
  }
  ultimaVez.set(palabra, fecha);
}

for (let i = 1; i < fechas.length; i++) {
  const hueco = (Date.parse(fechas[i]) - Date.parse(fechas[i - 1])) / 86_400_000;
  if (hueco > 1) errores.push(`Faltan días entre ${fechas[i - 1]} y ${fechas[i]}`);
}

if (errores.length) {
  console.error(`Contenido con ${errores.length} error(es):\n- ${errores.join("\n- ")}`);
  process.exit(1);
}
console.log(`OK: ${fechas.length} días programados, del ${fechas[0]} al ${fechas.at(-1)}.`);


// --- Crucigramas ---
const calCrucigrama = JSON.parse(
  readFileSync(new URL("../content/crucigrama-calendario.json", import.meta.url)),
);
const dirCrucigramas = new URL("../content/crucigramas/", import.meta.url);
const archivos = new Set(readdirSync(dirCrucigramas));

for (const [fecha, id] of Object.entries(calCrucigrama)) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(Date.parse(fecha))) {
    errores.push(`crucigrama ${fecha}: fecha inválida`);
  }
  if (!archivos.has(`${id}.json`)) {
    errores.push(`crucigrama ${fecha}: no existe content/crucigramas/${id}.json`);
    continue;
  }
  const cg = JSON.parse(readFileSync(new URL(`${id}.json`, dirCrucigramas)));
  if (cg.negras.length !== cg.tamano || cg.negras.some((f) => f.length !== cg.tamano)) {
    errores.push(`crucigrama ${id}: la cuadrícula no mide ${cg.tamano}x${cg.tamano}`);
  }
  for (const e of cg.entradas) {
    if (!/^[A-ZÑ]+$/.test(e.palabra)) {
      errores.push(`crucigrama ${id} #${e.numero}${e.dir}: "${e.palabra}" debe ser mayúsculas A-ZÑ`);
    } else if (!validas.has(e.palabra) && !validasCrucigrama.has(e.palabra)) {
      errores.push(`crucigrama ${id} #${e.numero}${e.dir}: "${e.palabra}" no está en ninguna lista de palabras válidas`);
    }
    if (!e.pista || !e.pista.trim()) {
      errores.push(`crucigrama ${id} #${e.numero}${e.dir}: falta la pista de "${e.palabra}"`);
    }
    for (let n = 0; n < e.palabra.length; n++) {
      const f = e.dir === "V" ? e.fila + n : e.fila;
      const c = e.dir === "H" ? e.col + n : e.col;
      if (f >= cg.tamano || c >= cg.tamano || cg.negras[f][c]) {
        errores.push(`crucigrama ${id} #${e.numero}${e.dir}: "${e.palabra}" se sale de la cuadrícula o pisa una casilla negra`);
      } else if (cg.negras[f][c] !== false) {
        // ok
      }
    }
  }
  // Cada celda blanca debe pertenecer al menos a una entrada (sin letras huérfanas).
  const cubiertas = new Set();
  for (const e of cg.entradas) {
    for (let n = 0; n < e.palabra.length; n++) {
      const f = e.dir === "V" ? e.fila + n : e.fila;
      const c = e.dir === "H" ? e.col + n : e.col;
      cubiertas.add(`${f},${c}`);
    }
  }
  for (let f = 0; f < cg.tamano; f++) {
    for (let c = 0; c < cg.tamano; c++) {
      if (!cg.negras[f][c] && !cubiertas.has(`${f},${c}`)) {
        errores.push(`crucigrama ${id}: la celda (${f},${c}) no pertenece a ninguna palabra`);
      }
    }
  }
}

if (errores.length) {
  console.error(`Contenido con ${errores.length} error(es):\n- ${errores.join("\n- ")}`);
  process.exit(1);
}
console.log(`OK también: ${Object.keys(calCrucigrama).length} crucigrama(s) programado(s).`);
