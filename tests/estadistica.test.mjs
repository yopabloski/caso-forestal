// Valida js/domain/estadistica.js contra SciPy 1.18 (tests/fixtures/estadistica_ref_scipy.json).
// p asintótico: scipy.stats.wilcoxon(zero_method='wilcox', correction=True, method='approx').
// p exacto con empates: enumeración completa de los signos (n ≤ 14).
// McNemar exacto: scipy.stats.binomtest(min(b, c), b + c, 0.5).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { wilcoxonPareado, mcnemarExacto, holm, normalCdf, rangos, media, desviacion, mediana } from '../js/domain/estadistica.js';

const ref = JSON.parse(fs.readFileSync(new URL('./fixtures/estadistica_ref_scipy.json', import.meta.url), 'utf8'));
const cerca = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

test('normalCdf coincide con SciPy', () => {
  for (const { z, cdf } of ref.normal) cerca(normalCdf(z), cdf, 2e-7, `Φ(${z})`);
});

test('Wilcoxon pareado: estadísticos y p asintótico', () => {
  assert.ok(ref.wilcoxon.length >= 15);
  for (const c of ref.wilcoxon) {
    const r = wilcoxonPareado(c.antes, c.despues);
    assert.equal(r.n, c.n);
    cerca(r.wMas, c.wMas, 1e-9, 'W+');
    cerca(r.wMenos, c.wMenos, 1e-9, 'W−');
    cerca(r.p, c.p, 5e-7, 'p');
  }
});

test('Wilcoxon pareado: p exacto con empates y sin empates', () => {
  let n = 0;
  for (const c of ref.wilcoxon) {
    if (c.pExacto === null) continue;
    n++;
    cerca(wilcoxonPareado(c.antes, c.despues).pExacto, c.pExacto, 1e-12, 'p exacto');
  }
  assert.ok(n >= 6);
  cerca(wilcoxonPareado(ref.sinEmpates.antes, ref.sinEmpates.despues).pExacto, ref.sinEmpates.pExacto, 1e-12, 'p exacto sin empates');
});

test('Wilcoxon: casos borde', () => {
  const r = wilcoxonPareado([3, 4, 5], [3, 4, 5]);
  assert.equal(r.n, 0); assert.equal(r.p, null); assert.equal(r.pares, 3);
  const s = wilcoxonPareado([1, 2, null, 4], [2, 3, 5, undefined]);
  assert.equal(s.pares, 2);
  assert.equal(wilcoxonPareado([1, 1, 1, 1, 1], [2, 2, 2, 2, 2]).rb, 1);
});

test('McNemar exacto', () => {
  for (const c of ref.mcnemar) cerca(mcnemarExacto(c.b, c.c).p, c.p, 1e-12, `McNemar ${c.b},${c.c}`);
  assert.equal(mcnemarExacto(0, 0).p, null);
});

test('Holm', () => {
  const a = holm(ref.holm.p);
  ref.holm.ajustado.forEach((v, i) => cerca(a[i], v, 1e-12, 'Holm'));
  assert.deepEqual(holm([0.01, null, 0.04]), [0.02, null, 0.04]);
});

test('descriptivos y rangos', () => {
  assert.deepEqual(rangos([10, 20, 10, 30]), [1.5, 3, 1.5, 4]);
  assert.equal(media([1, 2, 3, 4]), 2.5);
  cerca(desviacion([1, 2, 3, 4]), 1.2909944487358056, 1e-12, 'DE');
  assert.equal(mediana([5, 1, 3]), 3);
  assert.equal(media([]), null);
});
