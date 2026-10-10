import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluar, normalizar, numeroDeJuego, palabraDelDia, textoParaCompartir } from "../lib/palabra.ts";

test("normalizar quita acentos pero conserva la Ñ", () => {
  assert.equal(normalizar("ñandú"), "ÑANDU");
  assert.equal(normalizar("Avión"), "AVION");
});

test("evaluar marca exactas, presentes y ausentes", () => {
  assert.deepEqual(evaluar("CARRO", "CERRO"), ["correcta", "ausente", "correcta", "correcta", "correcta"]);
  assert.deepEqual(evaluar("ROBLE", "CERRO"), ["presente", "presente", "ausente", "ausente", "presente"]);
});

test("evaluar no cuenta de más las letras repetidas", () => {
  // Una sola R sobrante en la respuesta: solo la primera R fuera de lugar es "presente".
  assert.deepEqual(evaluar("RRAAA", "PERLA"), ["presente", "ausente", "ausente", "ausente", "correcta"]);
});

test("numeroDeJuego cuenta desde el lanzamiento", () => {
  assert.equal(numeroDeJuego("2026-10-10"), 1);
  assert.equal(numeroDeJuego("2026-11-08"), 30);
});

test("palabraDelDia usa la reserva cuando falta un día", () => {
  const cal = { "2026-10-10": "CERRO", "2026-10-11": "PLAYA" };
  assert.equal(palabraDelDia("2026-10-11", cal), "PLAYA");
  assert.ok(["CERRO", "PLAYA"].includes(palabraDelDia("2027-01-01", cal)));
});

test("textoParaCompartir arma la cuadrícula", () => {
  const texto = textoParaCompartir(3, [evaluar("CARRO", "CERRO"), evaluar("CERRO", "CERRO")], true);
  assert.equal(texto, "La Palabra del Día #3 2/6\n\n🟩⬜🟩🟩🟩\n🟩🟩🟩🟩🟩");
});
