// js/optimal.js
//
// Solucionador de poques passes: algorisme de dues fases de Kociemba sobre
// el model de cube.js, més una comprovació exacta d'optimalitat.
//
//   Fase 1  Porta el cub al grup G1 = <U, D, R2, L2, F2, B2>
//           (orientacions correctes i arestes de la capa central a la capa
//           central). Coordenades: gir de cantonades (3^7), gir d'arestes
//           (2^11) i posició de les arestes centrals (495).
//   Fase 2  Resol el cub dins G1 només amb els 10 girs de G1.
//           Coordenades: permutació de cantonades (8!), de les 8 arestes
//           U/D (8!) i de les 4 arestes centrals (4!).
//
// La cerca continua després de la primera solució i només n'accepta de més
// curtes, fins que s'esgota el temps o l'espai de cerca.
//
// Després, una cerca IDA* exacta (els 18 girs, amb la distància a G1 com a
// heurística admissible) intenta trobar una solució MÉS CURTA. Si la cerca
// s'esgota sense trobar-ne cap, la solució queda DEMOSTRADA òptima
// (info.proven = true). Si s'acaba el temps no es pot afirmar res:
// info.proven = false. Demostrar-ho per a solucions de 18-20 moviments
// necessita molta més computació de la que dona un navegador.

import { Cube } from "./cube.js";
import { Recorder, simplifyTokens } from "./solver-common.js";

/* ------------------------------------------------------------
   MOVIMENTS (ordre de cares U R F D L B; eix = cara % 3)
------------------------------------------------------------ */

const FACES = ["U", "R", "F", "D", "L", "B"];
const SUFFIXES = ["", "2", "'"];

const MOVE_NAMES = [];

for (let f = 0; f < 6; f++) {
  for (let k = 0; k < 3; k++) MOVE_NAMES.push(FACES[f] + SUFFIXES[k]);
}

const MOVE_CP = [];
const MOVE_CO = [];
const MOVE_EP = [];
const MOVE_EO = [];

for (const name of MOVE_NAMES) {
  const c = new Cube();
  c.move(name);

  MOVE_CP.push(Int8Array.from(c.cp));
  MOVE_CO.push(Int8Array.from(c.co));
  MOVE_EP.push(Int8Array.from(c.ep));
  MOVE_EO.push(Int8Array.from(c.eo));
}

// Girs que no treuen el cub de G1: U, D (qualsevol) i R2, L2, F2, B2.
const IS_G1_MOVE = MOVE_NAMES.map((_, m) => {
  const f = Math.floor(m / 3);
  const k = m % 3;
  return f === 0 || f === 3 || k === 1;
});

const G1_MOVES = [];
IS_G1_MOVE.forEach((ok, m) => ok && G1_MOVES.push(m));

const N_MOVES = 18;
const N_G1 = G1_MOVES.length;

function skipMove(face, lastFace) {
  if (lastFace < 0) return false;
  if (face === lastFace) return true;
  return face % 3 === lastFace % 3 && face < lastFace;
}

/* ------------------------------------------------------------
   COORDENADES
------------------------------------------------------------ */

const CNK = Array.from({ length: 13 }, () => new Array(13).fill(0));

for (let n = 0; n <= 12; n++) {
  CNK[n][0] = 1;
  for (let k = 1; k <= n; k++) CNK[n][k] = CNK[n - 1][k - 1] + CNK[n - 1][k];
}

function twistOf(co) {
  let t = 0;
  for (let i = 0; i < 7; i++) t = t * 3 + co[i];
  return t;
}

function flipOf(eo) {
  let f = 0;
  for (let i = 0; i < 11; i++) f = f * 2 + eo[i];
  return f;
}

// isSlice[pos] = 1 si a la posició hi ha una aresta de la capa central.
function sliceOf(isSlice) {
  let a = 0;
  let x = 0;

  for (let j = 11; j >= 0; j--) {
    if (isSlice[j]) {
      a += CNK[11 - j][x + 1];
      x++;
    }
  }

  return a;
}

function permRank(perm) {
  const n = perm.length;
  let rank = 0;

  for (let i = 0; i < n - 1; i++) {
    let smaller = 0;
    for (let j = i + 1; j < n; j++) if (perm[j] < perm[i]) smaller++;
    rank = (rank + smaller) * (n - 1 - i);
  }

  return rank;
}

function permUnrank(rank, n) {
  const perm = new Array(n).fill(0);
  const digits = new Array(n).fill(0);

  for (let i = n - 2; i >= 0; i--) {
    digits[i] = rank % (n - i);
    rank = Math.floor(rank / (n - i));
  }

  const pool = [...Array(n).keys()];

  for (let i = 0; i < n; i++) {
    perm[i] = pool.splice(digits[i], 1)[0];
  }

  return perm;
}

/* ------------------------------------------------------------
   TAULES (es construeixen la primera vegada que es necessiten)
------------------------------------------------------------ */

let TABLES = null;

function buildPrune(sizeA, sizeB, moveA, moveB, nMoves) {
  const total = sizeA * sizeB;
  const prune = new Int8Array(total).fill(-1);

  prune[0] = 0;

  let depth = 0;
  let added = 1;

  while (added > 0) {
    added = 0;

    for (let idx = 0; idx < total; idx++) {
      if (prune[idx] !== depth) continue;

      const a = Math.floor(idx / sizeB);
      const b = idx - a * sizeB;

      for (let m = 0; m < nMoves; m++) {
        const next = moveA[a * nMoves + m] * sizeB + moveB[b * nMoves + m];

        if (prune[next] === -1) {
          prune[next] = depth + 1;
          added++;
        }
      }
    }

    depth++;
  }

  return prune;
}

function buildTables() {
  if (TABLES) return TABLES;

  // Posicions possibles de les 4 arestes centrals: 495 subconjunts.
  const slicePositions = new Array(495);

  for (let mask = 0; mask < 4096; mask++) {
    let bits = 0;
    for (let i = 0; i < 12; i++) bits += (mask >> i) & 1;
    if (bits !== 4) continue;

    const isSlice = Array.from({ length: 12 }, (_, i) => (mask >> i) & 1);
    slicePositions[sliceOf(isSlice)] = isSlice;
  }

  // ---- Fase 1
  const twistMove = new Int16Array(2187 * N_MOVES);
  const flipMove = new Int16Array(2048 * N_MOVES);
  const sliceMove = new Int16Array(495 * N_MOVES);

  for (let t = 0; t < 2187; t++) {
    const co = new Array(8).fill(0);
    let rest = t;
    let sum = 0;

    for (let i = 6; i >= 0; i--) {
      co[i] = rest % 3;
      rest = Math.floor(rest / 3);
      sum += co[i];
    }

    co[7] = (3 - (sum % 3)) % 3;

    for (let m = 0; m < N_MOVES; m++) {
      const next = new Array(8);

      for (let i = 0; i < 8; i++) {
        next[i] = (co[MOVE_CP[m][i]] + MOVE_CO[m][i]) % 3;
      }

      twistMove[t * N_MOVES + m] = twistOf(next);
    }
  }

  for (let f = 0; f < 2048; f++) {
    const eo = new Array(12).fill(0);
    let rest = f;
    let sum = 0;

    for (let i = 10; i >= 0; i--) {
      eo[i] = rest % 2;
      rest = Math.floor(rest / 2);
      sum += eo[i];
    }

    eo[11] = sum % 2;

    for (let m = 0; m < N_MOVES; m++) {
      const next = new Array(12);

      for (let i = 0; i < 12; i++) {
        next[i] = eo[MOVE_EP[m][i]] ^ MOVE_EO[m][i];
      }

      flipMove[f * N_MOVES + m] = flipOf(next);
    }
  }

  for (let s = 0; s < 495; s++) {
    const isSlice = slicePositions[s];

    for (let m = 0; m < N_MOVES; m++) {
      const next = new Array(12);

      for (let i = 0; i < 12; i++) next[i] = isSlice[MOVE_EP[m][i]];

      sliceMove[s * N_MOVES + m] = sliceOf(next);
    }
  }

  // ---- Fase 2 (només els 10 girs de G1)
  const cornerMove = new Int32Array(40320 * N_G1);
  const udEdgeMove = new Int32Array(40320 * N_G1);
  const slicePermMove = new Int16Array(24 * N_G1);

  for (let r = 0; r < 40320; r++) {
    const perm = permUnrank(r, 8);

    for (let j = 0; j < N_G1; j++) {
      const m = G1_MOVES[j];
      const next = new Array(8);

      for (let i = 0; i < 8; i++) next[i] = perm[MOVE_CP[m][i]];

      cornerMove[r * N_G1 + j] = permRank(next);

      // Arestes U/D: les posicions 0..7 només reben arestes 0..7.
      const nextEdges = new Array(8);

      for (let i = 0; i < 8; i++) nextEdges[i] = perm[MOVE_EP[m][i]];

      udEdgeMove[r * N_G1 + j] = permRank(nextEdges);
    }
  }

  for (let r = 0; r < 24; r++) {
    const perm = permUnrank(r, 4);

    for (let j = 0; j < N_G1; j++) {
      const m = G1_MOVES[j];
      const next = new Array(4);

      for (let i = 0; i < 4; i++) next[i] = perm[MOVE_EP[m][8 + i] - 8];

      slicePermMove[r * N_G1 + j] = permRank(next);
    }
  }

  TABLES = {
    twistMove,
    flipMove,
    sliceMove,
    cornerMove,
    udEdgeMove,
    slicePermMove,
    pruneSliceTwist: buildPrune(495, 2187, sliceMove, twistMove, N_MOVES),
    pruneSliceFlip: buildPrune(495, 2048, sliceMove, flipMove, N_MOVES),
    pruneCornerSlice: buildPrune(40320, 24, cornerMove, slicePermMove, N_G1),
    pruneEdgeSlice: buildPrune(40320, 24, udEdgeMove, slicePermMove, N_G1)
  };

  return TABLES;
}

/* ------------------------------------------------------------
   ESTAT EN FORMA D'ARRAYS
------------------------------------------------------------ */


/* ------------------------------------------------------------
   TAULA DE DISTÀNCIES DE LES CANTONADES (Korf)
   Distància exacta (18 girs) per a les 8 cantonades soles:
   40320 * 2187 = 88.179.840 estats. És una cota inferior
   admissible de la distància del cub sencer.
------------------------------------------------------------ */

let CORNER_PDB = null;
let CORNER_CP_MOVE = null;

function buildCornerPDB() {
  if (CORNER_PDB) return CORNER_PDB;

  const T = buildTables();

  CORNER_CP_MOVE = new Uint16Array(40320 * N_MOVES);

  for (let r = 0; r < 40320; r++) {
    const perm = permUnrank(r, 8);
    const next = new Array(8);

    for (let m = 0; m < N_MOVES; m++) {
      for (let i = 0; i < 8; i++) next[i] = perm[MOVE_CP[m][i]];
      CORNER_CP_MOVE[r * N_MOVES + m] = permRank(next);
    }
  }

  const SIZE = 40320 * 2187;
  const dist = new Uint8Array(SIZE).fill(255);

  const solved =
    permRank([0, 1, 2, 3, 4, 5, 6, 7]) * 2187 + twistOf([0, 0, 0, 0, 0, 0, 0, 0]);

  dist[solved] = 0;

  const cpMove = CORNER_CP_MOVE;
  const twMove = T.twistMove;

  for (let d = 0; ; d++) {
    let found = 0;

    for (let idx = 0; idx < SIZE; idx++) {
      if (dist[idx] !== d) continue;

      const p = (idx / 2187) | 0;
      const t = idx - p * 2187;

      for (let m = 0; m < N_MOVES; m++) {
        const n = cpMove[p * N_MOVES + m] * 2187 + twMove[t * N_MOVES + m];

        if (dist[n] === 255) {
          dist[n] = d + 1;
          found++;
        }
      }
    }

    if (found === 0) break;
  }

  // Empaquetem a 4 bits per estat (44 MB en lloc de 88 MB).
  const packed = new Uint8Array(SIZE >> 1);

  for (let i = 0; i < SIZE; i += 2) {
    packed[i >> 1] = dist[i] | (dist[i + 1] << 4);
  }

  CORNER_PDB = packed;
  return packed;
}

export { buildCornerPDB as __buildCornerPDB };

function arraysOf(cube) {
  return {
    cp: Array.from(cube.cp),
    co: Array.from(cube.co),
    ep: Array.from(cube.ep),
    eo: Array.from(cube.eo)
  };
}

function applyMove(s, m) {
  const cp = new Array(8);
  const co = new Array(8);
  const ep = new Array(12);
  const eo = new Array(12);

  for (let i = 0; i < 8; i++) {
    cp[i] = s.cp[MOVE_CP[m][i]];
    co[i] = (s.co[MOVE_CP[m][i]] + MOVE_CO[m][i]) % 3;
  }

  for (let i = 0; i < 12; i++) {
    ep[i] = s.ep[MOVE_EP[m][i]];
    eo[i] = s.eo[MOVE_EP[m][i]] ^ MOVE_EO[m][i];
  }

  return { cp, co, ep, eo };
}

function applyPath(s, path, length) {
  let state = s;
  for (let i = 0; i < length; i++) state = applyMove(state, path[i]);
  return state;
}

function isSolvedArrays(s) {
  for (let i = 0; i < 8; i++) if (s.cp[i] !== i || s.co[i] !== 0) return false;
  for (let i = 0; i < 12; i++) if (s.ep[i] !== i || s.eo[i] !== 0) return false;
  return true;
}

function phase1Coordinates(s) {
  return {
    twist: twistOf(s.co),
    flip: flipOf(s.eo),
    slice: sliceOf(s.ep.map(e => (e >= 8 ? 1 : 0)))
  };
}

/* ------------------------------------------------------------
   CERCA DE DUES FASES
------------------------------------------------------------ */

function twoPhase(start, options) {
  const T = buildTables();

  const deadline = performance.now() + options.timeMs;

  const startCoords = phase1Coordinates(start);

  const path = new Int8Array(64);

  const state = {
    best: options.candidate ? Array.from(options.candidate) : null,
    bestLength: options.candidate ? options.candidate.length : Infinity,
    stop: false,
    counter: 0
  };

  function timeUp() {
    if (state.stop) return true;
    if ((++state.counter & 0x3ff) !== 0) return false;
    if (state.best !== null && performance.now() > deadline) {
      state.stop = true;
      return true;
    }
    return false;
  }

  /* ---- Fase 2 */

  function phase2(left, c, u, s, lastFace, depth) {
    const h = Math.max(T.pruneCornerSlice[c * 24 + s], T.pruneEdgeSlice[u * 24 + s]);

    if (h > left) return false;
    if (left === 0) return true;
    if (timeUp()) return false;

    for (let j = 0; j < N_G1; j++) {
      const m = G1_MOVES[j];
      const face = Math.floor(m / 3);

      if (skipMove(face, lastFace)) continue;

      path[depth] = m;

      if (
        phase2(
          left - 1,
          T.cornerMove[c * N_G1 + j],
          T.udEdgeMove[u * N_G1 + j],
          T.slicePermMove[s * N_G1 + j],
          face,
          depth + 1
        )
      ) {
        return true;
      }

      if (state.stop) return false;
    }

    return false;
  }

  function tryPhase2(depth1, lastFace) {
    const maxDepth2 = Math.min(13, state.bestLength - 1 - depth1);

    if (maxDepth2 < 0) return;

    const s = applyPath(start, path, depth1);

    const c = permRank(s.cp);
    const u = permRank(s.ep.slice(0, 8));
    const sl = permRank(s.ep.slice(8, 12).map(e => e - 8));

    const h0 = Math.max(T.pruneCornerSlice[c * 24 + sl], T.pruneEdgeSlice[u * 24 + sl]);

    for (let d2 = h0; d2 <= maxDepth2; d2++) {
      if (phase2(d2, c, u, sl, lastFace, depth1)) {
        state.bestLength = depth1 + d2;
        state.best = Array.from(path.slice(0, state.bestLength));

        if (options.onImprove) options.onImprove(state.best);

        if (state.bestLength <= options.stopAt) state.stop = true;

        return;
      }

      if (state.stop || timeUp()) return;
    }
  }

  /* ---- Fase 1 */

  function phase1(left, tw, fl, sl, lastFace, depth) {
    const h = Math.max(T.pruneSliceTwist[sl * 2187 + tw], T.pruneSliceFlip[sl * 2048 + fl]);

    if (h > left) return;

    if (left === 0) {
      // L'últim gir no pot ser de G1: si ho fos, hi hauria una fase 1 més curta.
      if (depth > 0 && IS_G1_MOVE[path[depth - 1]]) return;

      tryPhase2(depth, lastFace);
      return;
    }

    if (timeUp()) return;

    for (let face = 0; face < 6; face++) {
      if (skipMove(face, lastFace)) continue;

      for (let k = 0; k < 3; k++) {
        const m = face * 3 + k;

        path[depth] = m;

        phase1(
          left - 1,
          T.twistMove[tw * N_MOVES + m],
          T.flipMove[fl * N_MOVES + m],
          T.sliceMove[sl * N_MOVES + m],
          face,
          depth + 1
        );

        if (state.stop) return;
      }
    }
  }

  for (let d1 = 0; d1 <= 20 && d1 <= state.bestLength - 1; d1++) {
    phase1(d1, startCoords.twist, startCoords.flip, startCoords.slice, -1, 0);

    if (state.stop) break;
    if (state.best !== null && performance.now() > deadline) break;
  }

  return state.best;
}

/* ------------------------------------------------------------
   COMPROVACIÓ EXACTA (IDA* amb els 18 girs)

   Cerca una solució de longitud <= maxLength. Retorna:
     { moves }            si n'ha trobat una
     { exhausted: true }  si ha esgotat l'espai: no n'hi ha cap
     { timeout: true }    si s'ha acabat el temps
------------------------------------------------------------ */

function makeExact(start) {
  const T = buildTables();
  const PDB = buildCornerPDB();
  const CPM = CORNER_CP_MOVE;

  const startCoords = phase1Coordinates(start);
  const startCorner = permRank(start.cp);

  const path = new Int8Array(64);

  let counter = 0;
  let deadline = Infinity;
  let timedOut = false;
  let found = null;

  const pdb = i => (PDB[i >> 1] >> ((i & 1) << 2)) & 15;

  const TW = T.twistMove;
  const FL = T.flipMove;
  const SL = T.sliceMove;
  const PS = T.pruneSliceTwist;
  const PF = T.pruneSliceFlip;

  // allowed[(lastFace + 1) * 6 + face]
  const allowed = new Uint8Array(7 * 6);

  for (let lf = -1; lf < 6; lf++) {
    for (let f = 0; f < 6; f++) {
      allowed[(lf + 1) * 6 + f] = skipMove(f, lf) ? 0 : 1;
    }
  }

  /*
    Explora amb `left` girs restants (left >= 1). Els fills es descarten
    amb les taules abans de fer cap crida recursiva.
  */
  function dfs(left, tw, fl, sl, cp, lastFace, depth) {
    if ((++counter & 0xfffff) === 0 && performance.now() > deadline) {
      timedOut = true;
      return false;
    }

    const childLeft = left - 1;
    const base = (lastFace + 1) * 6;

    for (let face = 0; face < 6; face++) {
      if (allowed[base + face] === 0) continue;

      for (let k = 0; k < 3; k++) {
        const m = face * 3 + k;

        const cpn = CPM[cp * N_MOVES + m];
        const twn = TW[tw * N_MOVES + m];

        const idx = cpn * 2187 + twn;
        const hn = (PDB[idx >> 1] >> ((idx & 1) << 2)) & 15;

        if (hn > childLeft) continue;

        const sln = SL[sl * N_MOVES + m];

        if (PS[sln * 2187 + twn] > childLeft) continue;

        const fln = FL[fl * N_MOVES + m];

        if (PF[sln * 2048 + fln] > childLeft) continue;

        path[depth] = m;

        if (childLeft === 0) {
          // Totes les taules diuen 0: comprovem l'estat de debò.
          if (isSolvedArrays(applyPath(start, path, depth + 1))) {
            found = Array.from(path.slice(0, depth + 1));
            return true;
          }

          continue;
        }

        if (dfs(childLeft, twn, fln, sln, cpn, face, depth + 1)) return true;

        if (timedOut) return false;
      }
    }

    return false;
  }

  const h0 = Math.max(
    pdb(startCorner * 2187 + startCoords.twist),
    T.pruneSliceTwist[startCoords.slice * 2187 + startCoords.twist],
    T.pruneSliceFlip[startCoords.slice * 2048 + startCoords.flip]
  );

  /*
    Explora el subarbre que comença amb el prefix donat (llista d'índexs
    de gir) fins a longitud total `limit`.
    Retorna { moves } | { none: true } | { timeout: true }.
  */
  function run(limit, prefix = [], timeMs = Infinity) {
    deadline = performance.now() + timeMs;
    timedOut = false;
    found = null;

    let tw = startCoords.twist;
    let fl = startCoords.flip;
    let sl = startCoords.slice;
    let cp = startCorner;
    let lastFace = -1;

    for (let i = 0; i < prefix.length; i++) {
      const m = prefix[i];
      path[i] = m;
      tw = T.twistMove[tw * N_MOVES + m];
      fl = T.flipMove[fl * N_MOVES + m];
      sl = T.sliceMove[sl * N_MOVES + m];
      cp = CPM[cp * N_MOVES + m];
      lastFace = Math.floor(m / 3);
    }

    const left = limit - prefix.length;

    if (left <= 0) {
      if (left === 0 && isSolvedArrays(applyPath(start, path, prefix.length))) {
        return { moves: Array.from(path.slice(0, prefix.length)) };
      }

      return { none: true };
    }

    if (dfs(left, tw, fl, sl, cp, lastFace, prefix.length)) {
      return { moves: found };
    }

    return timedOut ? { timeout: true } : { none: true };
  }

  return { h0, run };
}

/* Prefixos de 2 girs vàlids (per repartir la feina entre Workers). */
export function exactPrefixes() {
  const out = [];

  for (let a = 0; a < N_MOVES; a++) {
    for (let b = 0; b < N_MOVES; b++) {
      const fa = Math.floor(a / 3);
      const fb = Math.floor(b / 3);

      if (skipMove(fa, -1)) continue;
      if (skipMove(fb, fa)) continue;

      out.push([a, b]);
    }
  }

  return out;
}

function exactSearch(start, maxLength, timeMs, onLimit) {
  const ex = makeExact(start);
  const t0 = performance.now();

  for (let limit = ex.h0; limit <= maxLength; limit++) {
    // Totes les solucions de longitud < limit ja estan descartades.
    if (onLimit) onLimit(limit);

    const left = timeMs - (performance.now() - t0);
    if (left <= 0) return { timeout: true };

    const r = ex.run(limit, [], left);

    if (r.moves) return { moves: r.moves, optimal: true };
    if (r.timeout) return { timeout: true };
  }

  return { exhausted: true };
}

/*
  API per al repartiment entre Workers.
  upperBound: cerca de dues fases (+ candidata) -> { moves, length }
  prepareExact: construeix la taula i retorna { h0, run }
*/
export function upperBound(inputCube, options = {}) {
  checkInput(inputCube);

  const start = arraysOf(inputCube);
  const report = options.onProgress || (() => {});

  let candidate = null;

  if (Array.isArray(options.candidate) && options.candidate.length > 0) {
    const names = simplifyTokens(
      options.candidate.map(t => ({ move: t.endsWith("2'") ? t.slice(0, -1) : t }))
    ).map(t => t.move);

    if (names.every(n => MOVE_NAMES.includes(n))) {
      const test = inputCube.clone();
      for (const n of names) test.move(n);
      if (test.isSolved()) candidate = names.map(n => MOVE_NAMES.indexOf(n));
    }
  }

  if (candidate) {
    report({ length: candidate.length, source: "inverse", moves: candidate.map(i => MOVE_NAMES[i]) });
  }

  if (inputCube.isSolved()) return { moves: [], length: 0 };

  const best = twoPhase(start, {
    timeMs: options.timeMs ?? 4000,
    stopAt: 0,
    candidate,
    onImprove: m => report({ length: m.length, source: "search", moves: m.map(i => MOVE_NAMES[i]) })
  });

  return { moves: best.map(i => MOVE_NAMES[i]), length: best.length };
}

export function prepareExact(inputCube) {
  checkInput(inputCube);
  return makeExact(arraysOf(inputCube));
}

/* ------------------------------------------------------------
   SOLVER PRINCIPAL
------------------------------------------------------------ */

const STEPS = [
  { id: 1, name: "Fase 1", label: "phase 1" },
  { id: 2, name: "Fase 2", label: "phase 2" }
];

function endOfUnit(length) {
  let calls = 0;
  return () => ++calls === length + 1;
}

/*
  options:
    timeMs   temps màxim de la cerca de dues fases (per defecte 3000)
    proofMs  temps màxim de la comprovació exacta (per defecte 4000)
    stopAt   atura la cerca quan es troba una solució de longitud <= stopAt
*/
function checkInput(inputCube) {
  if (!(inputCube instanceof Cube)) {
    throw new TypeError("Optimal espera una instància de Cube.");
  }

  if (inputCube.orientationKey() !== new Cube().orientationKey()) {
    throw new Error("Optimal: el cub ha d'estar en l'orientació inicial.");
  }

  if (!inputCube.isValid()) {
    throw new Error("Optimal: l'estat del cub no és vàlid.");
  }
}

/*
  Cerca pura (sense Recorder): retorna { moves: ["R","U'",...], info }.
  Es pot executar dins d'un Worker.
*/
export function searchOptimal(inputCube, options = {}) {
  checkInput(inputCube);

  if (inputCube.isSolved()) {
    return { moves: [], info: { length: 0, proven: true, timeMs: 0 } };
  }

  const timeMs = options.timeMs ?? 4000;
  const proofMs = options.proofMs ?? Infinity;
  const stopAt = options.stopAt ?? 0;
  const report = options.onProgress || (() => {});

  const t0 = performance.now();

  const start = arraysOf(inputCube);

  /*
    Candidata inicial: la inversa de la barreja (sempre és una solució
    vàlida; és òptima quan la barreja és curta). Es comprova abans d'usar-la.
  */
  let candidate = null;

  if (Array.isArray(options.candidate) && options.candidate.length > 0) {
    const names = simplifyTokens(
      options.candidate.map(t => ({ move: t.endsWith("2'") ? t.slice(0, -1) : t }))
    ).map(t => t.move);

    if (names.every(n => MOVE_NAMES.includes(n))) {
      const test = inputCube.clone();
      for (const n of names) test.move(n);

      if (test.isSolved()) candidate = names.map(n => MOVE_NAMES.indexOf(n));
    }
  }

  if (candidate) report({ length: candidate.length, source: "inverse", moves: candidate.map(i => MOVE_NAMES[i]) });

  let best = twoPhase(start, {
    timeMs,
    stopAt,
    candidate,
    onImprove: m => report({ length: m.length, source: "search", moves: m.map(i => MOVE_NAMES[i]) })
  });

  if (!best) throw new Error("Optimal: no s'ha trobat cap solució.");

  /*
    Comprovació exacta (IDA* amb la taula de cantonades de Korf).
    Va per longituds creixents: quan una longitud L no té solució,
    se sap que l'òptim és > L. La primera que en té és l'òptima.
  */
  let proven = false;
  let lowerBound = 0;

  if (proofMs > 0 && best.length > 0) {
    // La primera vegada cal construir la taula de cantonades (uns segons).
    report({ building: true, length: best.length, moves: best.map(i => MOVE_NAMES[i]) });
    buildCornerPDB();

    const result = exactSearch(
      start,
      best.length - 1,
      proofMs,
      limit => {
        lowerBound = limit;
        report({ lower: limit, length: best.length, moves: best.map(i => MOVE_NAMES[i]) });
      }
    );

    if (result.moves) {
      best = result.moves;
      proven = true;
      report({ length: best.length, source: "exact", moves: best.map(i => MOVE_NAMES[i]) });
    } else if (result.exhausted) {
      proven = true;   // no n'hi ha cap de més curta que la millor trobada
    }
  }

  return {
    moves: best.map(m => MOVE_NAMES[m]),
    info: {
      length: best.length,
      proven,
      lowerBound: proven ? best.length : lowerBound,
      timeMs: Math.round(performance.now() - t0)
    }
  };
}

/*
  Converteix la llista de girs en un resultat del Recorder
  (fase 1 = fins que el cub entra a G1; fase 2 = la resta).
*/
export function buildOptimalResult(inputCube, moveNames, info) {
  if (moveNames.length === 0) {
    const empty = Recorder.emptyResult("Optimal", STEPS);
    empty.info = info;
    return empty;
  }

  const inG1 = s => {
    const c = phase1Coordinates(s);
    return c.twist === 0 && c.flip === 0 && c.slice === 0;
  };

  let state = arraysOf(inputCube);
  let split = 0;

  while (split < moveNames.length && !inG1(state)) {
    state = applyMove(state, MOVE_NAMES.indexOf(moveNames[split]));
    split++;
  }

  const phase1Moves = moveNames.slice(0, split);
  const phase2Moves = moveNames.slice(split);

  const rec = new Recorder("Optimal", STEPS);

  if (phase1Moves.length > 0) {
    rec.addUnit(1, "reach G1", inputCube.clone(), phase1Moves, endOfUnit(phase1Moves.length));
  }

  if (phase2Moves.length > 0) {
    const mid = inputCube.clone();
    for (const m of phase1Moves) mid.move(m);

    rec.addUnit(2, "solve from G1", mid, phase2Moves, endOfUnit(phase2Moves.length));
  }

  const result = rec.build(inputCube);

  result.info = { ...info, length: result.moves.length };

  return result;
}

export function solveOptimal(inputCube, options = {}) {
  const { moves, info } = searchOptimal(inputCube, options);
  return buildOptimalResult(inputCube, moves, info);
}

export { buildTables as prepareOptimalTables };
export const OPTIMAL_MOVE_NAMES = MOVE_NAMES;
