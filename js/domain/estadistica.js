// Caso Forestal · estadística para comparar inicio contra cierre.
// Validada contra SciPy (tests/estadistica.test.mjs). Sin dependencias.

export const suma = xs => xs.reduce((a, b) => a + b, 0);
export const media = xs => xs.length ? suma(xs) / xs.length : null;
export function desviacion(xs) { // muestral (n − 1)
  if (xs.length < 2) return null;
  const m = media(xs);
  return Math.sqrt(suma(xs.map(x => (x - m) ** 2)) / (xs.length - 1));
}
export function mediana(xs) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const k = Math.floor(s.length / 2);
  return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2;
}

// erfc con error relativo < 1,2e-7 (Numerical Recipes, erfcc).
function erfc(x) {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
    t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 +
    t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}
export const normalCdf = z => 0.5 * erfc(-z / Math.SQRT2);

// Rangos promedio (empates comparten el rango medio).
export function rangos(xs) {
  const idx = xs.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]);
  const r = new Array(xs.length);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const prom = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[idx[k][1]] = prom;
    i = j + 1;
  }
  return r;
}

// Prueba de rangos con signo de Wilcoxon para muestras pareadas.
// antes[i] y despues[i] son de la misma persona. Las diferencias cero se
// descartan (método de Wilcoxon). Entrega:
//  - p: aproximación normal con corrección por empates y por continuidad
//    (lo mismo que R wilcox.test(paired = TRUE) cuando hay empates o ceros);
//  - pExacto: distribución exacta de permutación de los signos, válida con
//    empates (se calcula hasta 200 pares con diferencia);
//  - rb: correlación biserial de rangos para pares, (W+ − W−)/(W+ + W−).
export function wilcoxonPareado(antes, despues) {
  const d = [];
  for (let i = 0; i < antes.length; i++) {
    const a = antes[i], b = despues[i];
    if (Number.isFinite(a) && Number.isFinite(b)) d.push(b - a);
  }
  const pares = d.length;
  const dn = d.filter(x => x !== 0);
  const n = dn.length;
  const base = { pares, n, ceros: pares - n, mediaDif: media(d), medianaDif: mediana(d) };
  if (!n) return { ...base, wMas: 0, wMenos: 0, z: null, p: null, pExacto: null, rb: null };
  const r = rangos(dn.map(Math.abs));
  let wMas = 0, wMenos = 0;
  dn.forEach((x, i) => { if (x > 0) wMas += r[i]; else wMenos += r[i]; });
  const mu = n * (n + 1) / 4;
  // Corrección por empates: Σ(t³ − t)/48
  const cuenta = new Map();
  r.forEach(x => cuenta.set(x, (cuenta.get(x) || 0) + 1));
  let emp = 0;
  cuenta.forEach(t => { emp += t ** 3 - t; });
  const sigma = Math.sqrt(n * (n + 1) * (2 * n + 1) / 24 - emp / 48);
  let z = null, p = null;
  if (sigma > 0) {
    const dif = wMas - mu;
    z = (dif - Math.sign(dif) * 0.5) / sigma;
    p = Math.min(1, 2 * (1 - normalCdf(Math.abs(z))));
  }
  // Exacta: cada rango (×2, para que sea entero) suma o no a W+.
  let pExacto = null;
  if (n <= 200) {
    const pesos = r.map(x => Math.round(x * 2));
    const total = suma(pesos);
    let dist = new Float64Array(total + 1);
    dist[0] = 1;
    let alcance = 0;
    for (const w of pesos) {
      const sig = new Float64Array(total + 1);
      for (let s = 0; s <= alcance; s++) {
        if (!dist[s]) continue;
        sig[s] += dist[s] / 2;
        sig[s + w] += dist[s] / 2;
      }
      alcance += w;
      dist = sig;
    }
    const obs = Math.round(Math.min(wMas, wMenos) * 2);
    let cola = 0;
    for (let s = 0; s <= obs; s++) cola += dist[s];
    pExacto = Math.min(1, 2 * cola);
  }
  return { ...base, wMas, wMenos, z, p, pExacto, rb: (wMas - wMenos) / (wMas + wMenos) };
}

// log(n!) por suma directa (n pequeños: tamaño de un curso).
function lnFact(n) { let s = 0; for (let i = 2; i <= n; i++) s += Math.log(i); return s; }
const binomPmf = (k, n) => Math.exp(lnFact(n) - lnFact(k) - lnFact(n - k) - n * Math.LN2);

// Prueba de McNemar exacta (binomial, dos colas) para proporciones pareadas.
// b = pasaron de incorrecto a correcto; c = de correcto a incorrecto.
export function mcnemarExacto(b, c) {
  const n = b + c;
  if (!n) return { b, c, n, p: null };
  const k = Math.min(b, c);
  let cola = 0;
  for (let i = 0; i <= k; i++) cola += binomPmf(i, n);
  return { b, c, n, p: Math.min(1, 2 * cola) };
}

// Ajuste de Holm para comparaciones múltiples. Los null se conservan.
export function holm(ps) {
  const idx = ps.map((p, i) => [p, i]).filter(x => x[0] !== null && x[0] !== undefined).sort((a, b) => a[0] - b[0]);
  const m = idx.length;
  const out = ps.map(() => null);
  let previo = 0;
  idx.forEach(([p, i], k) => {
    previo = Math.max(previo, Math.min(1, (m - k) * p));
    out[i] = previo;
  });
  return out;
}

// Cuenta de cada valor de la escala: [n1, n2, …]
export const distribucion = (xs, valores) => valores.map(v => xs.filter(x => x === v).length);
