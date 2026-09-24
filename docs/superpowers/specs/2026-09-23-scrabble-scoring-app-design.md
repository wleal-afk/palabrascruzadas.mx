# App de puntaje para Scrabble — Spec de diseño

Fecha: 2026-09-23
Estado: aprobado para pasar a plan de implementación (por otro modelo/sesión)

## 1. Objetivo

App web personal (no comercial) para jugar Scrabble en español con familia/amigos:
cada jugador usa su propio celular para ver el marcador en vivo, registrar los
puntos de sus jugadas, resolver disputas de palabras contra el diccionario
oficial, y consultar las reglas. No reemplaza el tablero físico: se juega con
fichas y tablero reales, la app solo lleva el puntaje y da soporte visual.

Este documento cierra las decisiones de producto y arquitectura. **No incluye
plan de implementación ni decisiones de UI/UX/animación** — eso se define
después, en otra sesión, a partir de este spec.

## 2. Alcance del MVP

Incluye:
- Perfiles fijos sin contraseña, multi-dispositivo en tiempo real.
- Crear/unirse a partidas por código corto.
- Registro de jugadas con construcción visual de palabras (fichas), cálculo
  automático de puntaje con multiplicadores marcados a mano por el jugador.
- Soporte para varias palabras formadas en una misma jugada.
- Bono de +50 por bingo (usar las 7 fichas) y fichas comodín (0 puntos).
- Validación de palabras contra el léxico oficial FISE (español), tanto
  integrada al armar una jugada como en un buscador independiente para
  disputas.
- Pestaña de reglas (estáticas).
- Historial de partidas terminadas y estadísticas agregadas por perfil.

No incluye (ver sección 10, fuera de alcance):
- Diccionario en inglés, tablero digital con posiciones reales, cálculo
  automático de multiplicadores por posición, autenticación real, chat,
  decisiones de UI/UX/animación.

## 3. Stack técnico y despliegue

- **Frontend/backend de aplicación:** Next.js (App Router), desplegado en
  Vercel (plan Pro del usuario), con dominio propio del usuario conectado.
- **Datos y tiempo real:** Supabase (plan free), Postgres + Realtime
  (subscripciones a cambios en las tablas de partida/jugadas para que todos
  los dispositivos vean el marcador actualizarse en vivo).
- **Gestión de Supabase:** vía Supabase CLI (`supabase login`, `supabase
  migration new`, `supabase db push`, etc.) contra el proyecto ya creado por
  el usuario — no vía el MCP de Supabase de esta sesión, porque ese conector
  está en uso por otros proyectos del usuario.
- **Sin autenticación real** (ver sección 8, seguridad).

## 4. Modelo de datos

Todas las tablas viven en el proyecto Supabase (Postgres). Tipos e
identificadores son orientativos para el plan de implementación, no DDL final.

**`profiles`** — perfiles fijos de jugadores (sin contraseña)
- `id` uuid, pk
- `name` text, único
- `color` text (hex, para identificar visualmente al jugador en la UI)
- `created_at` timestamptz

**`games`** — partidas
- `id` uuid, pk
- `code` text, único, corto (ej. 6 caracteres alfanuméricos), para compartir
  y unirse
- `dictionary` text, enum (`es` fijo para MVP; el campo existe para permitir
  agregar `en_sowpods` después sin migrar esquema)
- `status` text, enum (`in_progress` | `finished`)
- `created_by` uuid, fk → `profiles.id`
- `created_at` timestamptz
- `finished_at` timestamptz, nullable

**`game_players`** — jugadores dentro de una partida
- `id` uuid, pk
- `game_id` uuid, fk → `games.id`
- `profile_id` uuid, fk → `profiles.id`
- `joined_at` timestamptz
- único por (`game_id`, `profile_id`)

**`turns`** — una jugada registrada (puede contener varias palabras)
- `id` uuid, pk
- `game_id` uuid, fk → `games.id`
- `profile_id` uuid, fk → `profiles.id` (a quién se le atribuye la jugada)
- `bingo_bonus` boolean, default `false`
- `total_score` int (calculado: suma de `word_score` de sus palabras, + 50 si
  `bingo_bonus`)
- `created_at` timestamptz

**`turn_words`** — cada palabra formada dentro de una jugada
- `id` uuid, pk
- `turn_id` uuid, fk → `turns.id`
- `position` int (orden de la palabra dentro de la jugada, para mostrarla)
- `word_multiplier` int, valores permitidos: `1, 2, 3, 4, 9` (cubre palabra
  normal, DP, TP, y los casos raros de dos casillas DP o dos TP en la misma
  palabra — no se modelan casillas individuales, el jugador elige el
  multiplicador efectivo directamente)
- `base_score` int (calculado: suma de `tile_score` de sus fichas, antes del
  multiplicador de palabra)
- `word_score` int (calculado: `base_score * word_multiplier`)

**`turn_word_tiles`** — cada ficha dentro de una palabra
- `id` uuid, pk
- `turn_word_id` uuid, fk → `turn_words.id`
- `position` int (orden de la ficha dentro de la palabra, empezando en 0)
- `letter` text (una letra válida del set español: A-Z, Ñ, K incluidas — sin
  W, que no existe en el set físico de Scrabble en español. No existen
  fichas de dígrafo CH, LL ni RR: esas combinaciones se forman con fichas
  individuales repetidas, ej. "RR" se arma con dos fichas de R)
- `is_blank` boolean, default `false`
- `letter_multiplier` int, valores permitidos: `1, 2, 3`. Si `is_blank` es
  `true`, este campo se ignora para el cálculo (una ficha comodín siempre
  vale 0, tenga o no multiplicador marcado)
- `tile_score` int (calculado: `is_blank ? 0 : valor_letra(letter) *
  letter_multiplier`)

**`words_es`** — léxico oficial español para validación
- `word` text, pk o índice único — entradas del léxico FISE, cargadas una
  sola vez desde una lista externa (ver sección 7), no generadas por la app

## 5. Reglas de cálculo de puntaje

```
tile_score(ficha)   = 0                                    si is_blank
                     = valor_letra(letter) * letter_multiplier   si no

base_score(palabra) = suma de tile_score de sus fichas
word_score(palabra) = base_score(palabra) * word_multiplier

total_score(jugada)  = suma de word_score de sus palabras
                      + 50 si bingo_bonus

puntaje_total(jugador, partida) = suma de total_score de todas sus jugadas
                                   en esa partida
```

No se valida disponibilidad de fichas restantes en la "bolsa" (cuántas J,
Z, etc. quedan) — la app confía en lo que el jugador ingresa según sus
fichas físicas reales. No se fuerza turno estricto entre jugadores;
cualquier persona en la partida puede registrar una jugada a nombre de
cualquier jugador de esa partida, en cualquier momento (útil si alguien
anota por otro).

### Tabla de valores de letra (español)

⚠️ **Pendiente de verificar contra la caja física del usuario.** La tabla de
abajo era de una edición con fichas de dígrafo (CH/LL/RR), que el usuario
confirmó que **su edición no tiene** — su set sí incluye K, que tampoco
estaba en esta tabla. Es decir, esta tabla está confirmada como **incorrecta
para la edición real que se va a usar** y no debe tomarse como referencia
para programar el motor de puntaje. Antes de implementar, alguien debe
transcribir la distribución real desde la caja/instructivo físico del
usuario: letra, cantidad de fichas y puntos, para las 27 letras del alfabeto
español (incluida Ñ, incluida K, sin W) más los comodines.

Tabla previa (no usar, solo como referencia de formato mientras se
reemplaza):

| Puntos | Letras |
|---|---|
| 0 | Comodín (×2 fichas en el set físico) |
| 1 | A, E, I, L, N, O, R, S, T, U |
| 2 | D, G |
| 3 | B, C, M, P |
| 4 | F, H, V, Y |
| 5 | Q |
| 8 | J, Ñ, X |
| 10 | Z |

Al no existir fichas de dígrafo, es de esperar que R, L, C y H tengan más
fichas individuales que en la tabla previa (para poder formar RR, LL y CH
letra por letra), y que exista una fila para K con su cantidad/valor — datos
que faltan y deben confirmarse contra la caja física.

## 6. Flujos de usuario

1. **Primer uso:** el usuario elige o crea su perfil (nombre + color) desde
   una lista de perfiles existentes en `profiles`. El `profile_id`
   seleccionado se guarda en `localStorage` del dispositivo, así no hay que
   volver a elegir cada vez que se abre la app en ese dispositivo/navegador.
2. **Pantalla principal:** dos acciones — "Crear partida nueva" (genera
   código, diccionario fijo en `es`, el creador se agrega como jugador) o
   "Unirse con código" (valida que la partida existe y está `in_progress`,
   agrega al perfil actual a `game_players` si no estaba ya).
3. **Pantalla de partida** (sincronizada en tiempo real vía Supabase
   Realtime entre todos los dispositivos conectados a esa `game_id`):
   - Encabezado con el código de la partida y el marcador: jugadores
     ordenados de mayor a menor puntaje total, para ver quién va ganando.
   - Botón "Registrar jugada":
     a. Elegir a qué jugador de la partida se le atribuye (por default el
        perfil del dispositivo, pero cualquiera puede anotar a nombre de
        otro).
     b. Agregar una o más palabras: se escribe la palabra y se convierte en
        fichas visuales; cada ficha se puede marcar con multiplicador de
        letra (x1/x2/x3) o como comodín; cada palabra lleva su multiplicador
        (x1/x2/x3/x4/x9).
     c. Mientras se arma cada palabra, se indica si existe en el léxico
        `words_es` (solo informativo, no bloquea el registro — puede haber
        errores de tipeo o casos límite).
     d. Checkbox "Bingo (usé mis 7 fichas, +50)".
     e. El puntaje total de la jugada se calcula y muestra en vivo mientras
        se arma.
     f. Al guardar, se inserta el `turn` + sus `turn_words` + `turn_word_tiles`,
        y el marcador se actualiza en tiempo real en todos los dispositivos.
   - Historial cronológico de jugadas de la partida actual, mostrando quién
     jugó, las palabras armadas (visualmente, con fichas) y los puntos
     obtenidos. Cualquier jugador de la partida puede eliminar una jugada
     (propia o ajena, dado que es un grupo de confianza) para corregir
     errores de captura — sin historial de ediciones en el MVP.
   - Botón "Terminar partida": marca `status = finished`, fija
     `finished_at`; el ganador es quien tenga mayor `puntaje_total` en ese
     momento.
4. **Pestaña "Diccionario":** buscador independiente de palabras (fuera de
   una jugada), para disputas ad-hoc. Busca contra `words_es`. Si es viable
   sin mucho esfuerzo extra, muestra también una definición vía
   `freedictionaryapi.com` (nice-to-have, no bloqueante).
5. **Pestaña "Reglas":** contenido estático — reglas oficiales de Scrabble en
   español, con espacio para que el usuario agregue sus propias reglas de
   casa más adelante.
6. **Pestaña "Historial/Estadísticas":** lista de partidas terminadas (fecha,
   jugadores, puntaje final de cada uno, ganador) y un resumen agregado por
   perfil (partidas jugadas, partidas ganadas, puntaje promedio).

## 7. Validación de diccionario — origen y carga de datos

- Léxico oficial español: FISE, obtenido y normalizado desde el repositorio
  [kamilmielnik/scrabble-dictionaries](https://github.com/kamilmielnik/scrabble-dictionaries).
  Antes de usarlo, confirmar su licencia (buena práctica aunque el proyecto
  sea personal y no comercial).
- Se importa una sola vez a la tabla `words_es` de Supabase mediante un
  script de carga (parte de la configuración inicial del proyecto, no
  parte del runtime de la app). Se evita así bundlear un archivo grande de
  palabras en el cliente; la búsqueda es una query indexada por palabra
  exacta.
- **Normalización para la búsqueda:** en Scrabble en español las fichas
  físicas no llevan tilde — una palabra armada con fichas puede corresponder
  a una entrada del diccionario con o sin acento (ej. fichas C-A-N-T-O son
  válidas tanto para "canto" como para "cantó"). Por lo tanto, tanto las
  palabras cargadas en `words_es` como las búsquedas del usuario se
  normalizan a mayúsculas y sin diacríticos (tildes) antes de comparar. La
  **Ñ se mantiene como letra distinta** (no se normaliza a N), porque es una
  ficha propia del set español, no una variante acentuada de la N.
- El buscador de palabras (dentro de una jugada o en la pestaña
  Diccionario) hace match exacto contra `words_es` tras esa normalización.

## 8. Seguridad y control de acceso (decisión aceptada)

- No hay autenticación real (sin contraseñas, sin verificación de
  identidad). El acceso a una partida se controla únicamente por conocer su
  código.
- El `anon key` de Supabase queda expuesto en el cliente, como es estándar
  en este tipo de apps. Cualquiera que lo obtenga podría, en teoría, leer o
  escribir directo contra la API sin pasar por la UI. Se acepta este riesgo
  explícitamente: es una app personal, no comercial, con datos de bajo
  valor (puntajes de juegos de mesa entre amigos).
- Se recomienda mantener Row Level Security (RLS) habilitado con políticas
  simples de "cualquiera puede leer/escribir" en vez de deshabilitarlo por
  completo, como buena práctica mínima — sin lógica de autorización
  compleja para el MVP.

## 9. Integraciones externas

- **Léxico FISE:** ver sección 7 — se importa a Supabase, no se consume en
  vivo.
- **Definición de palabras (nice-to-have):** [freedictionaryapi.com](https://freedictionaryapi.com/)
  (basada en Wiktionary, sin API key, soporta español), para mostrar el
  significado de una palabra buscada. No es parte del cálculo de validez
  Scrabble (eso lo resuelve `words_es`), es solo informativo.

## 10. Fuera de alcance (post-MVP)

- Diccionario en inglés (SOWPODS/TWL06).
- Tablero digital con posiciones x/y reales y cálculo automático de
  multiplicadores a partir de la posición.
- Validación de fichas disponibles en la "bolsa".
- Chat, modo espectador, notificaciones push.
- Autenticación real (email/contraseña o magic link).
- Decisiones de UI/UX, tema visual, animaciones, nombre final de marca —
  se definen en una fase posterior de diseño/implementación, con otro
  modelo, a partir de este spec.

## 11. Supuestos y notas para quien implemente

- El nombre del repo actual (`lachulita-web`) se deja como está; el nombre
  final de producto queda abierto para la fase de implementación/diseño.
- La tabla de valores de letra (sección 5) está **pendiente y bloqueante**:
  la obtenida por investigación web resultó ser de una edición distinta a la
  del usuario (tenía dígrafos CH/LL/RR que no existen en su set, y le
  faltaba la K que sí existe). Antes de programar el motor de puntaje,
  alguien debe transcribir la distribución real de la caja física del
  usuario y reemplazar la tabla de la sección 5.
- El campo `dictionary` en `games` existe desde el MVP aunque solo tenga un
  valor posible (`es`), para no requerir una migración de esquema cuando se
  agregue inglés después.
