// js/cfop-algs.js
//
// Algorismes d'OLL (57 casos) i PLL (21 casos) de CFOP.
//
// Tots estan escrits amb el cub orientat amb el groc a dalt (U) i el blanc
// a baix (D), i fan servir moviments amplis (r l u d f b) i de capa
// central (M E S), que cube.js i l'animació ja suporten.
//
// Cap d'aquests algorismes es dóna per bo sense comprovar-lo (vegeu els
// tests): cada OLL ha de deixar l'última capa orientada sense tocar les
// dues primeres capes, cada PLL ha de permutar l'última capa sense
// canviar-ne cap orientació, i entre tots han de cobrir els 215 casos
// d'orientació i els 288 casos de permutació.

import { parse } from "./solver-common.js";

function entry(id, name, text) {
  return { id, name, alg: parse(text) };
}

/* ------------------------------------------------------------
   OLL
------------------------------------------------------------ */

export const OLL = [
  entry(1, null, "R U2 R2 F R F' U2 R' F R F'"),
  entry(2, null, "F R U R' U' F' f R U R' U' f'"),
  entry(3, null, "f R U R' U' f' U' F R U R' U' F'"),
  entry(4, null, "f R U R' U' f' U F R U R' U' F'"),
  entry(5, null, "r' U2 R U R' U r"),
  entry(6, null, "r U2 R' U' R U' r'"),
  entry(7, null, "r U R' U R U2 r'"),
  entry(8, null, "r' U' R U' R' U2 r"),
  entry(9, null, "R U R' U' R' F R2 U R' U' F'"),
  entry(10, null, "R U R' U R' F R F' R U2 R'"),
  entry(11, null, "r U R' U R' F R F' R U2 r'"),
  entry(12, null, "F R U R' U' F' U F R U R' U' F'"),
  entry(13, null, "F U R U' R2 F' R U R U' R'"),
  entry(14, null, "R' F R U R' F' R F U' F'"),
  entry(15, null, "r' U' r R' U' R U r' U r"),
  entry(16, null, "r U r' R U R' U' r U' r'"),
  entry(17, null, "R U R' U R' F R F' U2 R' F R F'"),
  entry(18, null, "r U R' U R U2 r2 U' R U' R' U2 r"),
  entry(19, null, "r' R U R U R' U' r R2 F R F'"),
  entry(20, null, "r U R' U' M2 U R U' R' U' M'"),
  entry(21, null, "R U R' U R U' R' U R U2 R'"),
  entry(22, null, "R U2 R2 U' R2 U' R2 U2 R"),
  entry(23, null, "R2 D R' U2 R D' R' U2 R'"),
  entry(24, null, "r U R' U' r' F R F'"),
  entry(25, null, "F' r U R' U' r' F R"),
  entry(26, "Anti-Sune", "R' U' R U' R' U2 R"),
  entry(27, "Sune", "R U R' U R U2 R'"),
  entry(28, null, "r U R' U' r' R U R U' R'"),
  entry(29, null, "R U R' U' R U' R' F' U' F R U R'"),
  entry(30, null, "F R' F R2 U' R' U' R U R' F2"),
  entry(31, null, "R' U' F U R U' R' F' R"),
  entry(32, null, "R U B' U' R' U R B R'"),
  entry(33, null, "R U R' U' R' F R F'"),
  entry(34, null, "R U R2 U' R' F R U R U' F'"),
  entry(35, null, "R U2 R2 F R F' R U2 R'"),
  entry(36, null, "R' U' R U' R' U R U R B' R' B"),
  entry(37, null, "F R' F' R U R U' R'"),
  entry(38, null, "R U R' U R U' R' U' R' F R F'"),
  entry(39, null, "R U R' F' U' F U R U2 R'"),
  entry(40, null, "R' F R U R' U' F' U R"),
  entry(41, null, "R U R' U R U2 R' F R U R' U' F'"),
  entry(42, null, "R' U' R U' R' U2 R F R U R' U' F'"),
  entry(43, null, "F' U' L' U L F"),
  entry(44, null, "F U R U' R' F'"),
  entry(45, null, "F R U R' U' F'"),
  entry(46, null, "R' U' R' F R F' U R"),
  entry(47, null, "F' L' U' L U L' U' L U F"),
  entry(48, null, "F R U R' U' R U R' U' F'"),
  entry(49, null, "r U' r2 U r2 U r2 U' r"),
  entry(50, null, "r' U r2 U' r2 U' r2 U r'"),
  entry(51, null, "f R U R' U' R U R' U' f'"),
  entry(52, null, "R U R' U R d' R U' R' F'"),
  entry(53, null, "r' U' R U' R' U R U' R' U2 r"),
  entry(54, null, "r U R' U R U' R' U R U2 r'"),
  entry(55, null, "R U2 R2 U' R U' R' U2 F R F'"),
  entry(56, null, "r U r' U R U' R' U R U' R' r U' r'"),
  entry(57, null, "R U R' U' M' U R U' r'")
];

/* ------------------------------------------------------------
   PLL
------------------------------------------------------------ */

export const PLL = [
  entry("Aa", null, "x R' U R' D2 R U' R' D2 R2 x'"),
  entry("Ab", null, "x R2 D2 R U R' D2 R U' R x'"),
  entry("E", null, "x' R U' R' D R U R' D' R U R' D R U' R' D' x"),
  entry("F", null, "R' U' F' R U R' U' R' F R2 U' R' U' R U R' U R"),
  entry("Ga", null, "R2 U R' U R' U' R U' R2 U' D R' U R D'"),
  entry("Gb", null, "R' U' R U D' R2 U R' U R U' R U' R2 D"),
  entry("Gc", null, "R2 U' R U' R U R' U R2 U D' R U' R' D"),
  entry("Gd", null, "R U R' U' D R2 U' R U' R' U R' U R2 D'"),
  entry("H", null, "M2 U M2 U2 M2 U M2"),
  entry("Ja", null, "x R2 F R F' R U2 r' U r U2 x'"),
  entry("Jb", null, "R U R' F' R U R' U' R' F R2 U' R'"),
  entry("Na", null, "R U R' U R U R' F' R U R' U' R' F R2 U' R' U2 R U' R'"),
  entry("Nb", null, "R' U R U' R' F' U' F R U R' F R' F' R U' R"),
  entry("Ra", null, "R U' R' U' R U R D R' U' R D' R' U2 R'"),
  entry("Rb", null, "R' U2 R U2 R' F R U R' U' R' F' R2"),
  entry("T", null, "R U R' U' R' F R2 U' R' U' R U R' F'"),
  entry("Ua", null, "M2 U M U2 M' U M2"),
  entry("Ub", null, "M2 U' M U2 M' U' M2"),
  entry("V", null, "R' U R' U' y R' F' R2 U' R' U R' F R F"),
  entry("Y", null, "F R U' R' U' R U R' F' R U R' U' R' F R F'"),
  entry("Z", null, "M2 U M2 U M' U2 M2 U2 M' U2")
];


/* ------------------------------------------------------------
   F2L (forat davanter-dret, blanc a baix, groc a dalt)

   Seqüències habituals per inserir una parella cantonada + aresta
   al seu forat (o per treure-la d'un forat incorrecte). Totes
   estan validades sobre cube.js: només toquen la parella del forat
   davanter-dret i la capa superior; la creu i els altres tres
   forats queden intactes.

   Les versions per als altres tres forats s'obtenen girant el cub
   (y); les versions per al forat esquerre són la imatge mirall de
   cada seqüència (R ↔ L, i cada gir en sentit contrari).
------------------------------------------------------------ */

const F2L_TEXT = [
  "R U R'",
  "R U' R'",
  "R U2 R'",
  "F' U' F",
  "F' U F",
  "F' U2 F",
  "U R U' R'",
  "U' R U R'",
  "U' F' U F",
  "U F' U' F",
  "R U' R' U R U' R'",
  "R U R' U' R U R'",
  "R U2 R' U' R U R'",
  "R U2 R' U R U' R'",
  "F' U2 F U F' U' F",
  "F' U2 F U' F' U F",
  "R U' R' U2 F' U' F",
  "R U R' U2 F' U F",
  "R U R' U' R U R' U' R U R'",
  "R U' R' U R U2 R' U R U' R'",
  "R U R' U2 R U R' U' R U R'",
  "R U' R' U2 R U R' U' R U R'",
  "R U2 R' U2 R U' R' U R U' R'",
  "R U' R' U' R U R' U' R U R'",
  "R U R' U R U' R' U R U' R'",
  "R U' R' U' R U' R' U R U' R'",
  "U R U2 R' U R U' R'",
  "U' R U2 R' U' R U R'",
  "U' R U' R' U R U R'",
  "U R U R' U' R U' R'",
  "R U' R' U R U' R' U' R U R'",
  "R2 U2 F R2 F' U2 R' U R'",
  "R U2 R2 F R F' R U2 R'",
  "R U R' U' R U R' U2 R U R' U' R U R'",
  "F' U F U' F' U' F",
  "F' U' F U F' U F",
  "R U' R' U' F' U2 F",
  "R U R' U F' U2 F",
  "R U R' U' F' U' F",
  "R U' R' U F' U F",
  "R U2 R' F R' F' R",
  "F' U2 F R U R'",
  "U' R U' R' U2 R U' R'",
  "U R U R' U2 R U R'",
  "R U' R' U F' U' F",
  "R U R' U' F' U F",
  "R U' R' U2 R U R'",
  "R U R' U2 R U' R'",
  "U F' U' F U' F' U F",
  "U' F' U F U F' U' F",
  "U R U' R' U' R U R'",
  "U' R U R' U R U' R'",
  "F R' F' R U R U' R'",
  "R' F R F' U' F' U F",
  "R U R' F' R U R' U' R' F R2 U' R'",
  "F' U' F U2 R U R'",
  "R U R' U2 F' U' F",
  "U2 R U R' U R U' R'"
];

export const F2L = F2L_TEXT.map(text => parse(text));
