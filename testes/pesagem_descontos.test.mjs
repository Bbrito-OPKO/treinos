/**
 * Descontos na pesagem (19/10/2026).
 *
 * O Bruno pesa-se de t-shirt. Calcas 0,5 kg, meias 0,1 kg e "ainda nao fiz
 * coco" 0,4 kg tiram-se ao peso da balanca. O exemplo e o dele: 84 com
 * calcas, meias e sem coco da 83.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { nucleo } from './nucleo.mjs';

const N = nucleo;

test('os tres descontos com os valores dele', () => {
  assert.deepEqual(N.DESCONTOS_PESAGEM.map(d => [d.id, d.kg]),
    [['calcas', 0.5], ['meias', 0.1], ['semCoco', 0.4]]);
});

test('84 com calcas, meias e sem coco da 83', () => {
  assert.equal(N.pesoEfetivo(84, ['calcas', 'meias', 'semCoco']), 83);
});

test('cada desconto sozinho', () => {
  assert.equal(N.pesoEfetivo(84, ['calcas']), 83.5);
  assert.equal(N.pesoEfetivo(84, ['meias']), 83.9);
  assert.equal(N.pesoEfetivo(84, ['semCoco']), 83.6);
  assert.equal(N.pesoEfetivo(84.3, ['calcas', 'meias']), 83.7);
});

test('sem nada marcado fica o da balanca', () => {
  assert.equal(N.pesoEfetivo(84.2, []), 84.2);
  assert.equal(N.pesoEfetivo(84.2), 84.2);
});

test('um id que nao existe nao tira nada', () => {
  assert.equal(N.pesoEfetivo(84, ['casaco']), 84);
});

test('guardar com descontos: kg efetivo, balanca e lista ficam', () => {
  const r = { id: 1, data: '2026-10-19' };
  N.guardarBruto(r, 84, ['calcas', 'meias', 'semCoco', 'casaco']);
  assert.deepEqual(r, { id: 1, data: '2026-10-19', kg: 83, bruto: 84, descontos: ['calcas', 'meias', 'semCoco'] });
});

test('guardar sem descontos apaga a balanca e a lista antigas', () => {
  const r = { id: 1, data: '2026-10-19', kg: 83, bruto: 84, descontos: ['calcas'] };
  N.guardarBruto(r, 83.4, []);
  assert.deepEqual(r, { id: 1, data: '2026-10-19', kg: 83.4 });
});

test('a media e a tendencia usam o peso efetivo', () => {
  const r = { id: 1, data: '2026-10-19' };
  N.guardarBruto(r, 84, ['calcas', 'meias', 'semCoco']);
  assert.equal(N.pesoMedio([r], '2026-10-19', 7), 83);
});
