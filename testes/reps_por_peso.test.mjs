/**
 * Curva inversa: reps maximas por peso.
 *
 * O espelho da curva de cargas maximas (recordes.test.mjs / curvaRepMax): em
 * vez de "qual o peso maximo para N reps", aqui a pergunta e "quantas reps
 * ja se fez com este peso OU MAIS". Mesmo exemplo real do Leg Extension usado
 * na curva direta (111,5 kg a 10 reps e 109 kg a 8), so que lido ao contrario.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { nucleo } from './nucleo.mjs';

const { curvaRepsPorPeso, melhorRepsParaPeso, serieFeita } = nucleo;

let n = 0;
const serie = (data, peso, reps, exercicioId = 1) =>
  ({ id: ++n, exercicioId, data, peso, reps, ordemExercicio: 0, ordem: n });

test('reps por peso: um peso mais leve herda as reps de um peso mais pesado', () => {
  // Quem fez 111,5 kg a 10 reps tambem "fez" 109 kg a 10 reps pelo caminho -
  // por isso a marca aos 109 kg (que so tem 8 reps registadas a esse peso
  // exato) tem de ser 10, nao 8.
  const curva = curvaRepsPorPeso([
    serie('2026-01-01', 111.5, 10),
    serie('2026-01-08', 109, 8)
  ], 1);
  assert.equal(melhorRepsParaPeso(curva, 109), 10);
  assert.equal(melhorRepsParaPeso(curva, 111.5), 10);
});

test('reps por peso: pesos nunca antes levantados sobem ao peso mais leve seguinte', () => {
  const curva = curvaRepsPorPeso([serie('2026-01-01', 100, 5)], 1);
  // 90 kg nunca foi feito, mas 100 kg (mais pesado) ja foi a 5 - logo 90 kg
  // "ja" tem 5 reps, porque quem levanta 100 kg tambem levanta 90 kg.
  assert.equal(melhorRepsParaPeso(curva, 90), 5);
});

test('reps por peso: pedir mais peso do que alguma vez se levantou devolve null', () => {
  const curva = curvaRepsPorPeso([serie('2026-01-01', 100, 5)], 1);
  assert.equal(melhorRepsParaPeso(curva, 120), null);
});

test('reps por peso: a curva nunca desce quando o peso desce', () => {
  const curva = curvaRepsPorPeso([
    serie('2026-01-01', 140, 3),
    serie('2026-01-08', 120, 8),
    serie('2026-01-15', 100, 15)
  ], 1);
  for (let i = 1; i < curva.pesos.length; i++) {
    assert.ok(curva.reps[i] <= curva.reps[i - 1],
      'reps a ' + curva.pesos[i] + ' kg (mais pesado) nao pode ser maior que a ' +
      curva.pesos[i - 1] + ' kg (mais leve)');
  }
});

test('reps por peso: series por fazer e de outros exercicios ficam de fora', () => {
  const series = [
    serie('2026-01-01', 100, 5),
    { ...serie('2026-01-08', 150, 20), feita: false },
    serie('2026-01-08', 100, 3, 2)   // outro exercicio
  ];
  const curva = curvaRepsPorPeso(series, 1);
  assert.equal(melhorRepsParaPeso(curva, 100), 5);
  assert.equal(melhorRepsParaPeso(curva, 150), null);
});

test('reps por peso: sem series devolve curva vazia e null em qualquer pedido', () => {
  const curva = curvaRepsPorPeso([], 1);
  assert.equal(melhorRepsParaPeso(curva, 50), null);
});
