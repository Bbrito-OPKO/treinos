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

const { ordemDaNovaSerie, ordemDoNovoExercicio } = nucleo;

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

/* A (ordemExercicio 0), B (1), C (2); depois tira-se B inteiro. */
function diaSemB() {
  return [
    { id: 1, exercicioId: 'A', ordemExercicio: 0, ordem: 0 },
    { id: 2, exercicioId: 'A', ordemExercicio: 0, ordem: 1 },
    { id: 5, exercicioId: 'C', ordemExercicio: 2, ordem: 4 },
    { id: 6, exercicioId: 'C', ordemExercicio: 2, ordem: 5 },
  ];
}
const blocos = (dia) => [...new Set(desenhar(dia).map((s) => s.exercicioId))];

test('exercicio novo depois de tirar um exercicio inteiro: fica em baixo', () => {
  const d = diaSemB();
  const nova = { id: 99, exercicioId: 'D', ordemExercicio: ordemDoNovoExercicio(d), ordem: ordemDaNovaSerie(d) };
  assert.deepEqual(blocos(d.concat(nova)), ['A', 'C', 'D']);
});

test('a contagem antiga de exercicios falhava (prova de que o teste apanha)', () => {
  const d = diaSemB();
  // a antiga: nº de exercicios diferentes = 2, igual ao de C; e ordem = nº de series = 4
  const nova = { id: 99, exercicioId: 'D', ordemExercicio: 2, ordem: 4 };
  assert.notDeepEqual(desenhar(d.concat(nova)).map((s) => s.id), [1, 2, 5, 6, 99]);
});

/* A conta que o copiarTreino faz, tal e qual. */
function copiar(jaLa, origem, desvioEx, desvioOrdem) {
  return jaLa.concat(origem.map((s, i) => ({ id: 100 + i, exercicioId: s.exercicioId,
    ordemExercicio: s.ordemExercicio + desvioEx, ordem: s.ordem + desvioOrdem })));
}
const origem = [
  { exercicioId: 'X', ordemExercicio: 0, ordem: 0 },
  { exercicioId: 'X', ordemExercicio: 0, ordem: 1 },
  { exercicioId: 'Y', ordemExercicio: 1, ordem: 2 },
];

test('copiar para um dia com buracos: o treino copiado vem todo em baixo, pela sua ordem', () => {
  const d = diaSemB();
  const lista = desenhar(copiar(d, origem, ordemDoNovoExercicio(d), ordemDaNovaSerie(d)));
  assert.deepEqual(lista.map((s) => s.id), [1, 2, 5, 6, 100, 101, 102]);
});

test('a copia antiga baralhava neste caso (prova de que o teste apanha)', () => {
  const d = diaSemB();
  const lista = desenhar(copiar(d, origem, new Set(d.map((s) => s.exercicioId)).size, d.length));
  assert.notDeepEqual(lista.map((s) => s.id), [1, 2, 5, 6, 100, 101, 102]);
});

test('ordemDoNovoExercicio: dia vazio da 0', () => {
  assert.equal(ordemDoNovoExercicio([]), 0);
});

test('exercicio novo com dois exercicios tirados do meio: fica em baixo', () => {
  // ficou A (0) e D (3); B e C foram tirados. Contar exercicios dava 2, entre A e D.
  const d = [
    { id: 1, exercicioId: 'A', ordemExercicio: 0, ordem: 0 },
    { id: 7, exercicioId: 'D', ordemExercicio: 3, ordem: 6 },
  ];
  const nova = { id: 99, exercicioId: 'E', ordemExercicio: ordemDoNovoExercicio(d), ordem: 0 };
  assert.deepEqual(blocos(d.concat(nova)), ['A', 'D', 'E']);
});
