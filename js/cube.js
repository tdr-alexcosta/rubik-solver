/*
  ============================================================
  CUBE.JS
  Motor matemàtic del cub 3×3×3

  Representació:
    - 8 cantonades
    - 12 arestes

  cp = permutació de cantonades
  co = orientació de cantonades
  ep = permutació d'arestes
  eo = orientació d'arestes

  Convenció de posicions:

  CANTONADES
    0 = URF
    1 = UFL
    2 = ULB
    3 = UBR
    4 = DFR
    5 = DLF
    6 = DBL
    7 = DRB

  ARESTES
    0 = UR
    1 = UF
    2 = UL
    3 = UB
    4 = DR
    5 = DF
    6 = DL
    7 = DB
    8 = FR
    9 = FL
   10 = BL
   11 = BR

  Les direccions dels moviments coincideixen amb
  moves.js i amb la representació 3D actual.
  ============================================================
*/


/* ============================================================
   TAULES DELS MOVIMENTS
============================================================ */

const MOVE_TABLES = {

  R: {
    cp: [4, 1, 2, 0, 7, 5, 6, 3],
    co: [1, 0, 0, 2, 2, 0, 0, 1],

    ep: [8, 1, 2, 3, 11, 5, 6, 7, 4, 9, 10, 0],
    eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  },

  L: {
    cp: [0, 2, 6, 3, 4, 1, 5, 7],
    co: [0, 2, 1, 0, 0, 1, 2, 0],

    ep: [0, 1, 10, 3, 4, 5, 9, 7, 8, 2, 6, 11],
    eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  },

  U: {
    cp: [3, 0, 1, 2, 4, 5, 6, 7],
    co: [0, 0, 0, 0, 0, 0, 0, 0],

    ep: [3, 0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11],
    eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  },

  D: {
    cp: [0, 1, 2, 3, 5, 6, 7, 4],
    co: [0, 0, 0, 0, 0, 0, 0, 0],

    ep: [0, 1, 2, 3, 5, 6, 7, 4, 8, 9, 10, 11],
    eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  },

  F: {
    cp: [1, 5, 2, 3, 0, 4, 6, 7],
    co: [2, 1, 0, 0, 1, 2, 0, 0],

    ep: [0, 9, 2, 3, 4, 8, 6, 7, 1, 5, 10, 11],
    eo: [0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0]
  },

  B: {
    cp: [0, 1, 3, 7, 4, 5, 2, 6],
    co: [0, 0, 2, 1, 0, 0, 1, 2],

    ep: [0, 1, 2, 11, 4, 5, 6, 10, 8, 9, 3, 7],
    eo: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1]
  }

};


/* ============================================================
   GIRS DE TOT EL CUB (x, y, z)

   El estat (cp, co, ep, eo) sempre es descriu respecte de les
   posicions de referència. Un gir només canvia el "frame":
   quina cara real correspon a cada cara que veu la persona.

   x gira com R, y gira com U, z gira com F.
   frame[cara_vista] = cara_real
============================================================ */

const IDENTITY_FRAME = { U: "U", D: "D", F: "F", B: "B", L: "L", R: "R" };

// nou frame[k] = frame antic[v]
const ROTATION_CYCLES = {
  x: { U: "F", B: "U", D: "B", F: "D" },
  y: { F: "R", L: "F", B: "L", R: "B" },
  z: { U: "L", R: "U", D: "R", L: "D" }
};


/*
  Un quart de gir dels moviments amplis i de capa central:

    r = L x     l = R x'    u = D y     d = U y'
    f = B z     b = F z'
    M = R L' x'     E = U D' y'     S = F' B z
*/

const EXPANSIONS = {
  r: ["L", "x"],
  l: ["R", "x'"],
  u: ["D", "y"],
  d: ["U", "y'"],
  f: ["B", "z"],
  b: ["F", "z'"],
  M: ["R", "L'", "x'"],
  E: ["U", "D'", "y'"],
  S: ["F'", "B", "z"]
};


/* ============================================================
   ESTAT DEL CUB
============================================================ */

export class Cube {

  constructor() {

    this.reset();

  }


  /*
    Estat resolt.
  */

  reset() {

    this.cp = [
      0, 1, 2, 3,
      4, 5, 6, 7
    ];

    this.co = [
      0, 0, 0, 0,
      0, 0, 0, 0
    ];

    this.ep = [
       0, 1, 2, 3,
       4, 5, 6, 7,
       8, 9, 10, 11
    ];

    this.eo = [
      0, 0, 0, 0,
      0, 0, 0, 0,
      0, 0, 0, 0
    ];

    this.frame = { ...IDENTITY_FRAME };

    return this;

  }


  /*
    Còpia independent de l'estat.
  */

  clone() {

    const copy = new Cube();

    copy.cp = [...this.cp];
    copy.co = [...this.co];
    copy.ep = [...this.ep];
    copy.eo = [...this.eo];
    copy.frame = { ...this.frame };

    return copy;

  }


  /*
    Copia l'estat d'un altre cub.
  */

  copyFrom(other) {

    this.cp = [...other.cp];
    this.co = [...other.co];

    this.ep = [...other.ep];
    this.eo = [...other.eo];
    this.frame = { ...other.frame };

    return this;

  }


  /* ==========================================================
     MOVIMENT
  ========================================================== */

  move(notation) {

    if (!notation) {
      return this;
    }

    const first = notation[0];


    let repetitions = 1;

    if (notation.includes("2")) {
      repetitions = 2;
    } else if (notation.includes("'")) {
      repetitions = 3;
    }


    /*
      Moviments amplis i de capa central: s'expressen amb girs de
      cara i un gir de tot el cub (identitats entre moviments).
    */

    if (EXPANSIONS[first]) {

      for (let i = 0; i < repetitions; i++) {

        for (const token of EXPANSIONS[first]) {
          this.move(token);
        }

      }

      return this;

    }


    /*
      Gir de tot el cub: x, y, z
    */

    if (ROTATION_CYCLES[first]) {

      for (let i = 0; i < repetitions; i++) {
        this.applyRotation(first);
      }

      return this;

    }


    /*
      Gir d'una cara. La cara que veu la persona
      es tradueix a la cara real segons el frame.
    */

    const face = this.frame[first];

    if (!face || !MOVE_TABLES[face]) {

      throw new Error(
        `Moviment desconegut: ${notation}`
      );

    }

    for (let i = 0; i < repetitions; i++) {
      this.applyQuarterTurn(face);
    }

    return this;

  }


  /*
    Un quart de gir de tot el cub (x, y o z).
  */

  applyRotation(axis) {

    const oldFrame = this.frame;
    const newFrame = { ...oldFrame };

    for (const [face, source] of Object.entries(ROTATION_CYCLES[axis])) {
      newFrame[face] = oldFrame[source];
    }

    this.frame = newFrame;

    return this;

  }


  /*
    Identificador de l'orientació actual del cub.
  */

  orientationKey() {

    const f = this.frame;

    return f.U + f.D + f.F + f.B + f.L + f.R;

  }


  /*
    Aplica exactament un gir de 90°.
  */

  applyQuarterTurn(face) {

    const table = MOVE_TABLES[face];

    const oldCP = [...this.cp];
    const oldCO = [...this.co];

    const oldEP = [...this.ep];
    const oldEO = [...this.eo];


    /*
      Cantonades
    */

    for (let i = 0; i < 8; i++) {

      const source = table.cp[i];

      this.cp[i] = oldCP[source];

      this.co[i] =
        (
          oldCO[source] +
          table.co[i]
        ) % 3;

    }


    /*
      Arestes
    */

    for (let i = 0; i < 12; i++) {

      const source = table.ep[i];

      this.ep[i] = oldEP[source];

      this.eo[i] =
        (
          oldEO[source] +
          table.eo[i]
        ) % 2;

    }

    return this;

  }


  /*
    Aplica una seqüència:

      "R U R' U'"
  */

  apply(sequence) {

    const tokens =
      Cube.parseSequence(sequence);

    for (const move of tokens) {

      this.move(move);

    }

    return this;

  }


  /* ==========================================================
     INVERSA
  ========================================================== */

  inverse(sequence) {

    const tokens =
      Cube.parseSequence(sequence);

    return tokens
      .reverse()
      .map(move => {

        if (move.endsWith("2")) {
          return move;
        }

        if (move.endsWith("'")) {
          return move[0];
        }

        return `${move}'`;

      });

  }


  /* ==========================================================
     ESTAT RESOLT
  ========================================================== */

  isSolved() {

    for (let i = 0; i < 8; i++) {

      if (this.cp[i] !== i) {
        return false;
      }

      if (this.co[i] !== 0) {
        return false;
      }

    }


    for (let i = 0; i < 12; i++) {

      if (this.ep[i] !== i) {
        return false;
      }

      if (this.eo[i] !== 0) {
        return false;
      }

    }


    return true;

  }


  /* ==========================================================
     VALIDACIÓ MATEMÀTICA
  ========================================================== */

  isValid() {

    /*
      Cada cantonada ha d'aparèixer
      exactament una vegada.
    */

    if (!Cube.isPermutation(this.cp, 8)) {
      return false;
    }


    /*
      Cada aresta ha d'aparèixer
      exactament una vegada.
    */

    if (!Cube.isPermutation(this.ep, 12)) {
      return false;
    }


    /*
      La suma de les orientacions
      de cantonada ha de ser múltiple de 3.
    */

    const cornerOrientation =
      this.co.reduce(
        (sum, value) => sum + value,
        0
      );

    if (cornerOrientation % 3 !== 0) {
      return false;
    }


    /*
      La suma de les orientacions
      d'aresta ha de ser parella.
    */

    const edgeOrientation =
      this.eo.reduce(
        (sum, value) => sum + value,
        0
      );

    if (edgeOrientation % 2 !== 0) {
      return false;
    }


    /*
      La paritat de cantonades
      i arestes ha de coincidir.
    */

    const cornerParity =
      Cube.permutationParity(this.cp);

    const edgeParity =
      Cube.permutationParity(this.ep);

    if (cornerParity !== edgeParity) {
      return false;
    }


    return true;

  }


  /* ==========================================================
     REPRESENTACIÓ
  ========================================================== */

  toJSON() {

    return {

      cp: [...this.cp],

      co: [...this.co],

      ep: [...this.ep],

      eo: [...this.eo],

      frame: { ...this.frame }

    };

  }


  toString() {

    return JSON.stringify(
      this.toJSON()
    );

  }


  /* ==========================================================
     PARSEJAR MOVIMENTS
  ========================================================== */

  static parseSequence(sequence) {

    if (Array.isArray(sequence)) {

      return sequence
        .filter(Boolean)
        .map(move => move.trim());

    }


    if (
      typeof sequence !== "string" ||
      sequence.trim() === ""
    ) {

      return [];

    }


    return sequence
      .trim()
      .split(/\s+/);

  }


  /* ==========================================================
     UTILITATS MATEMÀTIQUES
  ========================================================== */

  static isPermutation(array, size) {

    if (array.length !== size) {
      return false;
    }

    const seen = new Set(array);

    if (seen.size !== size) {
      return false;
    }

    for (let i = 0; i < size; i++) {

      if (!seen.has(i)) {
        return false;
      }

    }

    return true;

  }


  static permutationParity(permutation) {

    let inversions = 0;

    for (let i = 0; i < permutation.length; i++) {

      for (
        let j = i + 1;
        j < permutation.length;
        j++
      ) {

        if (
          permutation[i] >
          permutation[j]
        ) {

          inversions++;

        }

      }

    }

    return inversions % 2;

  }

}


/* ============================================================
   FUNCIONS AUXILIARS
============================================================ */


/*
  Crea un cub resolt.
*/

export function solvedCube() {

  return new Cube();

}


/*
  Crea un cub i aplica una barreja.
*/

export function cubeFromScramble(scramble) {

  const cube = new Cube();

  cube.apply(scramble);

  return cube;

}


/*
  Inverteix una seqüència.
*/

export function inverseSequence(sequence) {

  const cube = new Cube();

  return cube.inverse(sequence);

}


/*
  Conversió entre notació visual (main.js / moves.js)
  i notació matemàtica (cube.js).

  Verificat: les permutacions de cantonades i arestes de
  MOVE_TABLES coincideixen amb rotateCoordinate/MOVES per
  a les 6 cares, per tant la conversió és la identitat.
*/

export function visualToMathMove(move) {

  return move;

}

export function mathSequenceToVisual(sequence) {

  return Cube.parseSequence(sequence);

}