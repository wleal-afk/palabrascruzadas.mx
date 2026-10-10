"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import calendario from "@/content/crucigrama-calendario.json";
import {
  type Crucigrama,
  type Direccion,
  celdaAnterior,
  construirTablero,
  contarCorrectas,
  estaCompleto,
  posEnEntrada,
  siguienteCelda,
} from "@/lib/crucigrama";
import { fechaLocal, normalizar } from "@/lib/palabra";

const CLAVE_PROGRESO = "crucigrama-progreso"; // por id de crucigrama

type Progreso = { letras: Record<string, string>; terminado?: boolean };

function leer<T>(clave: string, porDefecto: T): T {
  try {
    const v = localStorage.getItem(clave);
    return v ? (JSON.parse(v) as T) : porDefecto;
  } catch {
    return porDefecto;
  }
}
function guardar(clave: string, valor: unknown) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch {}
}

export default function JuegoCrucigrama({ crucigrama }: { crucigrama: Crucigrama }) {
  const cg = crucigrama;
  const tablero = useMemo(() => construirTablero(cg), [cg]);
  const clave = `${CLAVE_PROGRESO}-${cg.id}`;

  const [letras, setLetras] = useState<Record<string, string>>({});
  const [cargado, setCargado] = useState(false);
  const [sel, setSel] = useState<{ fila: number; col: number; dir: Direccion } | null>(null);
  const [revisado, setRevisado] = useState(false);
  const [modal, setModal] = useState(false);
  const refs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    const p = leer<Progreso>(clave, { letras: {} });
    setLetras(p.letras ?? {});
    setCargado(true);
    // Primera celda blanca, lista para empezar.
    for (let f = 0; f < cg.tamano; f++) {
      for (let c = 0; c < cg.tamano; c++) {
        if (!cg.negras[f][c]) {
          setSel({ fila: f, col: c, dir: tablero[f][c].h !== undefined ? "H" : "V" });
          return;
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  useEffect(() => {
    if (cargado) guardar(clave, { letras } satisfies Progreso);
  }, [letras, cargado, clave]);

  useEffect(() => {
    if (cargado && estaCompleto(cg, letras)) {
      guardar(clave, { letras, terminado: true } satisfies Progreso);
      setTimeout(() => setModal(true), 400);
    }
  }, [letras, cargado, cg, clave]);

  const entradaActual = useMemo(() => {
    if (!sel) return null;
    const idx = sel.dir === "H" ? tablero[sel.fila][sel.col].h : tablero[sel.fila][sel.col].v;
    return idx !== undefined ? { idx, e: cg.entradas[idx] } : null;
  }, [sel, tablero, cg]);

  const enfocar = (f: number, c: number) => refs.current[`${f},${c}`]?.focus();

  const elegir = (f: number, c: number) => {
    const celda = tablero[f][c];
    if (celda.negra) return;
    setSel((prev) => {
      if (prev && prev.fila === f && prev.col === c) {
        // Tocar la misma celda alterna entre horizontal y vertical, si ambas existen.
        const otra: Direccion = prev.dir === "H" ? "V" : "H";
        if ((otra === "H" ? celda.h : celda.v) !== undefined) return { fila: f, col: c, dir: otra };
        return prev;
      }
      const dir: Direccion = celda.h !== undefined ? "H" : "V";
      return { fila: f, col: c, dir };
    });
    enfocar(f, c);
  };

  const escribir = (f: number, c: number, texto: string) => {
    const letra = normalizar(texto).replace(/[^A-ZÑ]/g, "").slice(-1);
    if (!letra) return;
    setLetras((prev) => ({ ...prev, [`${f},${c}`]: letra }));
    setRevisado(false);
    if (!entradaActual) return;
    const pos = posEnEntrada(entradaActual.e, f, c);
    const sig = siguienteCelda(cg, tablero, entradaActual.idx, pos);
    setSel({ fila: sig.fila, col: sig.col, dir: cg.entradas[sig.entradaIdx].dir });
    enfocar(sig.fila, sig.col);
  };

  const borrar = (f: number, c: number) => {
    if (letras[`${f},${c}`]) {
      setLetras((prev) => {
        const n = { ...prev };
        delete n[`${f},${c}`];
        return n;
      });
      return;
    }
    if (!entradaActual) return;
    const pos = posEnEntrada(entradaActual.e, f, c);
    const ant = celdaAnterior(cg, entradaActual.idx, pos);
    if (ant) {
      setSel({ fila: ant.fila, col: ant.col, dir: entradaActual.e.dir });
      enfocar(ant.fila, ant.col);
    }
  };

  const irAEntrada = (idx: number) => {
    const e = cg.entradas[idx];
    setSel({ fila: e.fila, col: e.col, dir: e.dir });
    enfocar(e.fila, e.col);
  };

  if (!cargado) return <main className="crucigrama" />;

  const { correctas, total } = contarCorrectas(cg, letras);
  const horizontales = cg.entradas.filter((e) => e.dir === "H");
  const verticales = cg.entradas.filter((e) => e.dir === "V");

  return (
    <main className="crucigrama">
      <header className="barra">
        <Link href="/" aria-label="Volver al inicio">
          ←
        </Link>
        <h1>Crucigrama</h1>
        <span className="progreso-mini">
          {correctas}/{total}
        </span>
      </header>

      {entradaActual && (
        <div className="pista-activa">
          <b>
            {entradaActual.e.numero}
            {entradaActual.e.dir}.
          </b>{" "}
          {entradaActual.e.pista}
        </div>
      )}

      <div className="tablero-cru" style={{ gridTemplateColumns: `repeat(${cg.tamano}, 1fr)` }}>
        {tablero.map((fila, f) =>
          fila.map((celda, c) => {
            if (celda.negra) return <div key={`${f},${c}`} className="celda-cru negra" />;
            const activa = sel?.fila === f && sel?.col === c;
            const enEntrada =
              entradaActual &&
              (entradaActual.e.dir === "H"
                ? tablero[f][c].h === entradaActual.idx
                : tablero[f][c].v === entradaActual.idx);
            const marcar = revisado && letras[`${f},${c}`];
            const correcta = (() => {
              const e = cg.entradas.find((x) =>
                x.dir === "H"
                  ? x.fila === f && c >= x.col && c < x.col + x.palabra.length
                  : x.col === c && f >= x.fila && f < x.fila + x.palabra.length,
              );
              if (!e) return true;
              const esp = e.dir === "H" ? e.palabra[c - e.col] : e.palabra[f - e.fila];
              return letras[`${f},${c}`] === esp;
            })();
            return (
              <div
                key={`${f},${c}`}
                className={`celda-cru ${activa ? "activa" : enEntrada ? "en-palabra" : ""} ${
                  marcar ? (correcta ? "ok" : "mal") : ""
                }`}
                onClick={() => elegir(f, c)}
              >
                {celda.numero && <span className="num-cru">{celda.numero}</span>}
                <input
                  ref={(el) => {
                    refs.current[`${f},${c}`] = el;
                  }}
                  value={letras[`${f},${c}`] ?? ""}
                  maxLength={1}
                  inputMode="text"
                  autoCapitalize="characters"
                  autoComplete="off"
                  aria-label={`Fila ${f + 1}, columna ${c + 1}`}
                  onChange={(ev) => escribir(f, c, ev.target.value)}
                  onKeyDown={(ev) => {
                    if (ev.key === "Backspace") {
                      ev.preventDefault();
                      borrar(f, c);
                    } else if (ev.key === "ArrowRight") elegir(f, Math.min(c + 1, cg.tamano - 1));
                    else if (ev.key === "ArrowLeft") elegir(f, Math.max(c - 1, 0));
                    else if (ev.key === "ArrowDown") elegir(Math.min(f + 1, cg.tamano - 1), c);
                    else if (ev.key === "ArrowUp") elegir(Math.max(f - 1, 0), c);
                  }}
                />
              </div>
            );
          }),
        )}
      </div>

      <div className="acciones-cru">
        <button onClick={() => setRevisado(true)}>Revisar</button>
        <button
          onClick={() => {
            if (confirm("¿Borrar todo lo escrito?")) {
              setLetras({});
              setRevisado(false);
            }
          }}
        >
          Borrar todo
        </button>
      </div>

      <div className="listas-pistas">
        <section>
          <h2>Horizontales</h2>
          <ul>
            {horizontales.map((e, i) => (
              <li
                key={`h${e.numero}`}
                className={entradaActual?.e === e ? "activa" : ""}
                onClick={() => irAEntrada(cg.entradas.indexOf(e))}
              >
                <b>{e.numero}.</b> {e.pista}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2>Verticales</h2>
          <ul>
            {verticales.map((e) => (
              <li
                key={`v${e.numero}`}
                className={entradaActual?.e === e ? "activa" : ""}
                onClick={() => irAEntrada(cg.entradas.indexOf(e))}
              >
                <b>{e.numero}.</b> {e.pista}
              </li>
            ))}
          </ul>
        </section>
      </div>

      {modal && (
        <div className="fondo" onClick={() => setModal(false)}>
          <div className="modal" onClick={(ev) => ev.stopPropagation()}>
            <p className="veredicto">¡Completaste el crucigrama!</p>
            <button className="cerrar" onClick={() => setModal(false)}>
              Cerrar
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
