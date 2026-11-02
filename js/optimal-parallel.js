/*
  Coordinador de la cerca òptima repartida entre diversos Workers.

  1. El Worker 0 troba una solució ràpida (cota superior U) mentre
     tots construeixen la taula de cantonades.
  2. Per a cada longitud L = h0, h0+1, ... (< U) es reparteix el
     treball en prefixos de 2 girs. Si cap prefix té solució de
     longitud L, l'òptim és > L. La primera L amb solució és l'òptima.
  3. Si s'arriba a U-1 sense solució, U és l'òptim.
*/

import { exactPrefixes } from "./optimal.js";

/*
  Workers reutilitzables entre resolucions: la taula de cantonades
  (uns 10 s de construir) només es fa la primera vegada.
  Un Worker ocupat no es pot interrompre: en aquest cas es destrueix.
*/
const POOL = [];

function acquireWorker() {
  const w = POOL.pop();

  if (w) return w;

  return new Worker(new URL("./optimal-worker.js", import.meta.url), { type: "module" });
}

export function runOptimalParallel(cubeJSON, candidate, callbacks) {
  const { onProgress, onDone, onError } = callbacks;

  const cores = (typeof navigator !== "undefined" && navigator.hardwareConcurrency) || 2;
  const N = Math.max(1, Math.min(8, cores - 1));

  const prefixes = exactPrefixes();
  const t0 = performance.now();

  const workers = [];
  const busy = new Set();

  let finished = false;
  let upper = null;           // { moves, length }
  let bestSoFar = null;       // últim progrés de la cerca ràpida
  let ready = 0;
  let h0 = 0;
  let started = false;

  let limit = 0;
  let queue = [];
  let total = 0;
  let done = 0;
  let taskCounter = 0;
  let lower = 0;

  function killAll() {
    for (const w of workers) {
      w.onmessage = null;
      w.onerror = null;

      if (busy.has(w)) {
        w.terminate();
      } else {
        POOL.push(w);
      }
    }

    busy.clear();
  }

  function finish(moves, proven, lowerBound) {
    if (finished) return;
    finished = true;
    killAll();

    onDone({
      moves,
      info: {
        length: moves.length,
        proven,
        lowerBound,
        timeMs: Math.round(performance.now() - t0)
      }
    });
  }

  function fail(error) {
    if (finished) return;
    finished = true;
    killAll();
    onError(error instanceof Error ? error : new Error(String(error)));
  }

  function beginLevel() {
    if (limit > upper.length - 1) {
      finish(upper.moves, true, upper.length);
      return;
    }

    lower = limit;
    queue = limit >= 3 ? prefixes.map(p => p.slice()) : [[]];
    total = queue.length;
    done = 0;

    onProgress({
      lower,
      length: upper.length,
      moves: upper.moves,
      done,
      total,
      workers: N
    });

    dispatch();
  }

  function dispatch() {
    for (const w of workers) {
      if (busy.has(w) || queue.length === 0) continue;

      busy.add(w);

      w.postMessage({
        type: "task",
        taskId: ++taskCounter,
        limit,
        prefix: queue.pop()
      });
    }
  }

  function maybeStart() {
    if (started || ready < N || !upper) return;

    started = true;
    limit = h0;
    beginLevel();
  }

  function onMessage(w, d) {
    if (finished) return;

    switch (d.type) {
      case "progress":
        bestSoFar = d.progress;
        if (!upper) onProgress(d.progress);
        break;

      case "upper":
        upper = { moves: d.moves, length: d.length };
        if (d.length === 0) {
          finish([], true, 0);
          return;
        }
        maybeStart();
        break;

      case "ready":
        ready++;
        h0 = d.h0;
        maybeStart();
        break;

      case "result":
        busy.delete(w);

        if (d.moves) {
          // Totes les longituds < limit estan descartades: és l'òptima.
          finish(d.moves, true, d.moves.length);
          return;
        }

        done++;

        onProgress({
          lower,
          length: upper.length,
          moves: upper.moves,
          done,
          total,
          workers: N
        });

        if (queue.length === 0 && busy.size === 0) {
          limit++;
          beginLevel();
        } else {
          dispatch();
        }
        break;

      case "error":
        fail(new Error(d.message));
        break;
    }
  }

  try {
    for (let i = 0; i < N; i++) {
      const w = acquireWorker();

      w.onmessage = e => onMessage(w, e.data);
      w.onerror = e => fail(new Error(e.message || "Error del Worker"));

      workers.push(w);

      w.postMessage({ type: "init", cube: cubeJSON, candidate, role: i, timeMs: 4000 });
    }
  } catch (error) {
    killAll();
    throw error;
  }

  return {
    workers: N,

    // Atura la cerca i es queda amb la millor solució trobada fins ara.
    stop() {
      if (finished) return false;

      const best = upper || bestSoFar;

      if (!best || !best.moves) return false;

      finish(best.moves, false, lower);
      return true;
    },

    // Cancel·la sense cridar cap callback (nova barreja).
    terminate() {
      finished = true;
      killAll();
    }
  };
}
