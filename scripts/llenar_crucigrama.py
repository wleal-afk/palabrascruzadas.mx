#!/usr/bin/env python3
"""Genera una cuadrícula de crucigrama 15x15 llena con palabras en español.

La IA es mala llenando cuadrículas, así que esto lo hace un programa: elige un
patrón de casillas negras con simetría rotacional y lo llena por
retroceso (backtracking) con palabras de data/palabras-crucigrama.txt, que
está ordenada de más a menos común. Después alguien (o la tarea programada)
escribe las pistas.

Uso:
    python3 scripts/llenar_crucigrama.py --semilla 7 > cuadricula.txt

Imprime 15 renglones, con "#" para las casillas negras.
"""

import argparse
import random
import sys
import time
from pathlib import Path

TAM = 15
RAIZ = Path(__file__).resolve().parent.parent

# Palabras que no se pueden definir bien en una pista.
EXCLUIDAS = set(
    """QUE POR UNA LOS CON PARA ESTA PERO ESO LAS DEL COMO AQUI MAS ESTO TODO
    MUY ASI HAY NOS NADA PUES ESE ESA ESOS ESAS ESTE ESTOS ESTAS USTED CUAL
    SUS MIS TUS LES ELLA ELLO ELLOS ELLAS SIN TAN AUN QUIEN DONDE CUANDO
    SOBRE ENTRE HACIA HASTA DESDE SEGUN CONTRA TRAS MEDIANTE AQUEL AQUELLA
    NUESTRO NUESTRA VUESTRO VUESTRA CUYO CUYA OTRO OTRA OTROS OTRAS
    RAMERA RAMERAS PUTA PUTAS PUTO PUTOS GAY GAYS MARICA MARICON ZORRA PERRA
    NEGRATA CULO CULOS MIERDA COÑO JODER JODIDO VERGA PENE PENES TETAS NAZI
    NAZIS DROGA DROGAS COCA HEROINA SUICIDIO VIOLAR VIOLADOR MATAR
    ORINAR ORINANDO ORINO TIROTEO TIROTEOS CADAVER CADAVERES""".split()
)


def aceptable(p):
    # Fuera las formas de "vosotros" (habláis, coméis), poco usadas en México.
    return p not in EXCLUIDAS and not (len(p) >= 5 and p.endswith(("AIS", "EIS")))


def cargar_palabras(maximo):
    lineas = (RAIZ / "data" / "palabras-crucigrama.txt").read_text().split()
    return [p for p in lineas[:maximo] if aceptable(p)]


def patron_aleatorio(rng, negras, largo_max):
    """Casillas negras con simetría rotacional, sin palabras de menos de 3 letras."""
    for _ in range(2000):
        g = [[False] * TAM for _ in range(TAM)]
        colocadas = 0
        celdas = [(f, c) for f in range(TAM) for c in range(TAM)]
        rng.shuffle(celdas)
        for f, c in celdas:
            if colocadas >= negras:
                break
            if g[f][c]:
                continue
            g[f][c] = g[TAM - 1 - f][TAM - 1 - c] = True
            if patron_valido(g):
                colocadas += 1 if (f, c) == (TAM - 1 - f, TAM - 1 - c) else 2
            else:
                g[f][c] = g[TAM - 1 - f][TAM - 1 - c] = False
        if colocadas >= negras and max(len(t) for t in tramos(g)) <= largo_max:
            return g
    raise SystemExit("No se encontró un patrón válido")


def tramos(g):
    """Lista de (celdas) por cada palabra horizontal y vertical."""
    res = []
    for horizontal in (True, False):
        for a in range(TAM):
            actual = []
            for b in range(TAM + 1):
                f, c = (a, b) if horizontal else (b, a)
                if b < TAM and not g[f][c]:
                    actual.append((f, c))
                else:
                    if actual:
                        res.append(actual)
                    actual = []
    return res


def patron_valido(g):
    if any(len(t) < 3 for t in tramos(g)):
        return False
    # Todas las casillas blancas conectadas.
    blancas = [(f, c) for f in range(TAM) for c in range(TAM) if not g[f][c]]
    vistos, pila = {blancas[0]}, [blancas[0]]
    while pila:
        f, c = pila.pop()
        for df, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (f + df, c + dc)
            if 0 <= n[0] < TAM and 0 <= n[1] < TAM and not g[n[0]][n[1]] and n not in vistos:
                vistos.add(n)
                pila.append(n)
    return len(vistos) == len(blancas)


class Llenador:
    """Backtracking con máscaras de bits: cada (largo, posición, letra) guarda
    un entero cuyos bits marcan qué palabras de ese largo cumplen."""

    def __init__(self, g, palabras, rng, limite_seg):
        self.tramos = tramos(g)
        self.cruces = {i: set() for i in range(len(self.tramos))}
        por_celda = {}
        for i, t in enumerate(self.tramos):
            for celda in t:
                por_celda.setdefault(celda, []).append(i)
        for ids in por_celda.values():
            for i in ids:
                self.cruces[i].update(j for j in ids if j != i)
        self.letras = {}
        self.usadas = set()
        self.rng = rng
        self.limite = time.time() + limite_seg
        self.lista = {}
        self.mascara = {}
        for p in palabras:
            self.lista.setdefault(len(p), []).append(p)
        for largo, lista in self.lista.items():
            for n, p in enumerate(lista):
                for i, letra in enumerate(p):
                    clave = (largo, i, letra)
                    self.mascara[clave] = self.mascara.get(clave, 0) | (1 << n)
        self.todas = {largo: (1 << len(lista)) - 1 for largo, lista in self.lista.items()}

    def posibles(self, i):
        t = self.tramos[i]
        m = self.todas.get(len(t), 0)
        for pos, celda in enumerate(t):
            letra = self.letras.get(celda)
            if letra:
                m &= self.mascara.get((len(t), pos, letra), 0)
                if not m:
                    return 0
        return m

    def palabras_de(self, i, m):
        lista = self.lista[len(self.tramos[i])]
        res = []
        n = 0
        while m:
            if m & 1:
                res.append(lista[n])
            m >>= 1
            n += 1
        return res

    def llenar(self, pendientes):
        if time.time() > self.limite:
            return False
        if not pendientes:
            return True
        # El tramo con menos opciones primero.
        mejor, mejor_m, menor = None, 0, None
        for i in pendientes:
            m = self.posibles(i)
            cuenta = m.bit_count()
            if cuenta == 0:
                return False
            if menor is None or cuenta < menor:
                mejor, mejor_m, menor = i, m, cuenta
        resto = pendientes - {mejor}
        cands = [p for p in self.palabras_de(mejor, mejor_m) if p not in self.usadas]
        # Las listas ya vienen de más a menos común; algo de azar para variar.
        cands = [p for _, p in sorted(enumerate(cands), key=lambda x: x[0] * (0.6 + self.rng.random()))]
        for palabra in cands[:40]:
            tramo = self.tramos[mejor]
            puestas = [c for c in tramo if c not in self.letras]
            for c, l in zip(tramo, palabra):
                self.letras[c] = l
            self.usadas.add(palabra)
            if all(self.posibles(j) for j in self.cruces[mejor] if j in resto) and self.llenar(resto):
                return True
            self.usadas.discard(palabra)
            for c in puestas:
                del self.letras[c]
        return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--semilla", type=int, default=1)
    ap.add_argument("--negras", type=int, default=40)
    ap.add_argument("--largo-max", type=int, default=9, help="palabra más larga permitida")
    ap.add_argument("--vocabulario", type=int, default=25000, help="cuántas palabras comunes usar")
    ap.add_argument("--intentos", type=int, default=40)
    ap.add_argument("--segundos", type=float, default=20)
    args = ap.parse_args()

    rng = random.Random(args.semilla)
    palabras = cargar_palabras(args.vocabulario)
    for intento in range(args.intentos):
        g = patron_aleatorio(rng, args.negras, args.largo_max)
        ll = Llenador(g, palabras, rng, args.segundos)
        if ll.llenar(frozenset(range(len(ll.tramos)))):
            for f in range(TAM):
                print("".join("#" if g[f][c] else ll.letras[(f, c)] for c in range(TAM)))
            print(f"Listo en el intento {intento + 1}", file=sys.stderr)
            return
        print(f"Intento {intento + 1} sin solución", file=sys.stderr)
    raise SystemExit("No se pudo llenar la cuadrícula")


if __name__ == "__main__":
    main()
