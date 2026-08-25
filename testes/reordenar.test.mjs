/**
 * Trocar a ordem dos exercicios dentro de um dia.
 *
 * O que importa provar: a ordem visivel muda, as duas numeracoes ficam
 * coerentes (ordemExercicio nos blocos, ordem nas series), nenhuma serie se
 * perde e nas pontas nao acontece nada.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { nucleo } from './nucleo.mjs';

const { reordenarExercicios } = nucleo;

/* Um dia com tres exercicios: A com 2 series, B com 3, C com 1. */
function diaExemplo() {
  return [
    { id: 1, exercicioId: 'A', ordemExercicio: 0, ordem: 0 },
    { id: 2, exercicioId: 'A', ordemExercicio: 0, ordem: 1 },
    { id: 3, exercicioId: 'B', ordemExercicio: 1, ordem: 2 },
    { id: 4, exercicioId: 'B', ordemExercicio: 1, ordem: 3 },
    { id: 5, exercicioId: 'B', ordemExercicio: 1, ordem: 4 },
    { id: 6, exercicioId: 'C', ordemExercicio: 2, ordem: 5 },
  ];
}

/* A ordem por que a app desenha o dia. */
function ordemVisivel(series) {
  const vistos = [];
  series.slice()
    .sort((a, b) => (a.ordemExercicio - b.ordemExercicio) || (a.ordem - b.ordem))
    .forEach((s) => { if (!vistos.includes(s.exercicioId)) vistos.push(s.exercicioId); });
  return vistos;
}

test('descer troca com o de baixo', () => {
  const dia = diaExemplo();
  reordenarExercicios(dia, 'A', 1);
  assert.deepEqual(ordemVisivel(dia), ['B', 'A', 'C']);
});

test('subir troca com o de cima', () => {
  const dia = diaExemplo();
  reordenarExercicios(dia, 'C', -1);
  assert.deepEqual(ordemVisivel(dia), ['A', 'C', 'B']);
});

test('subir o primeiro nao faz nada', () => {
  const dia = diaExemplo();
  const mexidas = reordenarExercicios(dia, 'A', -1);
  assert.equal(mexidas.length, 0);
  assert.deepEqual(ordemVisivel(dia), ['A', 'B', 'C']);
});

test('descer o ultimo nao faz nada', () => {
  const dia = diaExemplo();
  const mexidas = reordenarExercicios(dia, 'C', 1);
  assert.equal(mexidas.length, 0);
  assert.deepEqual(ordemVisivel(dia), ['A', 'B', 'C']);
});

test('exercicio que nao esta no dia nao faz nada', () => {
  const dia = diaExemplo();
  const mexidas = reordenarExercicios(dia, 'Z', 1);
  assert.equal(mexidas.length, 0);
  assert.deepEqual(ordemVisivel(dia), ['A', 'B', 'C']);
});

test('as series de cada exercicio ficam juntas e pela mesma ordem', () => {
  const dia = diaExemplo();
  reordenarExercicios(dia, 'A', 1);
  const doB = dia.filter((s) => s.exercicioId === 'B')
    .sort((a, b) => a.ordem - b.ordem);
  // B passou para primeiro: as tres series dele ficam nas posicoes 0, 1 e 2
  assert.deepEqual(doB.map((s) => s.ordem), [0, 1, 2]);
  assert.deepEqual(doB.map((s) => s.id), [3, 4, 5]);
  assert.ok(doB.every((s) => s.ordemExercicio === 0));
});

test("'ordem' fica sem buracos nem repetidos", () => {
  const dia = diaExemplo();
  reordenarExercicios(dia, 'B', 1);
  const ordens = dia.map((s) => s.ordem).sort((a, b) => a - b);
  assert.deepEqual(ordens, [0, 1, 2, 3, 4, 5]);
});

test('nenhuma serie se perde nem se duplica', () => {
  const dia = diaExemplo();
  reordenarExercicios(dia, 'A', 1);
  reordenarExercicios(dia, 'C', -1);
  const ids = dia.map((s) => s.id).sort((a, b) => a - b);
  assert.deepEqual(ids, [1, 2, 3, 4, 5, 6]);
});

test('mover e voltar deixa tudo como estava', () => {
  const dia = diaExemplo();
  const antes = JSON.stringify(dia);
  reordenarExercicios(dia, 'A', 1);
  reordenarExercicios(dia, 'A', -1);
  assert.equal(JSON.stringify(dia), antes);
});

test('so devolve as series que mudaram mesmo', () => {
  const dia = diaExemplo();
  // trocar B com C nao mexe em A, que fica no sitio
  const mexidas = reordenarExercicios(dia, 'B', 1);
  assert.ok(!mexidas.some((s) => s.exercicioId === 'A'),
    'A nao devia estar nas alteradas');
  assert.equal(mexidas.length, 4);   // as 3 de B e a 1 de C
});

test('aguenta series sem os campos preenchidos', () => {
  const dia = [
    { id: 1, exercicioId: 'A' },
    { id: 2, exercicioId: 'B' },
  ];
  reordenarExercicios(dia, 'B', -1);
  assert.deepEqual(ordemVisivel(dia), ['B', 'A']);
  assert.deepEqual(dia.map((s) => s.ordem).sort(), [0, 1]);
});
