/**
 * Uma serie acrescentada com o + aparece em baixo, no fim do seu exercicio.
 *
 * O caso que falhava: tirar series deixa buracos na numeracao, e a ordem
 * antiga (contar as series do dia) dava a serie nova um numero que ja estava
 * ocupado mais acima. Ela caia no meio do exercicio.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { nucleo } from './nucleo.mjs';

const { ordemDaNovaSerie } = nucleo;

/* A ordem por que a app desenha o dia. */
const desenhar = (dia) => dia.slice()
  .sort((a, b) => (a.ordemExercicio - b.ordemExercicio) || (a.ordem - b.ordem));

/* A com 4 series (ordem 0-3), B com 2 (ordem 4-5). */
function dia() {
  return [0, 1, 2, 3].map((o) => ({ id: o + 1, exercicioId: 'A', ordemExercicio: 0, ordem: o }))
    .concat([4, 5].map((o) => ({ id: o + 1, exercicioId: 'B', ordemExercicio: 1, ordem: o })));
}

function acrescentar(d, exercicioId, ordem) {
  const deste = d.filter((s) => s.exercicioId === exercicioId);
  return d.concat({ id: 99, exercicioId, ordemExercicio: deste[0].ordemExercicio, ordem });
}

test('dia sem buracos: a nova fica em baixo', () => {
  const d = dia();
  const lista = desenhar(acrescentar(d, 'B', ordemDaNovaSerie(d)));
  assert.equal(lista[lista.length - 1].id, 99);
});

test('depois de tirar 2 series de A, a nova de B fica em baixo', () => {
  const d = dia().filter((s) => s.id !== 3 && s.id !== 4); // tira as 2 ultimas de A
  const lista = desenhar(acrescentar(d, 'B', ordemDaNovaSerie(d)));
  assert.deepEqual(lista.filter((s) => s.exercicioId === 'B').map((s) => s.id), [5, 6, 99]);
});

test('a contagem antiga falhava neste caso (prova de que o teste apanha)', () => {
  const d = dia().filter((s) => s.id !== 3 && s.id !== 4);
  const lista = desenhar(acrescentar(d, 'B', d.length));
  assert.notDeepEqual(lista.filter((s) => s.exercicioId === 'B').map((s) => s.id), [5, 6, 99]);
});

test('primeira serie de um exercicio no fim de A continua dentro de A e em baixo', () => {
  const d = dia().filter((s) => s.id !== 2);
  const lista = desenhar(acrescentar(d, 'A', ordemDaNovaSerie(d)));
  assert.deepEqual(lista.filter((s) => s.exercicioId === 'A').map((s) => s.id), [1, 3, 4, 99]);
});

test('dia vazio ou ordens em falta: comeca em 0', () => {
  assert.equal(ordemDaNovaSerie([]), 0);
  assert.equal(ordemDaNovaSerie([{ ordem: null }, { ordem: 2 }]), 3);
});
