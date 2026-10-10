# Palabras Cruzadas MX

Juegos de palabras diarios en español mexicano, al estilo de NYT Games. Web app instalable (PWA) en Next.js, desplegada en Vercel, sin base de datos.

## Juegos

- **La Palabra del Día**: 5 letras, 6 intentos, con Ñ y sin distinguir acentos. Disponible.
- **Crucigrama**: solo la versión grande (15×15, como el crucigrama grande del NYT). Disponible.
- **Sopa temática**: próximamente.

## Cómo funciona el contenido

- `content/palabra-del-dia.json`: calendario `fecha → palabra`. La fecha es la del celular del jugador. Si un día no tiene palabra, se usa una ya publicada para que el juego nunca quede vacío.
- `data/palabras-validas.json`: los 10,836 intentos aceptados (palabras de 5 letras en mayúsculas, sin acentos, con Ñ), sacados de [an-array-of-spanish-words](https://github.com/words/an-array-of-spanish-words) (MIT).
- `content/crucigrama-calendario.json`: calendario `fecha → id de crucigrama`. Cada crucigrama vive en `content/crucigramas/<id>.json` (cuadrícula 15×15 + pistas). Mismo comportamiento de reserva que la palabra del día si falta un id.
- `data/palabras-crucigrama.txt`: ~33,000 palabras comunes del español (de [FrequencyWords](https://github.com/hermitdave/FrequencyWords), MIT/CC-BY-SA), usadas para llenar las cuadrículas. `scripts/llenar_crucigrama.py` arma una cuadrícula válida por backtracking; `scripts/armar_crucigrama.mjs` la junta con un diccionario de pistas (escrito a mano o por IA) en el JSON final del crucigrama.
- Las respuestas son español mexicano estándar de diccionario, sin regionalismos. Lo local va en las pistas de los crucigramas.
- El progreso, las rachas y las estadísticas se guardan en el navegador del jugador (`localStorage`).

`npm run validar` revisa el calendario: palabras válidas, sin repetir en 365 días y sin días faltantes. Lo corre CI y lo correrá la tarea programada que agregue palabras cada semana.

## Desarrollo

```bash
npm install
npm run dev       # http://localhost:3000
npm test          # lógica del juego
npm run validar   # contenido
npm run build
```

## Instalar en el iPhone

Abrir el sitio en Safari, tocar Compartir y luego "Agregar a pantalla de inicio".
