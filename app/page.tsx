import Link from "next/link";

const PROXIMOS = ["Sopa temática"];

export default function Inicio() {
  return (
    <main className="inicio">
      <h1>Palabras Cruzadas MX</h1>
      <p className="subtitulo">Un juego nuevo cada día.</p>
      <Link href="/palabra" className="tarjeta">
        <span className="tarjeta-titulo">La Palabra del Día</span>
        <span className="tarjeta-texto">Adivina la palabra de 5 letras en 6 intentos.</span>
      </Link>
      <Link href="/crucigrama" className="tarjeta">
        <span className="tarjeta-titulo">Crucigrama</span>
        <span className="tarjeta-texto">El crucigrama grande de 15×15, uno nuevo cada día.</span>
      </Link>
      {PROXIMOS.map((nombre) => (
        <div key={nombre} className="tarjeta deshabilitada">
          <span className="tarjeta-titulo">{nombre}</span>
          <span className="tarjeta-texto">Próximamente</span>
        </div>
      ))}
    </main>
  );
}
