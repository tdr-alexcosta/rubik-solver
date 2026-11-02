// js/lbl.js
//
// LBL — Layer By Layer, amb notació humana (inclou girs x, y, z).
//
//   Fases 1-2: blanc a dalt (U). Les cantonades només usen R, L i D.
//   Entre la fase 2 i la 3: x2 (groc a dalt, blanc a baix).
//   Fases 3-7: algorismes estàndard amb groc a dalt.
//
//   1. Creu blanca               cerca exhaustiva sobre les 4 arestes
//   2. Cantonades blanques       R D R' D'  /  L' D' L D
//   3. Segona capa               U R U' R' U' F' U F  /  U' L' U L U F U' F'
//   4. Creu groga                F R U R' U' F'
//   5. Posicionament d'arestes   R U R' U R U2 R'
//   6. Posicionament cantonades  U R U' L' U R' U' L
//   7. Orientació cantonades     R' D R D' R' D R  /  R' D' R D R' D' R
//
// Els girs x/y/z només canvien la vista del cub: l'estat intern no canvia.
// La solució es simplifica fusionant girs de la mateixa cara (també a
// través de girs de cub i de canvis de fase) i es dóna en format STEP n.
// Tot el que es dóna per bo es comprova sobre l'estat real de cube.js.

import { Cube } from "./cube.js";

import {
  parse,
  inverseSeq,
  applySeq,
  edgeOk,
  cornerOk,
  crossSolved,
  firstLayerSolved,
  f2lSolved,
  yellowCrossSolved,
  yellowEdgesSolved,
  yellowCornersPositioned,
  countOk,
  solveWhiteCross,
  Recorder,
  formatSteps
} from "./solver-common.js";

/* ------------------------------------------------------------
   UTILITATS DE SEQÜÈNCIES
------------------------------------------------------------ */

/* ------------------------------------------------------------
   CERCA SOBRE MACROS (fases 2-6)

   BFS sobre seqüències de macros (algorismes, girs de capa i
   girs de cub). Una macro només s'accepta si `keep` continua
   complint-se, així mai no es desfà el que ja està resolt.
------------------------------------------------------------ */

function stateKey(c) {
  return `${c.cp}|${c.co}|${c.ep}|${c.eo}|${c.orientationKey()}`;
}

function macroSearch(start, macros, goal, keep, maxDepth, errorMessage) {
  if (goal(start)) return [];

  const visited = new Set([stateKey(start)]);
  let frontier = [{ cube: start, path: [] }];

  for (let depth = 1; depth <= maxDepth; depth++) {
    const next = [];

    for (const node of frontier) {
      for (const macro of macros) {
        const cube = node.cube.clone();
        applySeq(cube, macro);

        if (!keep(cube)) continue;

        const key = stateKey(cube);
        if (visited.has(key)) continue;
        visited.add(key);

        const path = node.path.concat(macro);

        if (goal(cube)) return path;

        next.push({ cube, path });
      }
    }

    frontier = next;
    if (frontier.length === 0) break;
  }

  throw new Error(errorMessage);
}

function runMacroPhase(cube, macros, goal, keep, maxDepth, errorMessage) {
  const moves = macroSearch(cube, macros, goal, keep, maxDepth, errorMessage);
  applySeq(cube, moves);
  return moves;
}

const CUBE_TURNS = [["y"], ["y'"], ["y2"]];
const LAYER_U = [["U"], ["U'"], ["U2"]];
const LAYER_D = [["D"], ["D'"], ["D2"]];

/*
  Resol una peça més cada vegada: la que surt més barata.
  `pieces` són els índexs absoluts que s'han de resoldre.
  Retorna una unitat per iteració: { before, moves, goal, newly }.
*/
function solveOneByOne(cube, pieces, test, baseKeep, macros, maxDepth, label) {
  const units = [];

  while (countOk(cube, pieces, test) < pieces.length) {
    const solved = pieces.filter(i => test(cube, i));
    const keep = c => baseKeep(c) && solved.every(i => test(c, i));
    const goal = c => keep(c) && countOk(c, pieces, test) > solved.length;

    const before = cube.clone();

    const moves = runMacroPhase(
      cube,
      macros,
      goal,
      keep,
      maxDepth,
      `LBL: no s'ha pogut resoldre: ${label}.`
    );

    const newly = pieces.filter(i => !solved.includes(i) && test(cube, i));

    units.push({ before, moves, goal, newly });
  }

  return units;
}

/* ------------------------------------------------------------
   FASE 2 — CANTONADES BLANQUES (blanc a dalt; només R, L, D)
------------------------------------------------------------ */

const CORNER_MACROS = [
  ...LAYER_D,
  parse("R D R' D'"),
  parse("D R D' R'"),
  parse("L' D' L D"),
  parse("D' L' D L"),
  ...CUBE_TURNS
];

function solveWhiteCorners(cube) {
  const units = solveOneByOne(
    cube,
    [0, 1, 2, 3],
    cornerOk,
    crossSolved,
    CORNER_MACROS,
    9,
    "cantonades blanques"
  );

  if (!firstLayerSolved(cube)) {
    throw new Error("LBL: la primera capa no ha quedat resolta.");
  }

  return units;
}

/* ------------------------------------------------------------
   FASE 3 — SEGONA CAPA (x2: groc a dalt)
------------------------------------------------------------ */

const EDGE_MACROS = [
  ...LAYER_U,
  parse("U R U' R' U' F' U F"),
  parse("U' L' U L U F U' F'"),
  ...CUBE_TURNS
];

// El gir x2 (groc a dalt) l'afegeix el solver principal abans d'aquesta fase.
function solveSecondLayer(cube) {
  const units = solveOneByOne(
    cube,
    [8, 9, 10, 11],
    edgeOk,
    firstLayerSolved,
    EDGE_MACROS,
    9,
    "segona capa"
  );

  if (!f2lSolved(cube)) {
    throw new Error("LBL: les dues primeres capes no han quedat resoltes.");
  }

  return units;
}

/* ------------------------------------------------------------
   FASE 4 — CREU GROGA
------------------------------------------------------------ */

function solveYellowCross(cube) {
  return runMacroPhase(
    cube,
    [parse("F R U R' U' F'"), ...CUBE_TURNS],
    yellowCrossSolved,
    f2lSolved,
    9,
    "LBL: no s'ha pogut formar la creu groga."
  );
}

/* ------------------------------------------------------------
   FASE 5 — POSICIONAMENT DE LES ARESTES
------------------------------------------------------------ */

const SUNE = parse("R U R' U R U2 R'");

function solveYellowEdges(cube) {
  const keep = c =>
    f2lSolved(c) && [4, 5, 6, 7].every(i => c.eo[i] === 0);

  return runMacroPhase(
    cube,
    [...LAYER_U, SUNE, inverseSeq(SUNE), ...CUBE_TURNS],
    yellowEdgesSolved,
    keep,
    10,
    "LBL: no s'han pogut posicionar les arestes grogues."
  );
}

/* ------------------------------------------------------------
   FASE 6 — POSICIONAMENT DE LES CANTONADES
------------------------------------------------------------ */

const CORNER_CYCLE = parse("U R U' L' U R' U' L");

function solveYellowCornersPosition(cube) {
  return runMacroPhase(
    cube,
    [CORNER_CYCLE, inverseSeq(CORNER_CYCLE), ...CUBE_TURNS],
    yellowCornersPositioned,
    yellowEdgesSolved,
    8,
    "LBL: no s'han pogut posicionar les cantonades grogues."
  );
}

/* ------------------------------------------------------------
   FASE 7 — ORIENTACIÓ DE LES CANTONADES
------------------------------------------------------------ */

const CORNER_NAMES = ["URF", "UFL", "ULB", "UBR", "DFR", "DLF", "DBL", "DRB"];

function cornerIndexAt(faces) {
  const key = [...faces].sort().join("");
  return CORNER_NAMES.findIndex(name => [...name].sort().join("") === key);
}

// Cantonada que la persona veu a la posició URF.
function visibleURF(cube) {
  const f = cube.frame;
  return cornerIndexAt([f.U, f.R, f.F]);
}

/*
  Cada algorisme gira només la cantonada que hi ha a URF (vista
  actual, groc a dalt). La resta de la cantonada de la capa groga
  no es toca; la primera capa queda desordenada i es recupera quan
  s'han tractat les quatre cantonades.

    horari      R' D R D' R' D R     (arregla co = 1)
    antihorari  R' D' R D R' D' R    (arregla co = 2)

  Amb 2 o 4 cantonades girades, cada una rep l'algorisme que necessita.
  Amb 3 cantonades girades (totes en el mateix sentit):
    - les dues primeres, amb l'algorisme que necessiten,
    - la tercera, encadenant dues vegades l'algorisme contrari.
*/

const TWIST_CW = parse("R' D R D' R' D R");
const TWIST_CCW = parse("R' D' R D R' D' R");

function twistAlgorithm(twist) {
  return twist === 1 ? TWIST_CW : TWIST_CCW;
}

function oppositeTwistAlgorithm(twist) {
  return twist === 1 ? TWIST_CCW : TWIST_CW;
}

function solveYellowCornersOrientation(cube) {
  const result = [];

  const twisted = [4, 5, 6, 7].filter(i => cube.co[i] !== 0).length;

  let seen = 0;

  for (let corner = 0; corner < 4; corner++) {
    const twist = cube.co[visibleURF(cube)];

    if (twist !== 0) {
      seen++;

      const algorithm =
        twisted === 3 && seen === 3
          ? [
              ...oppositeTwistAlgorithm(twist),
              ...oppositeTwistAlgorithm(twist)
            ]
          : twistAlgorithm(twist);

      applySeq(cube, algorithm);
      result.push(...algorithm);
    }

    cube.move("U");
    result.push("U");
  }

  // Alineació final de la primera capa (a baix).
  if (!cube.isSolved()) {
    for (const turn of [["D"], ["D'"], ["D2"]]) {
      const test = cube.clone();
      applySeq(test, turn);

      if (test.isSolved()) {
        applySeq(cube, turn);
        result.push(...turn);
        break;
      }
    }
  }

  if (!cube.isSolved()) {
    throw new Error("LBL: la fase final no ha deixat el cub resolt.");
  }

  return result;
}

/* ------------------------------------------------------------
   NOMS DE LES PECES (vista inicial: verd davant, blanc a dalt)
------------------------------------------------------------ */

const CORNER_LABELS = { 0: "URF", 1: "ULF", 2: "ULB", 3: "URB" };
const EDGE_LABELS = { 8: "RF", 9: "LF", 10: "LB", 11: "RB" };

/* ------------------------------------------------------------
   SOLVER PRINCIPAL
------------------------------------------------------------ */

const STEPS = [
  { id: 1, name: "Creu blanca", label: "white cross" },
  { id: 2, name: "Cantonades blanques", label: "white corners" },
  { id: 3, name: "Segona capa", label: "second layer" },
  { id: 4, name: "Creu groga", label: "yellow cross" },
  { id: 5, name: "Posicionament de les arestes", label: "edges permutation" },
  { id: 6, name: "Posicionament de les cantonades", label: "corners permutation" },
  { id: 7, name: "Orientació de les cantonades", label: "corners orientation" }
];

export function solveLBL(inputCube) {
  if (!(inputCube instanceof Cube)) {
    throw new TypeError("solveLBL espera una instància de Cube.");
  }

  if (inputCube.orientationKey() !== new Cube().orientationKey()) {
    throw new Error(
      "LBL: el cub ha d'estar en l'orientació inicial (verd davant, blanc a dalt)."
    );
  }

  const cube = inputCube.clone();

  if (!cube.isValid()) {
    throw new Error("LBL: l'estat del cub no és vàlid.");
  }

  // Cub ja resolt: no cal cap gir (ni tan sols el x2).
  if (cube.isSolved()) {
    return Recorder.emptyResult("LBL", STEPS);
  }

  const rec = new Recorder("LBL", STEPS);

  function runSingle(step, label, solver, goal) {
    const before = cube.clone();
    rec.addUnit(step, label, before, solver(cube), goal);
  }

  // 1. Creu blanca
  runSingle(1, "white cross", solveWhiteCross, crossSolved);

  // 2. Cantonades blanques
  for (const u of solveWhiteCorners(cube)) {
    const names = u.newly.map(i => CORNER_LABELS[i]).join(" + ");
    rec.addUnit(2, `${names} corner`, u.before, u.moves, u.goal);
  }

  // 3. Segona capa (primer, x2: groc a dalt)
  cube.move("x2");
  rec.addRaw(["x2"]);

  for (const u of solveSecondLayer(cube)) {
    const names = u.newly.map(i => EDGE_LABELS[i]).join(" + ");
    rec.addUnit(3, `${names} edge`, u.before, u.moves, u.goal);
  }

  // 4-7
  runSingle(4, "yellow cross", solveYellowCross, yellowCrossSolved);
  runSingle(5, "edges permutation", solveYellowEdges, yellowEdgesSolved);
  runSingle(6, "corners permutation", solveYellowCornersPosition, yellowCornersPositioned);
  runSingle(7, "corners orientation", solveYellowCornersOrientation, c => c.isSolved());

  if (!cube.isSolved()) {
    throw new Error("LBL: el solver ha acabat però el cub no està resolt.");
  }

  return rec.build(inputCube);
}

export const formatLBL = formatSteps;

export {
  crossSolved,
  firstLayerSolved,
  f2lSolved,
  yellowCrossSolved,
  yellowEdgesSolved,
  yellowCornersPositioned
};
