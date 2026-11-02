// js/cfop.js
//
// CFOP — Cross, F2L, OLL, PLL.
//
//   1. Cross   Creu blanca a baix (primer gir: x2). Cerca exhaustiva (BFS),
//              és a dir, el mínim de moviments possible.
//   2. F2L     Les quatre parelles cantonada + aresta, una per una, com ho fa
//              una persona: amb una taula d'algorismes d'F2L (cfop-algs.js),
//              girs de la capa superior (AUF) i girs de cub (y). Una cerca
//              (Dijkstra) combina aquests blocs i escull sempre la parella i
//              la seqüència amb menys moviments. Només si cap combinació no
//              resol cap parella s'usa la cerca exacta antiga (pairSearch),
//              que queda com a recurs de seguretat (vegeu f2lStats).
//   3. OLL     Taula de 57 algorismes (cfop-algs.js) i AUF previ.
//   4. PLL     Taula de 21 algorismes (cfop-algs.js), AUF previ i posterior.
//
// Tot es comprova sobre l'estat real de cube.js; cap seqüència es dóna per
// bona sense aplicar-la.

import { Cube } from "./cube.js";
import { OLL, PLL, F2L } from "./cfop-algs.js";

import {
  applySeq,
  edgeOk,
  cornerOk,
  crossSolved,
  f2lSolved,
  solveWhiteCross,
  Recorder,
  formatSteps
} from "./solver-common.js";

const STEPS = [
  { id: 1, name: "Creu", label: "cross" },
  { id: 2, name: "F2L", label: "F2L" },
  { id: 3, name: "OLL", label: "OLL skip" },
  { id: 4, name: "PLL", label: "PLL skip" }
];

/* ------------------------------------------------------------
   UTILITATS
------------------------------------------------------------ */

// Els girs de cub (x, y, z) no compten com a moviments.
const countMoves = seq => seq.filter(m => !"xyz".includes(m[0])).length;

const AUF = [[], ["U"], ["U'"], ["U2"]];

const lastLayerOriented = c =>
  [4, 5, 6, 7].every(i => c.co[i] === 0 && c.eo[i] === 0);

// Dona per bona una unitat només quan s'han aplicat TOTS els seus moviments.
function endOfUnit(length) {
  let calls = 0;
  return () => ++calls === length + 1;
}

/* ------------------------------------------------------------
   PAS 1 — CREU (blanc a baix)
------------------------------------------------------------ */

// Primer es resol la creu a la capa blanca real (U) amb la cerca òptima
// i després es tradueix a la vista amb el blanc a baix (x2):
// U ↔ D i F ↔ B (L i R no canvien).
const VISIBLE_AFTER_X2 = { U: "D", D: "U", F: "B", B: "F", L: "L", R: "R" };

function crossMoves(cube) {
  const work = cube.clone();
  const real = solveWhiteCross(work);

  return [
    "x2",
    ...real.map(move => VISIBLE_AFTER_X2[move[0]] + move.slice(1))
  ];
}

/* ------------------------------------------------------------
   PAS 2 — F2L

   Taules de transició de cada gir sobre l'estat d'una sola peça:
     aresta   = posició * 2 + orientació   (24 estats)
     cantonada = posició * 3 + orientació   (24 estats)
------------------------------------------------------------ */

const FACES = "UDRLFB";
const SUFFIXES = ["", "2", "'"];
const INVERSE_SUFFIX = { "": "'", "'": "", "2": "2" };

const moveIndex = (face, suffix) =>
  FACES.indexOf(face) * 3 + SUFFIXES.indexOf(suffix);

const EDGE_NEXT = [];
const CORNER_NEXT = [];

for (const face of FACES) {
  for (const suffix of SUFFIXES) {
    const c = new Cube();
    c.move(face + suffix);

    const edgeDest = new Array(12);
    const edgeDelta = new Array(12);

    for (let j = 0; j < 12; j++) {
      edgeDest[c.ep[j]] = j;
      edgeDelta[c.ep[j]] = c.eo[j];
    }

    const cornerDest = new Array(8);
    const cornerDelta = new Array(8);

    for (let j = 0; j < 8; j++) {
      cornerDest[c.cp[j]] = j;
      cornerDelta[c.cp[j]] = c.co[j];
    }

    const edges = new Int8Array(24);
    const corners = new Int8Array(24);

    for (let pos = 0; pos < 12; pos++) {
      for (let ori = 0; ori < 2; ori++) {
        edges[pos * 2 + ori] =
          edgeDest[pos] * 2 + (ori ^ edgeDelta[pos]);
      }
    }

    for (let pos = 0; pos < 8; pos++) {
      for (let ori = 0; ori < 3; ori++) {
        corners[pos * 3 + ori] =
          cornerDest[pos] * 3 + ((ori + cornerDelta[pos]) % 3);
      }
    }

    EDGE_NEXT.push(edges);
    CORNER_NEXT.push(corners);
  }
}

// Parella i = cantonada i + aresta 8 + i (índexs reals de cube.js).
const PAIR_NAMES = [
  "green-red",
  "green-orange",
  "blue-orange",
  "blue-red"
];

const pairSolved = (c, p) => cornerOk(c, p) && edgeOk(c, 8 + p);

function stateKey(state) {
  let key = "";
  for (let i = 0; i < state.length; i++) {
    key += String.fromCharCode(48 + state[i]);
  }
  return key;
}

/*
  Cerca bidireccional exacta de la seqüència més curta que deixa
  resoltes la creu, les parelles `solved` i la parella `pair`.

  Només es segueixen les peces que cal conservar; les altres no importen.
  `faces` són les cares (vistes) permeses. Retorna els moviments o null.
*/
function pairSearch(cube, pair, solved, faces, maxDepth) {
  const edgeIds = [0, 1, 2, 3, ...[...solved, pair].map(q => 8 + q)];
  const cornerIds = [...solved, pair];

  const edgeCount = edgeIds.length;
  const size = edgeCount + cornerIds.length;

  const start = new Int8Array(size);
  const goal = new Int8Array(size);

  edgeIds.forEach((id, k) => {
    const pos = cube.ep.indexOf(id);
    start[k] = pos * 2 + cube.eo[pos];
    goal[k] = id * 2;
  });

  cornerIds.forEach((id, k) => {
    const pos = cube.cp.indexOf(id);
    start[edgeCount + k] = pos * 3 + cube.co[pos];
    goal[edgeCount + k] = id * 3;
  });

  const startKey = stateKey(start);
  const goalKey = stateKey(goal);

  if (startKey === goalKey) return [];

  // Moviments permesos: cara vista → cara real segons el frame actual.
  const moves = [];

  for (const face of faces) {
    for (const suffix of SUFFIXES) {
      const real = cube.frame[face];

      moves.push({
        token: face + suffix,
        forward: moveIndex(real, suffix),
        backward: moveIndex(real, INVERSE_SUFFIX[suffix])
      });
    }
  }

  const apply = (state, mi) => {
    const next = new Int8Array(size);

    for (let k = 0; k < edgeCount; k++) {
      next[k] = EDGE_NEXT[mi][state[k]];
    }

    for (let k = edgeCount; k < size; k++) {
      next[k] = CORNER_NEXT[mi][state[k]];
    }

    return next;
  };

  const forward = new Map([[startKey, { parent: null, move: -1 }]]);
  const backward = new Map([[goalKey, { parent: null, move: -1 }]]);

  let forwardFrontier = [{ state: start, key: startKey }];
  let backwardFrontier = [{ state: goal, key: goalKey }];

  let forwardDepth = 0;
  let backwardDepth = 0;

  function path(meetKey) {
    const first = [];

    for (let k = meetKey; forward.get(k).parent !== null; ) {
      const info = forward.get(k);
      first.push(moves[info.move].token);
      k = info.parent;
    }

    first.reverse();

    for (let k = meetKey; backward.get(k).parent !== null; ) {
      const info = backward.get(k);
      first.push(moves[info.move].token);
      k = info.parent;
    }

    return first;
  }

  while (forwardDepth + backwardDepth < maxDepth) {
    const goForward = forwardFrontier.length <= backwardFrontier.length;

    const frontier = goForward ? forwardFrontier : backwardFrontier;
    const own = goForward ? forward : backward;
    const other = goForward ? backward : forward;

    const next = [];

    for (const node of frontier) {
      for (let m = 0; m < moves.length; m++) {
        const state = apply(
          node.state,
          goForward ? moves[m].forward : moves[m].backward
        );

        const key = stateKey(state);

        if (own.has(key)) continue;

        own.set(key, { parent: node.key, move: m });

        if (other.has(key)) return path(key);

        next.push({ state, key });
      }
    }

    if (goForward) {
      forwardFrontier = next;
      forwardDepth++;
    } else {
      backwardFrontier = next;
      backwardDepth++;
    }

    if (next.length === 0) return null;
  }

  return null;
}

const ROTATION_OPTIONS = [[], ["y"], ["y'"], ["y2"]];

// Primer es proven només R, U, F (el més humà); si cap parella no es
// pot resoldre així, es permeten també L i B.
const FACE_SETS = [
  ["U", "R", "F"],
  ["U", "R", "F", "L", "B"]
];

const DEPTH_STEPS = [6, 8, 10, 12];

function chooseNextPair(cube, solved, remaining) {
  for (const faces of FACE_SETS) {
    for (const depth of DEPTH_STEPS) {
      let best = null;

      for (const pair of remaining) {
        for (const rotation of ROTATION_OPTIONS) {
          const turned = cube.clone();
          applySeq(turned, rotation);

          const moves = pairSearch(turned, pair, solved, faces, depth);

          if (!moves) continue;

          const cost = [countMoves(moves), rotation.length, pair];

          if (
            !best ||
            cost[0] < best.cost[0] ||
            (cost[0] === best.cost[0] && cost[1] < best.cost[1])
          ) {
            best = { pair, rotation, moves, cost };
          }
        }
      }

      if (best) return best;
    }
  }

  throw new Error("CFOP: no s'ha pogut resoldre cap parella de F2L.");
}


/* ------------------------------------------------------------
   F2L HUMÀ: cerca sobre blocs (AUF, girs de cub i algorismes)

   Els blocs són els girs de la capa superior, els girs de cub y,
   i cada algorisme de la taula F2L (també la seva imatge mirall,
   per al forat esquerre). La cerca és un Dijkstra pel nombre de
   moviments (els girs de cub no compten, però desempaten: a igual
   nombre de moviments es prefereix la solució amb menys girs de cub).
   Un bloc només s'accepta si la creu i les parelles ja resoltes
   continuen al seu lloc.
------------------------------------------------------------ */

// Imatge mirall (pla esquerra-dreta): R <-> L i cada gir en sentit contrari.
function mirrorMove(move) {
  const face = move[0] === "R" ? "L" : move[0] === "L" ? "R" : move[0];
  const rest = move.slice(1);

  return face + (rest === "2" ? "2" : rest === "'" ? "" : "'");
}

const isAuf = move => move[0] === "U";

// Treu els U del principi i del final: els cobreixen els blocs d'AUF.
function stripAuf(seq) {
  let a = 0;
  let b = seq.length;

  while (a < b && isAuf(seq[a])) a++;
  while (b > a && isAuf(seq[b - 1])) b--;

  return seq.slice(a, b);
}

const HUMAN_BLOCKS = (() => {
  const blocks = [];
  const seen = new Set();

  const add = (seq, rotations) => {
    if (seq.length === 0) return;

    const key = seq.join(" ");
    if (seen.has(key)) return;
    seen.add(key);

    blocks.push({ seq, cost: countMoves(seq) * 100 + rotations });
  };

  for (const seq of [["U"], ["U'"], ["U2"]]) add(seq, 0);
  for (const seq of [["y"], ["y'"], ["y2"]]) add(seq, 1);

  for (const alg of F2L) {
    const core = stripAuf(alg);

    add(core, 0);
    add(core.map(mirrorMove), 0);
  }

  return blocks;
})();

const MAX_HUMAN_MOVES = 12;

// 0 = algorisme, 1 = gir de la capa superior (AUF), 2 = gir de cub.
// Dos blocs seguits d'AUF o de gir de cub sempre es poden fusionar en un.
const blockKind = block =>
  block.seq.length === 1 ? (block.seq[0][0] === "U" ? 1 : 2) : 0;

for (const block of HUMAN_BLOCKS) block.kind = blockKind(block);

/*
  Un estat és un sol Int8Array de 40 posicions:
    0-7   cp   8-15  co   16-27 ep   28-39 eo
  Un bloc és una taula del mateix format (igual que les taules de
  moviments de cube.js), calculada un sol cop per a cada orientació.
*/
const CP = 0;
const CO = 8;
const EP = 16;
const EO = 28;

const TABLE_CACHE = new Map();

function blockTable(blockIndex, frame, frameKey) {
  const cacheKey = `${blockIndex}|${frameKey}`;

  let table = TABLE_CACHE.get(cacheKey);
  if (table) return table;

  const probe = new Cube();
  probe.frame = { ...frame };

  applySeq(probe, HUMAN_BLOCKS[blockIndex].seq);

  const data = new Int8Array(40);
  data.set(probe.cp, CP);
  data.set(probe.co, CO);
  data.set(probe.ep, EP);
  data.set(probe.eo, EO);

  table = { data, frame: probe.frame, frameKey: probe.orientationKey() };

  TABLE_CACHE.set(cacheKey, table);
  return table;
}

/*
  Clau de l'estat: només compten les peces d'F2L (creu, cantonades de la
  capa blanca i arestes del mig). Les peces de l'última capa no importen
  per decidir quin bloc va millor; ignorar-les redueix moltíssim la cerca.
*/
const KEY_BUFFER = new Uint16Array(32);

function f2lKey(a, frameKey) {
  let n = 0;

  for (let pos = 0; pos < 8; pos++) {
    const id = a[CP + pos];
    if (id < 4) KEY_BUFFER[n++] = 1 + (pos * 4 + id) * 3 + a[CO + pos];
  }

  for (let pos = 0; pos < 12; pos++) {
    const id = a[EP + pos];
    if (id < 4 || id >= 8) {
      KEY_BUFFER[n++] = 200 + (pos * 8 + (id < 4 ? id : id - 4)) * 2 + a[EO + pos];
    }
  }

  return frameKey + String.fromCharCode.apply(null, KEY_BUFFER.subarray(0, n));
}

const pairIsSolved = (a, p) =>
  a[CP + p] === p && a[CO + p] === 0 &&
  a[EP + 8 + p] === 8 + p && a[EO + 8 + p] === 0;

function humanSearch(cube, solved, remaining) {
  // Posicions que han de quedar al seu lloc després d'un bloc.
  const needEdges = [0, 1, 2, 3, ...solved.map(p => 8 + p)];
  const needCorners = solved;

  const limit = MAX_HUMAN_MOVES * 100 + 99;

  const start = new Int8Array(40);
  start.set(cube.cp, CP);
  start.set(cube.co, CO);
  start.set(cube.ep, EP);
  start.set(cube.eo, EO);

  const frameKey = cube.orientationKey();

  const root = {
    a: start,
    frame: { ...cube.frame },
    frameKey,
    key: f2lKey(start, frameKey),
    parent: null,
    block: -1,
    kind: 0
  };

  const buckets = Array.from({ length: limit + 1 }, () => []);
  const best = new Map([[root.key, 0]]);

  buckets[0].push(root);

  for (let cost = 0; cost <= limit; cost++) {
    for (const node of buckets[cost]) {
      if (best.get(node.key) < cost) continue;

      const a = node.a;
      const pair = remaining.find(p => pairIsSolved(a, p));

      if (pair !== undefined && cost > 0) {
        const chain = [];

        for (let n = node; n.parent; n = n.parent) {
          chain.push(HUMAN_BLOCKS[n.block].seq);
        }

        return { pair, sequence: chain.reverse().flat() };
      }

      for (let b = 0; b < HUMAN_BLOCKS.length; b++) {
        const block = HUMAN_BLOCKS[b];

        if (block.kind !== 0 && block.kind === node.kind) continue;

        const nextCost = cost + block.cost;
        if (nextCost > limit) continue;

        const table = blockTable(b, node.frame, node.frameKey);
        const t = table.data;

        // Rebutja el bloc abans de calcular res si desfà la creu o una parella.
        let ok = true;

        for (let k = 0; ok && k < needEdges.length; k++) {
          const e = needEdges[k];
          const src = t[EP + e];
          ok = a[EP + src] === e && (a[EO + src] ^ t[EO + e]) === 0;
        }

        for (let k = 0; ok && k < needCorners.length; k++) {
          const c = needCorners[k];
          const src = t[CP + c];
          ok = a[CP + src] === c && (a[CO + src] + t[CO + c]) % 3 === 0;
        }

        if (!ok) continue;

        const next = new Int8Array(40);

        for (let i = 0; i < 8; i++) {
          const src = t[CP + i];
          next[CP + i] = a[CP + src];
          next[CO + i] = (a[CO + src] + t[CO + i]) % 3;
        }

        for (let i = 0; i < 12; i++) {
          const src = t[EP + i];
          next[EP + i] = a[EP + src];
          next[EO + i] = a[EO + src] ^ t[EO + i];
        }

        const key = f2lKey(next, table.frameKey);

        if (best.has(key) && best.get(key) <= nextCost) continue;

        best.set(key, nextCost);

        buckets[nextCost].push({
          a: next,
          frame: table.frame,
          frameKey: table.frameKey,
          key,
          parent: node,
          block: b,
          kind: block.kind
        });
      }
    }

    buckets[cost] = null;
  }

  return null;
}

// Quantes parelles s'han resolt amb la taula d'F2L i quantes amb la cerca antiga.
export const f2lStats = { human: 0, fallback: 0 };

function solveF2L(cube, rec) {
  const solved = [0, 1, 2, 3].filter(p => pairSolved(cube, p));

  let remaining = [0, 1, 2, 3].filter(p => !solved.includes(p));

  while (remaining.length > 0) {
    let choice;
    let sequence;

    const human = humanSearch(cube, solved, remaining);

    if (human) {
      f2lStats.human++;
      choice = { pair: human.pair };
      sequence = human.sequence;
    } else {
      f2lStats.fallback++;
      choice = chooseNextPair(cube, solved, remaining);
      sequence = [...choice.rotation, ...choice.moves];
    }

    const before = cube.clone();
    applySeq(cube, sequence);

    const done = [...solved, choice.pair];

    const goal = c => crossSolved(c) && done.every(p => pairSolved(c, p));

    if (!goal(cube)) {
      throw new Error("CFOP: la parella de F2L no ha quedat resolta.");
    }

    rec.addUnit(
      2,
      `${PAIR_NAMES[choice.pair]} pair`,
      before,
      sequence,
      goal
    );

    solved.push(choice.pair);
    remaining = remaining.filter(p => p !== choice.pair);
  }

  if (!f2lSolved(cube)) {
    throw new Error("CFOP: les dues primeres capes no han quedat resoltes.");
  }
}

/* ------------------------------------------------------------
   PAS 3 — OLL
------------------------------------------------------------ */

function solveOLL(cube, rec) {
  if (lastLayerOriented(cube)) return;

  let best = null;

  for (const entry of OLL) {
    for (const pre of AUF) {
      const test = cube.clone();
      applySeq(test, pre);
      applySeq(test, entry.alg);

      if (!f2lSolved(test) || !lastLayerOriented(test)) continue;

      const length = countMoves(pre) + countMoves(entry.alg);

      if (!best || length < best.length) {
        best = { entry, pre, length };
      }
    }
  }

  if (!best) {
    throw new Error("CFOP: no s'ha trobat cap OLL per aquest cas.");
  }

  const sequence = [...best.pre, ...best.entry.alg];
  const before = cube.clone();

  applySeq(cube, sequence);

  const name = best.entry.name ? ` (${best.entry.name})` : "";

  rec.addUnit(
    3,
    `OLL ${best.entry.id}${name}`,
    before,
    sequence,
    endOfUnit(sequence.length)
  );
}

/* ------------------------------------------------------------
   PAS 4 — PLL
------------------------------------------------------------ */

function solvePLL(cube, rec) {
  if (cube.isSolved()) return;

  let best = null;

  // Només AUF (la capa ja està permutada, falta girar-la).
  for (const pre of AUF) {
    const test = cube.clone();
    applySeq(test, pre);

    if (test.isSolved()) {
      const length = countMoves(pre);

      if (!best || length < best.length) {
        best = { label: "AUF", sequence: [...pre], length };
      }
    }
  }

  for (const entry of PLL) {
    for (const pre of AUF) {
      for (const post of AUF) {
        const test = cube.clone();
        applySeq(test, pre);
        applySeq(test, entry.alg);
        applySeq(test, post);

        if (!test.isSolved()) continue;

        const length =
          countMoves(pre) + countMoves(entry.alg) + countMoves(post);

        if (!best || length < best.length) {
          best = {
            label: `${entry.id} perm`,
            sequence: [...pre, ...entry.alg, ...post],
            length
          };
        }
      }
    }
  }

  if (!best) {
    throw new Error("CFOP: no s'ha trobat cap PLL per aquest cas.");
  }

  const before = cube.clone();

  applySeq(cube, best.sequence);

  rec.addUnit(
    4,
    best.label,
    before,
    best.sequence,
    endOfUnit(best.sequence.length)
  );
}

/* ------------------------------------------------------------
   SOLVER PRINCIPAL
------------------------------------------------------------ */

export function solveCFOP(inputCube) {
  if (!(inputCube instanceof Cube)) {
    throw new TypeError("solveCFOP espera una instància de Cube.");
  }

  if (inputCube.orientationKey() !== new Cube().orientationKey()) {
    throw new Error(
      "CFOP: el cub ha d'estar en l'orientació inicial (verd davant, blanc a dalt)."
    );
  }

  const cube = inputCube.clone();

  if (!cube.isValid()) {
    throw new Error("CFOP: l'estat del cub no és vàlid.");
  }

  // Cub ja resolt: no cal cap gir (ni tan sols el x2).
  if (cube.isSolved()) {
    return Recorder.emptyResult("CFOP", STEPS);
  }

  const rec = new Recorder("CFOP", STEPS);

  // 1. Cross (x2 + creu blanca a baix)
  const cross = crossMoves(cube);
  const beforeCross = cube.clone();

  applySeq(cube, cross);

  if (!crossSolved(cube)) {
    throw new Error("CFOP: la creu no ha quedat resolta.");
  }

  rec.addUnit(1, "white cross", beforeCross, cross, crossSolved);

  // 2. F2L
  solveF2L(cube, rec);

  // 3. OLL
  solveOLL(cube, rec);

  // 4. PLL
  solvePLL(cube, rec);

  if (!cube.isSolved()) {
    throw new Error("CFOP: el solver ha acabat però el cub no està resolt.");
  }

  return rec.build(inputCube);
}

export const formatCFOP = formatSteps;
