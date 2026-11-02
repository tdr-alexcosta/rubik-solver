/*
  Estimació del temps que falta per demostrar l'òptim.

  La cerca va per longituds creixents i cada longitud costa uns 14 cops
  més que l'anterior. A partir del que ja s'ha trigat en la longitud actual
  (tasques fetes / tasques totals) s'estima el que falta d'aquesta i de les
  següents fins a la millor solució trobada.

  És una estimació màxima: si existeix una solució més curta que la millor
  trobada, la cerca acabarà abans.
*/

const DEFAULT_RATIO = 14;

export function createEtaEstimator() {
  let lastLower = null;
  let levelStart = 0;
  const durations = {};     // longitud -> ms que va costar

  function ratio() {
    const levels = Object.keys(durations).map(Number).sort((a, b) => a - b);
    const n = levels.length;

    if (n >= 2) {
      const a = durations[levels[n - 2]];
      const b = durations[levels[n - 1]];

      // Només és fiable si les dues longituds han tardat prou.
      if (a > 2000 && b > 2000) return Math.min(25, Math.max(6, b / a));
    }

    return DEFAULT_RATIO;
  }

  /*
    p: { lower, length, done, total }
    Retorna els segons que falten o null si encara no es pot estimar.
  */
  function update(p, now) {
    if (p.lower === undefined || !p.total) return null;

    if (lastLower !== p.lower) {
      if (lastLower !== null) durations[lastLower] = now - levelStart;
      lastLower = p.lower;
      levelStart = now;
    }

    const elapsed = now - levelStart;
    const r = ratio();

    let levelTotal = null;

    // Amb menys de 2 s mesurats l'extrapolació és massa sorollosa.
    if (p.done >= Math.max(3, Math.ceil(p.total * 0.03)) && elapsed >= 2000) {
      levelTotal = (elapsed * p.total) / p.done;
    } else if (durations[p.lower - 1] > 2000) {
      levelTotal = durations[p.lower - 1] * r;
    }

    if (levelTotal === null) return null;

    let remaining = Math.max(0, levelTotal - elapsed);

    // Longituds posteriors fins a (millor trobada - 1).
    for (let k = 1; p.lower + k <= p.length - 1; k++) {
      remaining += levelTotal * Math.pow(r, k);
    }

    return remaining / 1000;
  }

  return { update };
}

export function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return "més de 1 any";

  const s = Math.round(seconds);

  if (s < 5) return "uns segons";
  if (s < 60) return `${s} s`;
  const totalMin = Math.round(s / 60);

  if (totalMin < 60) return `${totalMin} min`;

  if (s < 86400) {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return m === 0 ? `${h} h` : `${h} h ${m} min`;
  }

  const d = s / 86400;

  if (d < 30) return `${d < 10 ? d.toFixed(1) : Math.round(d)} dies`;

  return "més d'un mes";
}
