/*
  Worker de la cerca òptima. Missatges:
    { type:"init", cube, candidate, role, timeMs }
        role 0: cerca de dues fases (cota superior) i després prepara la taula.
        la resta: només prepara la taula.
    { type:"task", taskId, limit, prefix }
        explora el subarbre del prefix fins a la longitud `limit`.
*/

import { Cube } from "./cube.js";
import { upperBound, prepareExact, OPTIMAL_MOVE_NAMES } from "./optimal.js";

let exact = null;

self.onmessage = event => {
  const d = event.data;

  try {
    if (d.type === "init") {
      const cube = new Cube().copyFrom(d.cube);

      if (d.role === 0) {
        const ub = upperBound(cube, {
          candidate: d.candidate,
          timeMs: d.timeMs,
          onProgress: progress => self.postMessage({ type: "progress", progress })
        });

        self.postMessage({ type: "upper", moves: ub.moves, length: ub.length });

        if (ub.length === 0) return;
      }

      exact = prepareExact(cube);
      self.postMessage({ type: "ready", h0: exact.h0 });
      return;
    }

    if (d.type === "task") {
      const r = exact.run(d.limit, d.prefix);

      self.postMessage({
        type: "result",
        taskId: d.taskId,
        moves: r.moves ? r.moves.map(i => OPTIMAL_MOVE_NAMES[i]) : null
      });
    }
  } catch (error) {
    self.postMessage({ type: "error", message: String((error && error.message) || error) });
  }
};
