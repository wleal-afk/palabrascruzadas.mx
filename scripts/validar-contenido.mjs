// Revisa el calendario de "La Palabra del Día" antes de publicarlo.
// Lo corre la tarea programada después de generar palabras nuevas, y también CI.
import { readFileSync } from "node:fs";

const calendario = JSON.parse(readFileSync(new URL("../content/palabra-del-dia.json", import.meta.url)));
const validas = new Set(JSON.parse(readFileSync(new URL("../data/palabras-validas.json", import.meta.url))));
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
