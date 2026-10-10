import { test } from "node:test";
import assert from "node:assert/strict";
import {
  type Crucigrama,
  celdaAnterior,
  construirTablero,
  contarCorrectas,
  estaCompleto,
  idCrucigramaDelDia,
  siguienteCelda,
} from "../lib/crucigrama.ts";

// Cuadrícula mínima 3x3:
// S O L
// O # #
// L # #
const cg: Crucigrama = {
  id: "prueba",
  tamano: 3,
  negras: [
    [false, false, false],
    [false, true, true],
    [false, true, true],
  ],
  entradas: [
    { numero: 1, dir: "H", fila: 0, col: 0, palabra: "SOL", pista: "Astro del día" },
    { numero: 1, dir: "V", fila: 0, col: 0, palabra: "SOL", pista: "Astro del día (igual)" },
  ],
};

test("construirTablero marca negras, números y entradas por celda", () => {
  const t = construirTablero(cg);
  assert.equal(t[0][0].numero, 1);
  assert.equal(t[0][0].h, 0);
  assert.equal(t[0][0].v, 1);
  assert.equal(t[1][1].negra, true);
  assert.equal(t[0][1].numero, undefined);
});

test("siguienteCelda avanza dentro de la palabra y da la vuelta al llegar al final", () => {
  const t = construirTablero(cg);
  assert.deepEqual(siguienteCelda(cg, t, 0, 0), { fila: 0, col: 1, entradaIdx: 0 });
  assert.deepEqual(siguienteCelda(cg, t, 0, 1), { fila: 0, col: 2, entradaIdx: 0 });
  // Al terminar "SOL" horizontal, da la vuelta a la única otra entrada horizontal (ella misma).
  assert.deepEqual(siguienteCelda(cg, t, 0, 2), { fila: 0, col: 0, entradaIdx: 0 });
});

test("celdaAnterior retrocede o devuelve null al inicio", () => {
  assert.equal(celdaAnterior(cg, 0, 0), null);
  assert.deepEqual(celdaAnterior(cg, 0, 1), { fila: 0, col: 0, pos: 0 });
});

test("estaCompleto y contarCorrectas detectan aciertos", () => {
  const vacio = {};
  assert.equal(estaCompleto(cg, vacio), false);
  assert.deepEqual(contarCorrectas(cg, vacio), { correctas: 0, total: 5 });

  const lleno = { "0,0": "S", "0,1": "O", "0,2": "L", "1,0": "O", "2,0": "L" };
  assert.equal(estaCompleto(cg, lleno), true);
  assert.deepEqual(contarCorrectas(cg, lleno), { correctas: 5, total: 5 });

  const conError = { ...lleno, "0,2": "X" };
  assert.equal(estaCompleto(cg, conError), false);
  assert.deepEqual(contarCorrectas(cg, conError), { correctas: 4, total: 5 });
});

test("idCrucigramaDelDia usa el del día exacto o una reserva si falta", () => {
  const cal = { "2026-10-10": "a", "2026-10-11": "b" };
  assert.equal(idCrucigramaDelDia("2026-10-10", cal), "a");
  assert.equal(idCrucigramaDelDia("2026-10-11", cal), "b");
  assert.ok(["a", "b"].includes(idCrucigramaDelDia("2027-03-01", cal)));
});
