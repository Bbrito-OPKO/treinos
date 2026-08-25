/**
 * Estimativa de carga por número de repetições — o contrário do 1RM.
 *
 * A prova que interessa é a ida e volta: estimar o peso para N repetições a
 * partir de um 1RM, e voltar a calcular o 1RM desse peso, tem de dar o mesmo
 * 1RM. Se as duas contas não fecharem, uma delas está errada.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { nucleo } from './nucleo.mjs';

const { estimarPesoParaReps, estimativasPorReps, epley, brzycki,
        curvaRepMax, LIMITE_FIAVEL } = nucleo;

const perto = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) < tol,
  `esperava ${b}, veio ${a}`);

let n = 0;
const serie = (data, peso, reps, exercicioId = 1) =>
  ({ id: ++n, exercicioId, data, peso, reps, ordemExercicio: 0, ordem: n });

test('ida e volta pela Epley: estimar e voltar a calcular dá o mesmo 1RM', () => {
  for (const reps of [2, 3, 5, 8, 10, 12, 15]) {
    const est = estimarPesoParaReps(150, reps);
    perto(epley(est.epley, reps), 150, 1e-9);
  }
});

test('ida e volta pela Brzycki: estimar e voltar a calcular dá o mesmo 1RM', () => {
  for (const reps of [2, 3, 5, 8, 10, 12, 15]) {
    const est = estimarPesoParaReps(150, reps);
    perto(brzycki(est.brzycki, reps), 150, 1e-9);
  }
});

test('com 1 repetição a estimativa é o próprio 1RM', () => {
  const e = estimarPesoParaReps(150, 1);
  assert.equal(e.epley, 150);
  assert.equal(e.brzycki, 150);
  assert.equal(e.media, 150);
});

test('valores calculados à mão', () => {
  // Epley: 150 / (1 + 10/30) = 112,5
  perto(estimarPesoParaReps(150, 10).epley, 112.5);
  // Brzycki: 150 x (37-10)/36 = 112,5
  perto(estimarPesoParaReps(150, 10).brzycki, 112.5);
  // Brzycki a 5: 150 x 32/36 = 133,333...
  perto(estimarPesoParaReps(150, 5).brzycki, 150 * 32 / 36);
});

test('a estimativa desce sempre quando as repetições sobem', () => {
  let anterior = Infinity;
  for (let r = 1; r <= 15; r++) {
    const e = estimarPesoParaReps(150, r);
    assert.ok(e.media < anterior, `a ${r} reps (${e.media}) devia pesar menos do que a ${r - 1}`);
    anterior = e.media;
  }
});

test('a Brzycki desaparece das 37 para cima, e a média fica só com a Epley', () => {
  const e = estimarPesoParaReps(150, 40);
  assert.equal(e.brzycki, null);
  assert.ok(e.epley > 0);
  perto(e.media, e.epley);
});

test('entradas inválidas devolvem null', () => {
  assert.equal(estimarPesoParaReps(0, 5), null);
  assert.equal(estimarPesoParaReps(-10, 5), null);
  assert.equal(estimarPesoParaReps(null, 5), null);
  assert.equal(estimarPesoParaReps(150, 0), null);
  assert.equal(estimarPesoParaReps(150, null), null);
  assert.equal(estimarPesoParaReps(NaN, 5), null);
});

/* ------------------------------------------------------- a tabela toda */

test('a tabela dá uma linha por repetição até ao limite', () => {
  const t = estimativasPorReps(150, null, 12);
  assert.equal(t.length, 12);
  assert.deepEqual(t.map(l => l.reps), [1,2,3,4,5,6,7,8,9,10,11,12]);
  assert.equal(t[0].estimativa, 150);
});

test('a tabela marca o que deixa de ser fiável', () => {
  const t = estimativasPorReps(150, null, 20);
  assert.equal(t.find(l => l.reps === LIMITE_FIAVEL).fiavel, true);
  assert.equal(t.find(l => l.reps === LIMITE_FIAVEL + 1).fiavel, false);
});

test('a folga é a diferença entre o que se estima e o que já se fez', () => {
  // Fez 100 kg a 10 reps. O 1RM estimado por Epley disso são 133,33.
  const curva = curvaRepMax([serie('2026-01-01', 100, 10)], 1);
  const t = estimativasPorReps(133.3333333, curva, 12);

  const dez = t.find(l => l.reps === 10);
  assert.equal(dez.feito, 100);
  perto(dez.folga, dez.estimativa - 100, 1e-6);

  // A 12 reps nunca fez nada: não há folga para calcular.
  const doze = t.find(l => l.reps === 12);
  assert.equal(doze.feito, null);
  assert.equal(doze.folga, null);
});

test('a folga aponta onde há margem', () => {
  // 1RM de 150. A 8 reps a estimativa anda pelos 117; se a marca feita for
  // 100, sobram uns 17 kg por explorar.
  const curva = curvaRepMax([serie('2026-01-01', 100, 8)], 1);
  const oito = estimativasPorReps(150, curva, 12).find(l => l.reps === 8);
  assert.ok(oito.folga > 10, 'folga de ' + oito.folga);
  assert.equal(oito.feito, 100);
});

test('sem 1RM não há tabela nenhuma', () => {
  assert.deepEqual(estimativasPorReps(null, null, 12), []);
  assert.deepEqual(estimativasPorReps(0, null, 12), []);
});
