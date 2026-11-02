import * as THREE from "three";

import {
  OrbitControls
} from "three/addons/controls/OrbitControls.js";

import {
  ROTATIONS,
  moveDefinition,
  rotateCoordinate
} from "./moves.js";

import {
  Cube,
  visualToMathMove,
  mathSequenceToVisual
} from "./cube.js";

import {
  solveLBL,
  formatLBL
} from "./lbl.js";

import {
  solveCFOP
} from "./cfop.js";

import {
  buildOptimalResult
} from "./optimal.js";

import {
  runOptimalParallel
} from "./optimal-parallel.js";

import {
  createEtaEstimator,
  formatDuration
} from "./optimal-eta.js";

/* =========================================================
   ELEMENTS HTML
========================================================= */

const cubeContainer =
  document.getElementById(
    "cube-container"
  );

const scrambleInput =
  document.getElementById(
    "scrambleInput"
  );

const scrambleBtn =
  document.getElementById(
    "scrambleBtn"
  );

const solveBtn =
  document.getElementById(
    "solveBtn"
  );

const statusText =
  document.getElementById(
    "statusText"
  );

const statusDot =
  document.querySelector(
    ".status-dot"
  );

const selectedMethodTitle =
  document.getElementById(
    "selectedMethodTitle"
  );

const solutionSequence =
  document.getElementById(
    "solutionSequence"
  );

const solutionStatus =
  document.getElementById(
    "solutionStatus"
  );

const methodCards =
  document.querySelectorAll(
    ".method-card"
  );


/* =========================================================
   THREE.JS
========================================================= */

const scene =
  new THREE.Scene();

scene.background =
  new THREE.Color(0x111111);


/* =========================================================
   CÀMERA
========================================================= */

const camera =
  new THREE.PerspectiveCamera(
    45,

    cubeContainer.clientWidth /
      cubeContainer.clientHeight,

    0.1,
    100
  );


/*
  Aquesta és la distància màxima
  que tenia l'aplicació anterior.

  Per tant, és el zoom inicial
  que volem conservar.
*/

const DEFAULT_CAMERA_POSITION =
  new THREE.Vector3(
    7.5838,
    7.0608,
    9.4144
  );

const DEFAULT_CAMERA_TARGET =
  new THREE.Vector3(
    0,
    0,
    0
  );


camera.position.copy(
  DEFAULT_CAMERA_POSITION
);


/* =========================================================
   RENDERER
========================================================= */

const renderer =
  new THREE.WebGLRenderer({
    antialias: true
  });

renderer.setPixelRatio(
  Math.min(
    window.devicePixelRatio,
    2
  )
);

renderer.setSize(
  cubeContainer.clientWidth,
  cubeContainer.clientHeight
);

renderer.outputColorSpace =
  THREE.SRGBColorSpace;

cubeContainer.appendChild(
  renderer.domElement
);


/* =========================================================
   CONTROLS DE CÀMERA
========================================================= */

const controls = new OrbitControls(
  camera,
  renderer.domElement
);

controls.enableDamping = true;
controls.dampingFactor = 0.07;

controls.enableZoom = true;
controls.minDistance = 5;
controls.maxDistance = 14;

controls.enablePan = false;

controls.target.copy(
  DEFAULT_CAMERA_TARGET
);


/* =========================================================
   LLUMS
========================================================= */

const ambient =
  new THREE.AmbientLight(
    0xffffff,
    2.2
  );

scene.add(ambient);


const keyLight =
  new THREE.DirectionalLight(
    0xffffff,
    4
  );

keyLight.position.set(
  5,
  8,
  10
);

scene.add(keyLight);


const fillLight =
  new THREE.DirectionalLight(
    0xffffff,
    1.5
  );

fillLight.position.set(
  -6,
  3,
  -5
);

scene.add(fillLight);


/* =========================================================
   SÒL
========================================================= */

const floor =
  new THREE.Mesh(

    new THREE.PlaneGeometry(
      30,
      30
    ),

    new THREE.MeshStandardMaterial({
      color: 0x181818,
      roughness: 1
    })

  );

floor.rotation.x =
  -Math.PI / 2;

floor.position.y =
  -2.15;

scene.add(floor);


/* =========================================================
   CUB
========================================================= */

const cubeGroup =
  new THREE.Group();

scene.add(cubeGroup);


const SIZE = 1.28;
const GAP = 0.075;


const COLORS = {

  right: 0xff3b30,

  left: 0xff8c00,

  top: 0xffffff,

  bottom: 0xffd500,

  front: 0x00a651,

  back: 0x0066ff

};


const pieces = [];


/* =========================================================
   CREAR MATERIALS
========================================================= */

function makeMaterials() {

  return [

    new THREE.MeshStandardMaterial({
      color: 0x111111
    }),

    new THREE.MeshStandardMaterial({
      color: COLORS.right
    }),

    new THREE.MeshStandardMaterial({
      color: COLORS.left
    }),

    new THREE.MeshStandardMaterial({
      color: COLORS.top
    }),

    new THREE.MeshStandardMaterial({
      color: COLORS.bottom
    }),

    new THREE.MeshStandardMaterial({
      color: COLORS.front
    }),

    new THREE.MeshStandardMaterial({
      color: COLORS.back
    })

  ];

}


/* =========================================================
   CREAR PEÇA
========================================================= */

function createPiece(
  x,
  y,
  z
) {

  const materials =
    makeMaterials();


  const geometry =
    new THREE.BoxGeometry(
      SIZE - GAP,
      SIZE - GAP,
      SIZE - GAP
    );


  /*
    BoxGeometry:

    0 = +X
    1 = -X
    2 = +Y
    3 = -Y
    4 = +Z
    5 = -Z
  */

  materials[0].color.setHex(
    x === 1
      ? COLORS.right
      : 0x111111
  );

  materials[1].color.setHex(
    x === -1
      ? COLORS.left
      : 0x111111
  );

  materials[2].color.setHex(
    y === 1
      ? COLORS.top
      : 0x111111
  );

  materials[3].color.setHex(
    y === -1
      ? COLORS.bottom
      : 0x111111
  );

  materials[4].color.setHex(
    z === 1
      ? COLORS.front
      : 0x111111
  );

  materials[5].color.setHex(
    z === -1
      ? COLORS.back
      : 0x111111
  );


  const mesh =
    new THREE.Mesh(
      geometry,
      materials
    );


  mesh.position.set(
    x * SIZE,
    y * SIZE,
    z * SIZE
  );


  /*
    Guardem la posició inicial.
  */

  mesh.userData.home = {
    x,
    y,
    z
  };


  /*
    I la posició matemàtica actual.
  */

  mesh.userData.coord = {
    x,
    y,
    z
  };


  cubeGroup.add(mesh);

  pieces.push(mesh);

}


/* =========================================================
   CONSTRUIR CUB 3×3×3
========================================================= */

for (
  let x = -1;
  x <= 1;
  x++
) {

  for (
    let y = -1;
    y <= 1;
    y++
  ) {

    for (
      let z = -1;
      z <= 1;
      z++
    ) {

      createPiece(
        x,
        y,
        z
      );

    }

  }

}


/* =========================================================
   ESTAT DE L'APLICACIÓ
========================================================= */

let animating = false;

let scrambleInProgress =
  false;


/* =========================================================
   MOTOR MATEMÀTIC
========================================================= */

const mathCube =
  new Cube();


let currentSolution = [];

let currentSolutionIndex = 0;

/* =========================================================
   RESTABLIR CÀMERA
========================================================= */

function resetCameraOrientation() {

  camera.position.copy(
    DEFAULT_CAMERA_POSITION
  );

  controls.target.copy(
    DEFAULT_CAMERA_TARGET
  );

  controls.update();

}


/* =========================================================
   RESTABLIR CUB
========================================================= */

function resetCube() {
  mathCube.reset();

  currentSolution = [];

  currentSolutionIndex = 0;

  playing = false;

  pieces.forEach(
    piece => {

      const home =
        piece.userData.home;


      piece.userData.coord = {
        x: home.x,
        y: home.y,
        z: home.z
      };


      piece.position.set(
        home.x * SIZE,
        home.y * SIZE,
        home.z * SIZE
      );


      piece.rotation.set(
        0,
        0,
        0
      );


      piece.quaternion.identity();

    }
  );

}


/* =========================================================
   ANIMAR UN MOVIMENT
========================================================= */

function animateMove(
  notation,
  duration = 120
) {

  mathCube.move(
    visualToMathMove(notation)
  );

  return new Promise(
    resolve => {

      /*
        x, y, z (minúscula) = gir de tot el cub.
        La resta = gir d'una cara.
      */

      const definition =
        moveDefinition(notation[0]);


      if (!definition) {

        resolve();

        return;
      }


      let direction =
        definition.direction;


      if (
        notation.includes("'")
      ) {

        direction *= -1;

      }


      /*
        Un moviment doble són
        dos girs de 90 graus.
      */

      const repetitions =
        notation.includes("2")
          ? 2
          : 1;


      animateSingleTurn(
        definition,
        direction,
        duration
      )
      .then(
        () => {

          if (
            repetitions === 2
          ) {

            return animateSingleTurn(
              definition,
              direction,
              duration
            );

          }

        }
      )
      .then(
        resolve
      );

    }
  );

}


/* =========================================================
   GIR DE 90 GRAUS
========================================================= */

function animateSingleTurn(
  definition,
  direction,
  duration
) {

  return new Promise(
    resolve => {

      const axis =
        definition.axis;

      const layers =
        definition.layers;


      const selected =
        pieces.filter(
          piece => {

            const coord =
              piece.userData.coord;

            return (
              layers === null ||
              layers.includes(
                Math.round(
                  coord[axis]
                )
              )
            );

          }
        );


      const rotationGroup =
        new THREE.Group();

      scene.add(
        rotationGroup
      );


      /*
        Guardem la posició i orientació
        mundial de cada peça.
      */

      selected.forEach(
        piece => {

          const worldPosition =
            new THREE.Vector3();

          const worldQuaternion =
            new THREE.Quaternion();


          piece.getWorldPosition(
            worldPosition
          );

          piece.getWorldQuaternion(
            worldQuaternion
          );


          cubeGroup.remove(
            piece
          );

          rotationGroup.add(
            piece
          );


          piece.position.copy(
            worldPosition
          );

          piece.quaternion.copy(
            worldQuaternion
          );

        }
      );


      const start =
        performance.now();


      const axisVector =
        axis === "x"

          ? new THREE.Vector3(
              1,
              0,
              0
            )

          : axis === "y"

            ? new THREE.Vector3(
                0,
                1,
                0
              )

            : new THREE.Vector3(
                0,
                0,
                1
              );


      const targetAngle =
        direction *
        Math.PI /
        2;


      function frame(time) {

        const progress =
          Math.min(
            (
              time - start
            ) / duration,
            1
          );


        const eased =
          1 -
          Math.pow(
            1 - progress,
            3
          );


        rotationGroup.setRotationFromAxisAngle(
          axisVector,
          targetAngle * eased
        );


        if (
          progress < 1
        ) {

          requestAnimationFrame(
            frame
          );

          return;
        }


        /*
          Actualitzem la posició
          matemàtica de les peces.
        */

        selected.forEach(
          piece => {

            const old =
              piece.userData.coord;


            piece.userData.coord =
              rotateCoordinate(
                old,
                axis,
                direction
              );

          }
        );


        /*
          Tornem a posar les peces
          dins del cub principal.
        */

        selected.forEach(
          piece => {

            const coord =
              piece.userData.coord;


            const worldPosition =
              new THREE.Vector3();

            const worldQuaternion =
              new THREE.Quaternion();


            piece.getWorldPosition(
              worldPosition
            );

            piece.getWorldQuaternion(
              worldQuaternion
            );


            rotationGroup.remove(
              piece
            );

            cubeGroup.add(
              piece
            );


            piece.position.set(
              coord.x * SIZE,
              coord.y * SIZE,
              coord.z * SIZE
            );


            piece.quaternion.copy(
              worldQuaternion
            );

          }
        );


        scene.remove(
          rotationGroup
        );


        resolve();

      }


      requestAnimationFrame(
        frame
      );

    }
  );

}


/* =========================================================
   REPRODUCCIÓ DE LA SOLUCIÓ
========================================================= */

const previousStepBtn =
  document.getElementById(
    "previousStepBtn"
  );

const playSolutionBtn =
  document.getElementById(
    "playSolutionBtn"
  );

const nextStepBtn =
  document.getElementById(
    "nextStepBtn"
  );


/*
  Durada d'un quart de gir (ms).
  Un gir doble en dura el doble.
*/

const MOVE_DURATION = 450;


/*
  Durada del gir de càmera que deixa el cub
  amb el verd davant i el blanc a dalt (ms).
*/

const CAMERA_RESET_DURATION = 600;


/*
  Vista de reproducció: càmera al pla central (x = 0),
  davant del cub i una mica elevada. Només es veuen
  2 cares: la verda (davant) i la blanca (a dalt).
  Mateixa distància que la vista inicial.
*/

const PLAY_CAMERA_ELEVATION_DEG = 35;

const PLAY_CAMERA_DISTANCE =
  DEFAULT_CAMERA_POSITION.length();

const PLAY_CAMERA_POSITION =
  new THREE.Vector3(
    0,
    PLAY_CAMERA_DISTANCE *
      Math.sin(
        PLAY_CAMERA_ELEVATION_DEG *
          Math.PI / 180
      ),
    PLAY_CAMERA_DISTANCE *
      Math.cos(
        PLAY_CAMERA_ELEVATION_DEG *
          Math.PI / 180
      )
  );


let playing = false;

let solutions = {};

let lastScramble = [];

let moveElements = [];


const AXIS_VECTORS = {

  x: new THREE.Vector3(1, 0, 0),

  y: new THREE.Vector3(0, 1, 0),

  z: new THREE.Vector3(0, 0, 1)

};


function inverseNotation(move) {

  if (move.endsWith("2")) {
    return move;
  }

  if (move.endsWith("'")) {
    return move[0];
  }

  return `${move}'`;

}


/*
  Aplica un gir sense animació (mateix resultat que animateMove).
*/

function applyTurnInstant(
  definition,
  direction
) {

  const quaternion =
    new THREE.Quaternion()
      .setFromAxisAngle(
        AXIS_VECTORS[definition.axis],
        direction * Math.PI / 2
      );

  pieces.forEach(
    piece => {

      const coord =
        piece.userData.coord;

      if (
        definition.layers !== null &&
        !definition.layers.includes(
          Math.round(
            coord[definition.axis]
          )
        )
      ) {

        return;

      }

      const next =
        rotateCoordinate(
          coord,
          definition.axis,
          direction
        );

      piece.userData.coord = next;

      piece.position.set(
        next.x * SIZE,
        next.y * SIZE,
        next.z * SIZE
      );

      piece.quaternion.premultiply(
        quaternion
      );

    }
  );

}


function applyMoveInstant(notation) {

  mathCube.move(
    visualToMathMove(notation)
  );

  const definition =
    moveDefinition(notation[0]);

  if (!definition) {
    return;
  }

  let direction =
    definition.direction;

  if (notation.includes("'")) {
    direction *= -1;
  }

  const repetitions =
    notation.includes("2")
      ? 2
      : 1;

  for (
    let i = 0;
    i < repetitions;
    i++
  ) {

    applyTurnInstant(
      definition,
      direction
    );

  }

}


/*
  Deixa el cub (3D i matemàtic) exactament
  en l'estat de la barreja, sense animar.
*/

function prepareScrambledCube(tokens) {

  resetCube();

  tokens.forEach(applyMoveInstant);

  lastScramble = [...tokens];

}


/* ---------------------------------------------------------
   NOMBRE DE MOVIMENTS (al títol: "LBL - 113 moviments")
   Només compten els girs de cara (un gir doble compta 1).
   Els girs de tot el cub (x, y, z) no compten.
--------------------------------------------------------- */

function setSolutionCount(moves) {

  const name =
    METHOD_NAMES[selectedMethod];

  if (!moves) {

    selectedMethodTitle.textContent =
      name ?? "—";

    return;

  }

  const count =
    moves.filter(
      move => !ROTATIONS[move[0]]
    ).length;

  selectedMethodTitle.textContent =
    `${name} - ${count} ` +
    (count === 1 ? "moviment" : "moviments");

}


/* ---------------------------------------------------------
   SOLUCIÓ EN PANTALLA
--------------------------------------------------------- */

function renderSolution(result) {

  solutionSequence.textContent = "";

  moveElements = [];

  for (const step of result.steps) {

    const title =
      document.createElement("div");

    title.className = "sol-step";

    title.textContent =
      `STEP ${step.id}`;

    solutionSequence.appendChild(title);


    for (const line of step.lines) {

      const row =
        document.createElement("div");

      row.className = "sol-line";


      if (line.moves.length === 0) {

        const empty =
          document.createElement("span");

        empty.className = "sol-empty";

        empty.textContent = "—";

        row.appendChild(empty);

      }


      for (const move of line.moves) {

        const element =
          document.createElement("span");

        element.className = "sol-move";

        element.textContent = move;

        row.appendChild(element);

        row.appendChild(
          document.createTextNode(" ")
        );

        moveElements.push(element);

      }


      const label =
        document.createElement("span");

      label.className = "sol-label";

      label.textContent =
        `// ${line.label}`;

      row.appendChild(label);

      solutionSequence.appendChild(row);

    }

  }


  /*
    Si el text no coincideix amb la solució
    que es reproduirà, mostrem el text pla.
  */

  if (
    moveElements.length !==
    currentSolution.length
  ) {

    moveElements = [];

    solutionSequence.textContent =
      formatLBL(result);

  }

}


function showSolution(result) {

  currentSolutionIndex = 0;

  setSolutionCount(currentSolution);

  renderSolution(result);

  updateProgress();

}


function updateProgress() {

  moveElements.forEach(
    (element, index) => {

      element.classList.toggle(
        "done",
        index < currentSolutionIndex
      );

      element.classList.toggle(
        "next",
        index === currentSolutionIndex
      );

    }
  );

  const next =
    moveElements[currentSolutionIndex];

  if (
    next &&
    typeof next.scrollIntoView ===
      "function"
  ) {

    next.scrollIntoView({
      block: "nearest"
    });

  }

  updateControls();

}


function updateControls() {

  const total =
    currentSolution.length;

  const hasSolution =
    total > 0;

  const atEnd =
    currentSolutionIndex >= total;


  previousStepBtn.disabled =
    !hasSolution ||
    playing ||
    animating ||
    currentSolutionIndex === 0;

  nextStepBtn.disabled =
    !hasSolution ||
    playing ||
    animating ||
    atEnd;

  playSolutionBtn.disabled =
    !hasSolution ||
    (animating && !playing) ||
    (!playing && atEnd);

  playSolutionBtn.textContent =
    playing ? "❚❚" : "▶";


  solveBtn.disabled =
    playing || animating;

  /*
    Girar el cub amb el ratolí només
    es permet quan no s'està reproduint.
    Sense inèrcia mentre està bloquejat.
  */

  controls.enabled =
    !playing;

  controls.enableDamping =
    !playing;

  updateScrambleButton();

}


function reportProgress() {

  const total =
    currentSolution.length;

  if (total === 0) {
    return;
  }

  if (currentSolutionIndex >= total) {

    if (mathCube.isSolved()) {

      statusText.textContent =
        "Cub resolt.";

      statusDot.style.background =
        "#4ade80";

    } else {

      statusText.textContent =
        "Error: el cub no ha quedat resolt.";

      statusDot.style.background =
        "#ef4444";

    }

    return;

  }

  statusText.textContent =
    `Moviment ${currentSolutionIndex} / ${total}`;

  statusDot.style.background =
    playing
      ? "#facc15"
      : "#777";

}


/* ---------------------------------------------------------
   MOVIMENTS DE LA REPRODUCCIÓ
--------------------------------------------------------- */

async function stepForward() {

  if (
    animating ||
    currentSolutionIndex >=
      currentSolution.length
  ) {

    return;

  }

  animating = true;

  updateControls();

  try {

    await animateMove(
      currentSolution[
        currentSolutionIndex
      ],
      MOVE_DURATION
    );

    currentSolutionIndex++;

  } finally {

    animating = false;

  }

  updateProgress();

  reportProgress();

}


async function stepBack() {

  if (
    animating ||
    currentSolutionIndex === 0
  ) {

    return;

  }

  animating = true;

  updateControls();

  try {

    await animateMove(
      inverseNotation(
        currentSolution[
          currentSolutionIndex - 1
        ]
      ),
      MOVE_DURATION
    );

    currentSolutionIndex--;

  } finally {

    animating = false;

  }

  updateProgress();

  reportProgress();

}


/*
  Mou la càmera suaument fins a la vista de reproducció
  (verd davant, blanc a dalt) per l'arc més curt.
*/

function animateCameraToPlayView(
  duration = CAMERA_RESET_DURATION
) {

  return new Promise(
    resolve => {

      const from = camera.position;

      const fromRadius = Math.hypot(
        from.x,
        from.y,
        from.z
      );

      const fromTheta = Math.atan2(
        from.x,
        from.z
      );

      const fromPhi = Math.acos(
        from.y / fromRadius
      );


      const to =
        PLAY_CAMERA_POSITION;

      const toRadius = Math.hypot(
        to.x,
        to.y,
        to.z
      );

      const toTheta = Math.atan2(
        to.x,
        to.z
      );

      const toPhi = Math.acos(
        to.y / toRadius
      );


      /*
        Angle horitzontal pel camí més curt.
      */

      let deltaTheta =
        toTheta - fromTheta;

      while (deltaTheta > Math.PI) {
        deltaTheta -= 2 * Math.PI;
      }

      while (deltaTheta < -Math.PI) {
        deltaTheta += 2 * Math.PI;
      }


      const start =
        performance.now();


      function frame(time) {

        const progress =
          Math.min(
            Math.max(
              (time - start) / duration,
              0
            ),
            1
          );

        const eased =
          progress < 0.5
            ? 2 * progress * progress
            : 1 - Math.pow(
                -2 * progress + 2,
                2
              ) / 2;


        const radius =
          fromRadius +
          (toRadius - fromRadius) * eased;

        const theta =
          fromTheta + deltaTheta * eased;

        const phi =
          fromPhi + (toPhi - fromPhi) * eased;


        camera.position.set(
          radius * Math.sin(phi) * Math.sin(theta),
          radius * Math.cos(phi),
          radius * Math.sin(phi) * Math.cos(theta)
        );

        controls.target.copy(
          DEFAULT_CAMERA_TARGET
        );

        controls.update();


        if (progress < 1) {

          requestAnimationFrame(
            frame
          );

          return;

        }


        /*
          Posició final exacta.
        */

        camera.position.copy(
          PLAY_CAMERA_POSITION
        );

        controls.target.copy(
          DEFAULT_CAMERA_TARGET
        );

        controls.update();

        resolve();

      }


      requestAnimationFrame(
        frame
      );

    }
  );

}


async function playSolution() {

  if (
    playing ||
    animating ||
    currentSolution.length === 0
  ) {

    return;

  }

  playing = true;

  /*
    Mentre es reprodueix, l'usuari no pot
    girar el cub: els controls es bloquegen
    i la càmera es posa de cara (verd davant,
    blanc a dalt).
  */

  updateControls();

  await animateCameraToPlayView();

  while (
    playing &&
    currentSolutionIndex <
      currentSolution.length
  ) {

    await stepForward();

  }

  playing = false;

  updateProgress();

  reportProgress();

}


playSolutionBtn.addEventListener(
  "click",
  () => {

    if (playing) {

      /*
        Pausa: el moviment en curs
        s'acaba abans d'aturar-se.
      */

      playing = false;

      updateControls();

      return;

    }

    playSolution();

  }
);

previousStepBtn.addEventListener(
  "click",
  stepBack
);

nextStepBtn.addEventListener(
  "click",
  stepForward
);


/*
  Torna a posar el cub a l'inici de la solució
  del mètode indicat (o la buida si no n'hi ha).
*/

function loadMethodSolution(method) {

  const result =
    solutions[method];

  if (!result) {

    currentSolution = [];

    currentSolutionIndex = 0;

    moveElements = [];

    solutionSequence.textContent = "—";

    setSolutionCount(null);

    updateControls();

    return;

  }

  prepareScrambledCube(
    lastScramble
  );

  currentSolution =
    mathSequenceToVisual(
      result.moves
    );

  if (currentSolution.length === 0) {

    solutionSequence.textContent =
      "Ja està resolt.";

    setSolutionCount([]);

    moveElements = [];

    updateControls();

    return;

  }

  showSolution(result);

  reportProgress();

}


/* =========================================================
   SCRAMBLE
========================================================= */

async function scrambleCube() {

  if (
    animating ||
    scrambleInProgress
  ) {

    return;

  }


  const result =
    validateScramble(
      scrambleInput.value
    );


  if (
    !result.valid
  ) {

    statusText.textContent =
      result.message;

    statusDot.style.background =
      "#f87171";

    return;

  }


  const scramble =
    result.tokens;


  scrambleInProgress =
    true;

  animating =
    true;


  resetCube();

  solutions = {};

  hideOptimalBanner();

  moveElements = [];

  updateControls();


  /*
    Una nova barreja invalida
    qualsevol solució anterior.
  */

  solutionsCalculated =
    false;

  selectedMethod =
    null;


  methodCards.forEach(
    card => {

      card.disabled =
        true;

      card.classList.add(
        "disabled"
      );

      card.classList.remove(
        "selected"
      );

    }
  );


  selectedMethodTitle.textContent =
    "—";


  solutionSequence.textContent =
    "—";

  setSolutionCount(null);


  solutionStatus.textContent =
    "Esperant";


  statusText.textContent =
    "Barrejant el cub...";


  statusDot.style.background =
    "#facc15";


  const quarterTurns =
    scramble.reduce(
      (
        total,
        move
      ) =>
        total +
        (
          move.includes("2")
            ? 2
            : 1
        ),
      0
    );


  const durationPerQuarterTurn =
    1000 /
    quarterTurns;


  try {

    for (
      const move of scramble
    ) {

      await animateMove(
        move,
        durationPerQuarterTurn
      );

    }


    statusText.textContent =
      "Cub barrejat.";


    statusDot.style.background =
      "#4ade80";

  }

  finally {

    scrambleInProgress =
      false;

    animating =
      false;

    updateControls();

  }

}


/* =========================================================
   BOTÓ BARREJAR
========================================================= */

scrambleBtn.addEventListener(
  "click",
  scrambleCube
);


/* =========================================================
   ESTAT DEL BOTÓ DE BARREJA
========================================================= */

function updateScrambleButton() {

  const hasText =
    scrambleInput.value.trim().length > 0;


  scrambleBtn.disabled =
    !hasText ||
    playing ||
    animating;

}


/*
  Comprovem el text mentre
  l'usuari escriu.
*/

scrambleInput.addEventListener(
  "input",
  updateScrambleButton
);


/*
  Estat inicial:
  sense barreja → botó desactivat.
*/

updateScrambleButton();


/* =========================================================
   VALIDAR BARREJA
========================================================= */

function validateScramble(
  text
) {

  const value =
    text.trim();


  if (!value) {

    return {

      valid: false,

      message:
        "Introdueix una barreja."

    };

  }


  const tokens =
    value.split(
      /\s+/
    );


  const validMove =
    /^[RLUDFB](2|'2|')?$/;


  for (
    const token of tokens
  ) {

    if (
      !validMove.test(
        token
      )
    ) {

      return {

        valid: false,

        message:
          `Moviment no vàlid: ${token}`

      };

    }

  }


  return {

    valid: true,

    tokens

  };

}


/* =========================================================
   MÈTODES
========================================================= */

let selectedMethod =
  null;


const METHOD_NAMES = {

  lbl: "LBL",

  cfop: "CFOP",

  optimal: "Optimal"

};


function selectMethod(
  method
) {

  /*
    No deixem seleccionar
    fins que les solucions
    estiguin calculades.
  */

  if (
    !solutionsCalculated
  ) {

    return;

  }


  selectedMethod =
    method;


  methodCards.forEach(
    card => {

      card.classList.toggle(
        "selected",

        card.dataset.method ===
          method

      );

    }
  );


  selectedMethodTitle.textContent =
    METHOD_NAMES[method];


  /*
    Mostra la solució d'aquest mètode i
    deixa el cub a l'inici de la reproducció.
  */

  if (!playing && !animating) {

    loadMethodSolution(method);

  }

}


/* =========================================================
   ESTAT DE LES SOLUCIONS
========================================================= */

let solutionsCalculated =
  false;


/* =========================================================
   ACTIVAR MÈTODES
========================================================= */

function enableMethodCards() {

  methodCards.forEach(
    card => {

      card.disabled =
        false;

      card.classList.remove(
        "disabled"
      );

    }
  );

}


/* =========================================================
   CALCULAR SOLUCIONS
========================================================= */


/* =========================================================
   OPTIMAL (en segon pla)
   La cerca triga uns segons: s'executa en un Worker perquè
   la pàgina no es bloquegi. Si el Worker no es pot crear,
   es fa al fil principal amb un temps més curt.
========================================================= */


/* ---------------------------------------------------------
   BANNER D'ESTAT DE L'ÒPTIM
--------------------------------------------------------- */

const optimalBanner = document.getElementById("optimalBanner");
const optimalTitle = document.getElementById("optimalTitle");
const optimalDetail = document.getElementById("optimalDetail");
const optimalTime = document.getElementById("optimalTime");

let optimalTimer = null;

function stopOptimalTimer() {
  if (optimalTimer !== null) {
    clearInterval(optimalTimer);
    optimalTimer = null;
  }
}

function hideOptimalBanner() {
  stopOptimalTimer();

  // Una nova barreja cancel·la la cerca anterior.
  if (optimalAbort) {
    optimalAbort.run.terminate();
    optimalAbort = null;
  }

  if (optimalBanner) optimalBanner.hidden = true;
}

function showOptimalRunning() {
  if (!optimalBanner) return;

  const stopBtn = document.getElementById("optimalStopBtn");

  if (stopBtn && !stopBtn.dataset.bound) {

    stopBtn.dataset.bound = "1";

    // Atura la cerca i es queda amb la millor solució trobada fins ara.
    stopBtn.addEventListener("click", () => {

      if (optimalAbort) optimalAbort.run.stop();

    });

  }

  stopOptimalTimer();

  optimalBanner.hidden = false;
  optimalBanner.classList.remove("done", "failed");
  optimalTitle.textContent = "Calculant la solució òptima";
  optimalDetail.textContent = "Cerca en segon pla · LBL i CFOP ja es poden reproduir";

  optimalEta = createEtaEstimator();

  const t0 = performance.now();
  optimalTime.textContent = "0 s";

  optimalTimer = setInterval(() => {
    optimalTime.textContent =
      Math.floor((performance.now() - t0) / 1000) + " s";
  }, 250);
}

let optimalEta = createEtaEstimator();

function showOptimalProgress(p) {
  if (!optimalBanner || optimalBanner.classList.contains("done")) return;

  if (p.building) {
    optimalDetail.textContent =
      `Millor trobada: ${p.length} moviments · preparant taules (només la primera vegada)`;
    return;
  }

  if (p.lower !== undefined) {
    const pct = p.total ? ` (${Math.round(100 * p.done / p.total)} %)` : "";

    const eta = optimalEta.update(p, performance.now());

    const etaText =
      p.lower >= p.length
        ? ""
        : eta === null
          ? " · calculant estimació…"
          : ` · temps restant: com a màxim ~${formatDuration(eta)}`;

    optimalDetail.textContent =
      `Millor trobada: ${p.length} · demostrat: l'òptim és ≥ ${p.lower}` +
      ` · verificant longitud ${p.lower}${pct}` +
      (p.workers ? ` · ${p.workers} fils` : "") +
      etaText;
    return;
  }

  optimalDetail.textContent =
    `Millor trobada: ${p.length} moviments · continua buscant`;
}

function showOptimalDone(n, proven, lower) {
  if (!optimalBanner) return;

  stopOptimalTimer();

  optimalBanner.hidden = false;
  optimalBanner.classList.remove("failed");
  optimalBanner.classList.add("done");
  optimalTitle.textContent = `Optimal calculat · ${n} moviments${proven ? " *" : ""}`;
  optimalDetail.textContent = proven
    ? "* Demostrada com a òptima: no n'existeix cap de més curta"
    : lower
      ? `Millor trobada · demostrat només que l'òptim és ≥ ${lower} i ≤ ${n}`
      : "Millor solució trobada (no demostrada com a òptima)";
  optimalTime.textContent = "";
}

function showOptimalFailed() {
  if (!optimalBanner) return;

  stopOptimalTimer();

  optimalBanner.hidden = false;
  optimalBanner.classList.remove("done");
  optimalBanner.classList.add("failed");
  optimalTitle.textContent = "No s'ha pogut calcular l'òptim";
  optimalDetail.textContent = "LBL i CFOP continuen disponibles";
  optimalTime.textContent = "";
}

const OPTIMAL_OPTIONS = { timeMs: 4000, proofMs: Infinity };

/* Inversa de la barreja: sempre resol el cub; el worker la valida. */
function inverseOfScramble(tokens) {
  return [...tokens].reverse().map(t => {
    if (t.endsWith("2")) return t;
    return t.endsWith("'") ? t.slice(0, -1) : t + "'";
  });
}

let optimalAbort = null;   // { run }

function searchOptimalAsync(cube, candidate, onProgress) {

  return new Promise((resolve, reject) => {

    const handle = { run: null };

    try {

      handle.run = runOptimalParallel(
        cube.toJSON(),
        candidate,
        {
          onProgress,

          onDone: result => {
            if (optimalAbort === handle) optimalAbort = null;
            resolve(result);
          },

          onError: error => {
            if (optimalAbort === handle) optimalAbort = null;
            reject(error);
          }
        }
      );

    } catch (error) {

      reject(error);
      return;

    }

    optimalAbort = handle;

  });

}

async function searchOptimalFallback(cube, candidate, onProgress) {

  const { searchOptimal } = await import("./optimal.js");

  await new Promise(resolve => setTimeout(resolve, 50));

  return searchOptimal(
    cube.clone(),
    { timeMs: 3000, proofMs: 0, candidate, onProgress }
  );

}

async function computeOptimal(cube, mySolutions, candidate) {

  let found;

  const onProgress = p => {
    if (solutions === mySolutions) showOptimalProgress(p);
  };

  try {

    try {
      found = await searchOptimalAsync(cube, candidate, onProgress);
    } catch (error) {
      console.warn("Optimal: Worker no disponible, cerca al fil principal.", error);
      found = await searchOptimalFallback(cube, candidate, onProgress);
    }

    // Si l'usuari ha tornat a barrejar mentrestant, descartem el resultat.
    if (solutions !== mySolutions) return;

    const result = buildOptimalResult(cube, found.moves, found.info);

    mySolutions.optimal = result;

    const card = [...methodCards].find(c => c.dataset.method === "optimal");

    if (card) {
      card.disabled = false;
      card.classList.remove("disabled");
    }

    const n = result.moves.filter(m => !/^[xyz]/.test(m)).length;

    statusText.textContent =
      found.info.proven
        ? `Solució òptima demostrada: ${n} moviments.`
        : `Optimal: ${n} moviments (millor trobada, no demostrada com a òptima).`;

    statusDot.style.background = "#4ade80";

    showOptimalDone(n, found.info.proven, found.info.lowerBound);

  } catch (error) {

    console.error("Optimal:", error);

    if (solutions === mySolutions) {
      showOptimalFailed();
      statusText.textContent =
        "Solucions LBL i CFOP calculades. L'òptim no s'ha pogut calcular.";
    }

  }

}

solveBtn.addEventListener(
  "click",
  async () => {

    if (
      animating ||
      scrambleInProgress ||
      playing
    ) {

      return;

    }


    const result =
      validateScramble(
        scrambleInput.value
      );


    if (!result.valid) {

      statusText.textContent =
        result.message;

      statusDot.style.background =
        "#ef4444";

      return;

    }


    resetCameraOrientation();


    statusText.textContent =
      "Calculant les solucions...";

    statusDot.style.background =
      "#facc15";


    solveBtn.disabled = true;


    /*
      Construïm un cub matemàtic
      a partir de la barreja introduïda.

      IMPORTANT:

      No tornem a animar la barreja.

      Només reproduïm matemàticament
      els moviments sobre mathCube.
    */

    /*
      El cub 3D i el matemàtic es posen
      directament en l'estat de la barreja
      (sense animar), perquè la solució
      es pugui reproduir sobre el cub real.
    */

    prepareScrambledCube(
      result.tokens
    );


    /*
      Deixem que el navegador pinti "Calculant..."
      abans de començar els càlculs.
    */

    await new Promise(
      resolve => setTimeout(resolve, 50)
    );


    /*
      Cada mètode es calcula per separat
      sobre l'estat real del cub.
    */

    const computed = {};

    const solvers = [
      ["lbl", solveLBL],
      ["cfop", solveCFOP]
    ];

    for (const [key, solver] of solvers) {

      try {

        computed[key] =
          solver(mathCube);

      } catch (error) {

        console.error(
          `${METHOD_NAMES[key]}:`,
          error
        );

      }

    }


    const available =
      Object.keys(computed);


    if (available.length === 0) {

      statusText.textContent =
        "Error calculant les solucions.";

      statusDot.style.background =
        "#ef4444";

      solutionStatus.textContent =
        "Error";

      solveBtn.disabled =
        false;

      updateControls();

      return;

    }


    /*
      Solucions reals.
    */

    solutions =
      computed;

    solutionsCalculated =
      true;


    methodCards.forEach(
      card => {

        const ok =
          Boolean(
            computed[
              card.dataset.method
            ]
          );

        card.disabled =
          !ok;

        card.classList.toggle(
          "disabled",
          !ok
        );

      }
    );


    selectedMethod =
      available[0];


    methodCards.forEach(
      card => {

        card.classList.toggle(
          "selected",
          card.dataset.method ===
            selectedMethod
        );

      }
    );


    selectedMethodTitle.textContent =
      METHOD_NAMES[selectedMethod];


    const selectedResult =
      computed[selectedMethod];


    currentSolution =
      mathSequenceToVisual(
        selectedResult.moves
      );

    currentSolutionIndex =
      0;


    if (currentSolution.length > 0) {

      showSolution(selectedResult);

    } else {

      solutionSequence.textContent =
        "Ja està resolt.";

      setSolutionCount([]);

      moveElements = [];

    }


    solutionStatus.textContent =
      "Calculada";


    const failed =
      ["lbl", "cfop"].filter(
        key => !computed[key]
      );

    statusText.textContent =
      failed.length === 0
        ? "Solucions LBL i CFOP calculades."
        : `Solució ${METHOD_NAMES[selectedMethod]} calculada. ` +
          `No s'ha pogut calcular: ${failed.map(k => METHOD_NAMES[k]).join(", ")}.`;

    statusDot.style.background =
      failed.length === 0
        ? "#4ade80"
        : "#facc15";


    solveBtn.disabled =
      false;

    updateControls();


    /*
      L'òptim es calcula en segon pla; quan acabi
      s'activa la seva targeta.
    */

    if (failed.length === 0) {

      statusText.textContent =
        "Solucions LBL i CFOP calculades.";

    }

    showOptimalRunning();

    computeOptimal(mathCube.clone(), computed, inverseOfScramble(result.tokens));

  }
);


/* =========================================================
   CLICS DELS MÈTODES
========================================================= */

methodCards.forEach(
  card => {

    card.addEventListener(
      "click",

      () => {

        selectMethod(
          card.dataset.method
        );

      }

    );

  }
);


/* =========================================================
   RESIZE
========================================================= */

function resizeRenderer() {

  const width =
    cubeContainer.clientWidth;

  const height =
    cubeContainer.clientHeight;


  camera.aspect =
    width / height;

  camera.updateProjectionMatrix();


  renderer.setSize(
    width,
    height
  );

}


window.addEventListener(
  "resize",
  resizeRenderer
);


/* =========================================================
   RENDER
========================================================= */

function render() {

  requestAnimationFrame(
    render
  );


  controls.update();


  renderer.render(
    scene,
    camera
  );

}


/* =========================================================
   INICI
========================================================= */

resizeRenderer();

render();