/**
 * 1RM teorico: Epley e Brzycki.
 *
 * Os valores esperados sao contas feitas a mao a partir das formulas, nao
 * copias do que o codigo devolve.
 *   Epley:   1RM = peso x (1 + reps/30)
 *   Brzycki: 1RM = peso x 36 / (37 - reps)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { nucleo } from './nucleo.mjs';

const { epley, brzycki, estimar1RM, LIMITE_FIAVEL } = nucleo;
const perto = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) < tol,
  `esperava ${b}, veio ${a}`);

test('Epley: valores calculados a mao', () => {
  perto(epley(100, 5), 100 * (1 + 5 / 30));      // 116,666...
  perto(epley(100, 10), 100 * (1 + 10 / 30));    // 133,333...
  perto(epley(60, 12), 60 * (1 + 12 / 30));      // 84
  perto(epley(60, 12), 84);
  perto(epley(142.5, 3), 142.5 * 1.1);           // 156,75
});

test('Brzycki: valores calculados a mao', () => {
  perto(brzycki(100, 5), 100 * 36 / 32);         // 112,5
  perto(brzycki(100, 5), 112.5);
  perto(brzycki(100, 10), 100 * 36 / 27);        // 133,333...
  perto(brzycki(60, 12), 60 * 36 / 25);          // 86,4
  perto(brzycki(60, 12), 86.4);
});

test('com 1 repeticao o 1RM e o proprio peso, nas duas formulas', () => {
  // A Epley crua daria 100 x (1 + 1/30) = 103,33, o que transformaria
  // qualquer serie de 1 rep num falso recorde.
  assert.equal(epley(100, 1), 100);
  assert.equal(brzycki(100, 1), 100);
  assert.equal(epley(72.5, 1), 72.5);
});

test('Brzycki nao tem significado das 37 repeticoes para cima', () => {
  // O denominador (37 - reps) zera as 37 e fica negativo acima disso.
  assert.equal(brzycki(50, 37), null);
  assert.equal(brzycki(50, 40), null);
  assert.equal(brzycki(50, 100), null);
  // As 36 ainda devolve valor, embora absurdo — e o limite da formula.
  assert.ok(brzycki(50, 36) > 0);
  perto(brzycki(50, 36), 50 * 36 / 1);
});

test('Epley aguenta repeticoes altas (o historico tem series de 40)', () => {
  perto(epley(50, 40), 50 * (1 + 40 / 30));
  assert.ok(Number.isFinite(epley(0.5, 40)));
});

test('entradas invalidas devolvem null, nao NaN', () => {
  for (const f of [epley, brzycki]) {
    assert.equal(f(0, 10), null, 'peso zero');
    assert.equal(f(-20, 10), null, 'peso negativo');
    assert.equal(f(100, 0), null, 'zero repeticoes');
    assert.equal(f(100, -3), null, 'repeticoes negativas');
    assert.equal(f(null, 10), null);
    assert.equal(f(100, null), null);
    assert.equal(f(undefined, undefined), null);
    assert.equal(f('100', 10), null, 'texto nao conta como numero');
    assert.equal(f(NaN, 10), null);
    assert.equal(f(Infinity, 10), null);
  }
});

test('peso corporal (0 kg) nao gera 1RM nenhum', () => {
  // 2170 series do historico tem peso 0. Nao pode sair 0 nem NaN: sai null.
  assert.equal(epley(0, 15), null);
  assert.equal(estimar1RM(0, 15), null);
});

test('estimar1RM junta as duas e marca a fiabilidade', () => {
  const r = estimar1RM(100, 10);
  perto(r.epley, 133.33333333333331);
  perto(r.brzycki, 133.33333333333334);
  perto(r.media, (r.epley + r.brzycki) / 2);
  assert.equal(r.fiavel, true);

  const alto = estimar1RM(100, 20);
  assert.equal(alto.fiavel, false, 'acima de ' + LIMITE_FIAVEL + ' reps deixa de ser fiavel');
  assert.equal(estimar1RM(100, 15).fiavel, true, 'no limite ainda conta como fiavel');
});

test('estimar1RM sobrevive a Brzycki devolver null', () => {
  const r = estimar1RM(50, 40);
  assert.equal(r.brzycki, null);
  assert.ok(r.epley > 0);
  perto(r.media, r.epley, 1e-9);   // a media e so da que existe
});

test('as duas formulas coincidem exactamente as 10 repeticoes', () => {
  // 1 + 10/30 = 4/3 e 36/27 = 4/3. Serve de prova cruzada das duas contas.
  perto(epley(137, 10), brzycki(137, 10), 1e-9);
});
