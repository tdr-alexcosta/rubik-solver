/* =========================================================
   MOVIMENTS DEL CUB
========================================================= */

export const MOVES = {
  R: { axis: "x", layer: 1, direction: -1 },
  L: { axis: "x", layer: -1, direction: 1 },
  U: { axis: "y", layer: 1, direction: -1 },
  D: { axis: "y", layer: -1, direction: 1 },
  F: { axis: "z", layer: 1, direction: -1 },
  B: { axis: "z", layer: -1, direction: 1 }
};


/*
  Girs de tot el cub (layer: null = totes les capes).
  x gira com R, y gira com U, z gira com F.
*/

export const ROTATIONS = {
  x: { axis: "x", layer: null, direction: -1 },
  y: { axis: "y", layer: null, direction: -1 },
  z: { axis: "z", layer: null, direction: -1 }
};


/*
  Moviments amplis (r l u d f b) i de capa central (M E S).
  `layers` són les capes que giren (-1, 0, 1) sobre l'eix.

    r, l, u, d, f, b : cara + capa central
    M segueix L, E segueix D, S segueix F
*/

export const WIDE_MOVES = {
  r: { axis: "x", layers: [0, 1], direction: -1 },
  l: { axis: "x", layers: [-1, 0], direction: 1 },
  u: { axis: "y", layers: [0, 1], direction: -1 },
  d: { axis: "y", layers: [-1, 0], direction: 1 },
  f: { axis: "z", layers: [0, 1], direction: -1 },
  b: { axis: "z", layers: [-1, 0], direction: 1 }
};

export const SLICE_MOVES = {
  M: { axis: "x", layers: [0], direction: 1 },
  E: { axis: "y", layers: [0], direction: 1 },
  S: { axis: "z", layers: [0], direction: -1 }
};


/*
  Definició unificada d'un moviment a partir de la seva lletra:
  { axis, layers, direction }. layers === null vol dir
  "totes les capes" (gir de tot el cub).
*/

export function moveDefinition(letter) {

  if (ROTATIONS[letter]) {
    return { ...ROTATIONS[letter], layers: null };
  }

  if (WIDE_MOVES[letter]) {
    return WIDE_MOVES[letter];
  }

  if (SLICE_MOVES[letter]) {
    return SLICE_MOVES[letter];
  }

  if (MOVES[letter]) {
    return {
      axis: MOVES[letter].axis,
      layers: [MOVES[letter].layer],
      direction: MOVES[letter].direction
    };
  }

  return null;

}


/* =========================================================
   ROTACIÓ DE COORDENADES
========================================================= */

export function rotateCoordinate(
  coord,
  axis,
  direction
) {

  const x = coord.x;
  const y = coord.y;
  const z = coord.z;


  if (axis === "x") {

    if (direction === 1) {

      return {
        x,
        y: -z,
        z: y
      };

    }

    return {
      x,
      y: z,
      z: -y
    };

  }


  if (axis === "y") {

    if (direction === 1) {

      return {
        x: z,
        y,
        z: -x
      };

    }

    return {
      x: -z,
      y,
      z: x
    };

  }


  if (axis === "z") {

    if (direction === 1) {

      return {
        x: -y,
        y: x,
        z
      };

    }

    return {
      x: y,
      y: -x,
      z
    };

  }

}