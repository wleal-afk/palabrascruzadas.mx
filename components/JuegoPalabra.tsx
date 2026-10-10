"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import calendario from "@/content/palabra-del-dia.json";
import listaValidas from "@/data/palabras-validas.json";
import {
  type Estado,
  INTENTOS,
  LARGO,
  evaluar,
  fechaLocal,
  normalizar,
  numeroDeJuego,
  palabraDelDia,
  textoParaCompartir,
} from "@/lib/palabra";

const VALIDAS = new Set<string>(listaValidas as string[]);
const CLAVE_PARTIDA = "pdd-partida";
const CLAVE_STATS = "pdd-stats";

const TECLADO = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L", "Ñ"],
  ["ENVIAR", "Z", "X", "C", "V", "B", "N", "M", "BORRAR"],
];

type Partida = { fecha: string; intentos: string[] };
type Stats = {
  jugadas: number;
  ganadas: number;
  racha: number;
  rachaMax: number;
  ultimaGanada: string | null;
  distribucion: number[];
};

const STATS_VACIAS: Stats = {
  jugadas: 0,
  ganadas: 0,
  racha: 0,
  rachaMax: 0,
  ultimaGanada: null,
  distribucion: Array(INTENTOS).fill(0),
};

// localStorage puede fallar (modo privado, almacenamiento bloqueado); el juego sigue sin guardar.
function leer<T>(clave: string, porDefecto: T): T {
  try {
    const valor = localStorage.getItem(clave);
    return valor ? (JSON.parse(valor) as T) : porDefecto;
  } catch {
    return porDefecto;
  }
}

function guardar(clave: string, valor: unknown) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch {}
}

function diaAnterior(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00`);
  d.setDate(d.getDate() - 1);
  return fechaLocal(d);
}

const PRIORIDAD: Record<Estado, number> = { ausente: 0, presente: 1, correcta: 2 };

export default function JuegoPalabra() {
  const [fecha, setFecha] = useState<string | null>(null);
  const [intentos, setIntentos] = useState<string[]>([]);
  const [actual, setActual] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>(STATS_VACIAS);
  const [verResultado, setVerResultado] = useState(false);

  // La fecha depende del reloj del jugador, así que se calcula ya en el navegador.
  useEffect(() => {
    const hoy = fechaLocal();
    const partida = leer<Partida | null>(CLAVE_PARTIDA, null);
    setFecha(hoy);
    setIntentos(partida?.fecha === hoy ? partida.intentos : []);
    setStats(leer(CLAVE_STATS, STATS_VACIAS));
  }, []);

  const respuesta = useMemo(
    () => (fecha ? palabraDelDia(fecha, calendario as Record<string, string>) : ""),
    [fecha],
  );
  const evaluaciones = useMemo(() => intentos.map((i) => evaluar(i, respuesta)), [intentos, respuesta]);
  const gano = intentos.at(-1) === respuesta;
  const terminado = gano || intentos.length >= INTENTOS;

  const estadoLetras = useMemo(() => {
    const mapa = new Map<string, Estado>();
    intentos.forEach((intento, f) =>
      [...intento].forEach((letra, i) => {
        const nuevo = evaluaciones[f][i];
        const previo = mapa.get(letra);
        if (!previo || PRIORIDAD[nuevo] > PRIORIDAD[previo]) mapa.set(letra, nuevo);
      }),
    );
    return mapa;
  }, [intentos, evaluaciones]);

  const temporizador = useRef<ReturnType<typeof setTimeout>>(undefined);
  const mostrarAviso = (texto: string) => {
    clearTimeout(temporizador.current);
    setAviso(texto);
    temporizador.current = setTimeout(() => setAviso(null), 1800);
  };

  const enviar = useCallback(() => {
    if (!fecha || terminado) return;
    if (actual.length < LARGO) return mostrarAviso("Faltan letras");
    if (!VALIDAS.has(actual)) return mostrarAviso("No está en la lista de palabras");

    const nuevos = [...intentos, actual];
    setIntentos(nuevos);
    setActual("");
    guardar(CLAVE_PARTIDA, { fecha, intentos: nuevos } satisfies Partida);

    const acerto = actual === respuesta;
    if (acerto || nuevos.length >= INTENTOS) {
      const previas = leer(CLAVE_STATS, STATS_VACIAS);
      const racha = acerto ? (previas.ultimaGanada === diaAnterior(fecha) ? previas.racha + 1 : 1) : 0;
      const distribucion = [...previas.distribucion];
      if (acerto) distribucion[nuevos.length - 1] += 1;
      const siguientes: Stats = {
        jugadas: previas.jugadas + 1,
        ganadas: previas.ganadas + (acerto ? 1 : 0),
        racha,
        rachaMax: Math.max(previas.rachaMax, racha),
        ultimaGanada: acerto ? fecha : previas.ultimaGanada,
        distribucion,
      };
      guardar(CLAVE_STATS, siguientes);
      setStats(siguientes);
      setTimeout(() => setVerResultado(true), 1200);
    }
  }, [actual, fecha, intentos, respuesta, terminado]);

  const pulsar = useCallback(
    (tecla: string) => {
      if (terminado) return;
      if (tecla === "ENVIAR") return enviar();
      if (tecla === "BORRAR") return setActual((a) => a.slice(0, -1));
      const letra = normalizar(tecla);
      if (/^[A-ZÑ]$/.test(letra)) setActual((a) => (a.length < LARGO ? a + letra : a));
    },
    [enviar, terminado],
  );

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key !== "Enter" && e.key !== "Backspace" && e.key.length !== 1) return;
      // Sin esto, Enter también "presiona" la última tecla en pantalla que quedó con foco.
      e.preventDefault();
      if (e.key === "Enter") pulsar("ENVIAR");
      else if (e.key === "Backspace") pulsar("BORRAR");
      else pulsar(e.key);
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [pulsar]);

  const compartir = async () => {
    if (!fecha) return;
    const texto = textoParaCompartir(numeroDeJuego(fecha), evaluaciones, gano);
    try {
      if (navigator.share) await navigator.share({ text: texto });
      else {
        await navigator.clipboard.writeText(texto);
        mostrarAviso("Copiado, pégalo donde quieras");
      }
    } catch {}
  };

  if (!fecha) return <main className="juego" />;

  const filas = Array.from({ length: INTENTOS }, (_, f) => {
    if (f < intentos.length) return { letras: intentos[f], estados: evaluaciones[f] };
    if (f === intentos.length && !terminado) return { letras: actual, estados: null };
    return { letras: "", estados: null };
  });

  return (
    <main className="juego">
      <header className="barra">
        <Link href="/" aria-label="Volver al inicio">
          ←
        </Link>
        <h1>La Palabra del Día</h1>
        <button onClick={() => setVerResultado(true)} aria-label="Estadísticas">
          📊
        </button>
      </header>

      {aviso && <div className="aviso" role="status">{aviso}</div>}

      <div className="tablero">
        {filas.map((fila, f) => (
          <div key={f} className="fila">
            {Array.from({ length: LARGO }, (_, i) => (
              <div
                key={i}
                className={`casilla ${fila.estados?.[i] ?? (fila.letras[i] ? "escrita" : "")}`}
              >
                {fila.letras[i] ?? ""}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="teclado">
        {TECLADO.map((renglon, r) => (
          <div key={r} className="renglon">
            {renglon.map((tecla) => (
              <button
                key={tecla}
                className={`tecla ${tecla.length > 1 ? "ancha" : ""} ${estadoLetras.get(tecla) ?? ""}`}
                onClick={() => pulsar(tecla)}
              >
                {tecla === "BORRAR" ? "⌫" : tecla}
              </button>
            ))}
          </div>
        ))}
      </div>

      {verResultado && (
        <div className="fondo" onClick={() => setVerResultado(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            {terminado && (
              <p className="veredicto">
                {gano ? "¡Bien hecho!" : "La palabra era"} <strong>{respuesta}</strong>
              </p>
            )}
            <div className="numeros">
              <div><b>{stats.jugadas}</b>Jugadas</div>
              <div><b>{stats.jugadas ? Math.round((stats.ganadas / stats.jugadas) * 100) : 0}%</b>Ganadas</div>
              <div><b>{stats.racha}</b>Racha</div>
              <div><b>{stats.rachaMax}</b>Mejor racha</div>
            </div>
            <div className="distribucion">
              {stats.distribucion.map((n, i) => (
                <div key={i} className={`barra-dist ${gano && intentos.length === i + 1 ? "hoy" : ""}`}>
                  <span>{i + 1}</span>
                  <div style={{ width: `${Math.max(8, (n / Math.max(1, ...stats.distribucion)) * 100)}%` }}>{n}</div>
                </div>
              ))}
            </div>
            {terminado && (
              <button className="boton" onClick={compartir}>
                Compartir resultado
              </button>
            )}
            <button className="cerrar" onClick={() => setVerResultado(false)}>
              Cerrar
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
