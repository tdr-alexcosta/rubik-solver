// js/solver-common.js
//
// Peces compartides pels solvers (LBL, CFOP...):
//   - utilitats de seqüències i predicats de les capes
//   - cerca de la creu (BFS)
//   - simplificació global de moviments
//   - Recorder: assigna els moviments a passos i línies per peça
//
// Les peces es numeren com a cube.js: primera capa (blanca) = capa U real,
// última capa (groga) = capa D real.

import { Cube } from "./cube.js";

/* ------------------------------------------------------------
   UTILITATS DE SEQÜÈNCIES
------------------------------------------------------------ */

export const ALL_MOVES = [
  "U", "U'", "U2", "D", "D'", "D2",
  "R", "R'", "R2", "L", "L'", "L2",
  "F", "F'", "F2", "B", "B'", "B2"
];

export function parse(text) {
  return text.trim().split(/\s+/);
}

export function inverseMove(move) {
  if (move.endsWith("2")) return move;
  if (move.endsWith("'")) return move[0];
  return `${move}'`;
}

export function inverseSeq(seq) {
  return [...seq].reverse().map(inverseMove);
}

export function applySeq(cube, seq) {
  for (const move of seq) cube.move(move);
}

/* ------------------------------------------------------------
   PREDICATS (índexs absoluts del model de cube.js)
   Cantonades: 0-3 capa blanca, 4-7 capa groga
   Arestes:    0-3 capa blanca, 4-7 capa groga, 8-11 capa central
------------------------------------------------------------ */

export const edgeOk = (c, i) => c.ep[i] === i && c.eo[i] === 0;
export const cornerOk = (c, i) => c.cp[i] === i && c.co[i] === 0;

export function crossSolved(c) {
  return [0, 1, 2, 3].every(i => edgeOk(c, i));
}

export function firstLayerSolved(c) {
  return crossSolved(c) && [0, 1, 2, 3].every(i => cornerOk(c, i));
}

export function f2lSolved(c) {
  return firstLayerSolved(c) && [8, 9, 10, 11].every(i => edgeOk(c, i));
}

export function yellowCrossSolved(c) {
  return f2lSolved(c) && [4, 5, 6, 7].every(i => c.eo[i] === 0);
}

export function yellowEdgesSolved(c) {
  return f2lSolved(c) && [4, 5, 6, 7].every(i => edgeOk(c, i));
}

export function yellowCornersPositioned(c) {
  return yellowEdgesSolved(c) && [4, 5, 6, 7].every(i => c.cp[i] === i);
}

export const countOk = (c, indices, test) => indices.filter(i => test(c, i)).length;

/* ------------------------------------------------------------
   FASE 1 — CREU BLANCA (BFS sobre les 4 arestes de la creu)
------------------------------------------------------------ */

const EDGE_MOVE_TABLES = ALL_MOVES.map(move => {
  const c = new Cube();
  c.move(move);

  const dest = new Array(12);
  const delta = new Array(12);

  for (let j = 0; j < 12; j++) {
    dest[c.ep[j]] = j;
    delta[c.ep[j]] = c.eo[j];
  }

  return { dest, delta };
});

const CROSS_BASE = 24;
const CROSS_SIZE = CROSS_BASE ** 4;

function crossKey(states) {
  let key = 0;
  for (let e = 3; e >= 0; e--) key = key * CROSS_BASE + states[e];
  return key;
}

export function solveWhiteCross(cube) {
  const start = [0, 0, 0, 0];

  for (let e = 0; e < 4; e++) {
    const pos = cube.ep.indexOf(e);
    start[e] = pos * 2 + cube.eo[pos];
  }

  const startKey = crossKey(start);
  const goalKey = crossKey([0, 2, 4, 6]);

  if (startKey === goalKey) return [];

  const parent = new Int32Array(CROSS_SIZE).fill(-1);
  const parentMove = new Int8Array(CROSS_SIZE);
  const queue = new Int32Array(CROSS_SIZE);

  let head = 0;
  let tail = 0;

  parent[startKey] = startKey;
  queue[tail++] = startKey;

  const states = [0, 0, 0, 0];

  while (head < tail) {
    const key = queue[head++];

    if (key === goalKey) break;

    let rest = key;
    for (let e = 0; e < 4; e++) {
      states[e] = rest % CROSS_BASE;
      rest = Math.floor(rest / CROSS_BASE);
    }

    for (let m = 0; m < ALL_MOVES.length; m++) {
      const table = EDGE_MOVE_TABLES[m];
      let nextKey = 0;

      for (let e = 3; e >= 0; e--) {
        const pos = states[e] >> 1;
        const ori = states[e] & 1;
        nextKey =
          nextKey * CROSS_BASE +
          table.dest[pos] * 2 +
          (ori ^ table.delta[pos]);
      }

      if (parent[nextKey] !== -1) continue;

      parent[nextKey] = key;
      parentMove[nextKey] = m;
      queue[tail++] = nextKey;
    }
  }

  if (parent[goalKey] === -1) {
    throw new Error("LBL: no s'ha pogut trobar la creu blanca.");
  }

  const moves = [];
  let key = goalKey;

  while (key !== startKey) {
    moves.push(ALL_MOVES[parentMove[key]]);
    key = parent[key];
  }

  moves.reverse();
  applySeq(cube, moves);

  if (!crossSolved(cube)) {
    throw new Error("LBL: la creu blanca no ha quedat resolta.");
  }

  return moves;
}

/* ------------------------------------------------------------
   SIMPLIFICACIÓ GLOBAL

   Dos girs de la mateixa cara (o del mateix gir de cub) es
   combinen encara que hi hagi pel mig girs que hi commuten:
   D' y D' → D2 y   |   U' (fi d'un pas) + U (inici del següent) → res

   Commuten els girs sobre el mateix eix: U/D/y, R/L/x, F/B/z.
------------------------------------------------------------ */

// Els girs sobre el mateix eix commuten (incloent amplis i de capa central).
const AXIS = {
  U: "y", D: "y", y: "y", u: "y", d: "y", E: "y",
  R: "x", L: "x", x: "x", r: "x", l: "x", M: "x",
  F: "z", B: "z", z: "z", f: "z", b: "z", S: "z"
};

const quarterTurns = m => (m.endsWith("2") ? 2 : m.endsWith("'") ? 3 : 1);

function formatTurns(letter, total) {
  if (total === 1) return letter;
  if (total === 2) return `${letter}2`;
  return `${letter}'`;
}

function simplifyPass(tokens) {
  const out = [];
  let changed = false;

  for (const token of tokens) {
    let partner = -1;

    for (let j = out.length - 1; j >= 0; j--) {
      if (out[j].move[0] === token.move[0]) {
        partner = j;
        break;
      }

      if (AXIS[out[j].move[0]] !== AXIS[token.move[0]]) break;
    }

    if (partner === -1) {
      out.push({ ...token });
      continue;
    }

    changed = true;

    const total =
      (quarterTurns(out[partner].move) + quarterTurns(token.move)) % 4;

    if (total === 0) {
      out.splice(partner, 1);
    } else {
      out[partner].move = formatTurns(token.move[0], total);
    }
  }

  return { out, changed };
}

// tokens: [{ move, unit }]. El resultat conserva la unitat del primer gir.
export function simplifyTokens(tokens) {
  let current = tokens;

  for (;;) {
    const { out, changed } = simplifyPass(current);
    current = out;
    if (!changed) return current;
  }
}

/* ------------------------------------------------------------
   RECORDER
   Cada "unitat" és una línia de la sortida (una peça o un
   algorisme). Acaba al primer gir que deixa la peça al seu lloc;
   els girs que sobren passen a la unitat següent.
------------------------------------------------------------ */

// Primer prefix de `moves` que compleix `goal`.
function cutIndex(before, moves, goal) {
  const cube = before.clone();

  if (goal(cube)) return 0;

  for (let i = 0; i < moves.length; i++) {
    cube.move(moves[i]);
    if (goal(cube)) return i + 1;
  }

  return moves.length;
}

export class Recorder {
  constructor(method, stepsMeta) {
    this.method = method;
    this.stepsMeta = stepsMeta;
    this.flat = [];
    this.units = [];
  }

  addUnit(step, label, before, moves, goal) {
    this.units.push({
      step,
      label,
      end: this.flat.length + cutIndex(before, moves, goal)
    });

    this.flat.push(...moves);
  }

  // Moviments que no pertanyen a cap peça en concret (p. ex. un gir inicial).
  addRaw(moves) {
    this.flat.push(...moves);
  }

  static emptyResult(method, stepsMeta) {
    const steps = stepsMeta.map(s => ({
      id: s.id,
      name: s.name,
      lines: [{ label: s.label, moves: [] }]
    }));

    return {
      method,
      moves: [],
      steps,
      phases: steps.map(s => ({ id: s.id, name: s.name, moves: [] })),
      solved: true
    };
  }

  build(inputCube) {
    const { flat, units, stepsMeta } = this;

    const tokens = flat.map((move, index) => {
      let unit = units.findIndex(u => index < u.end);
      if (unit === -1) unit = units.length - 1;
      return { move, unit };
    });

    const simplified = simplifyTokens(tokens);
    const moves = simplified.map(t => t.move);

    // Comprovació independent sobre l'estat original.
    const check = inputCube.clone();
    applySeq(check, moves);

    if (!check.isSolved()) {
      throw new Error(`${this.method}: la solució no resol el cub d'entrada.`);
    }

    const steps = stepsMeta.map(s => ({ id: s.id, name: s.name, lines: [] }));

    units.forEach((unit, index) => {
      const unitMoves = simplified
        .filter(t => t.unit === index)
        .map(t => t.move);

      if (unitMoves.length > 0) {
        steps[unit.step - 1].lines.push({ label: unit.label, moves: unitMoves });
      }
    });

    steps.forEach((step, i) => {
      if (step.lines.length === 0) {
        step.lines.push({ label: stepsMeta[i].label, moves: [] });
      }
    });

    return {
      method: this.method,
      moves,
      steps,
      phases: steps.map(step => ({
        id: step.id,
        name: step.name,
        moves: step.lines.flatMap(line => line.moves)
      })),
      solved: true
    };
  }
}

/*
  Text de la solució:

    STEP 1
    U B D2 R2 F2 // white cross

    STEP 2
    ...
*/
export function formatSteps(result) {
  return result.steps
    .map(step => {
      const lines = step.lines.map(line => {
        const text = line.moves.length > 0 ? line.moves.join(" ") : "—";
        return `${text} // ${line.label}`;
      });

      return `STEP ${step.id}\n${lines.join("\n")}`;
    })
    .join("\n\n");
}
