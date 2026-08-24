/**
 * Recordes pessoais.
 *
 * O teste do fim e o mais importante de todo o projeto: compara a deteccao de
 * recordes com as 1187 series que o proprio FitNotes ja tinha marcado como
 * recorde de sempre (coluna ZISALLTIMERECORD da base do iPhone). E uma fonte
 * independente — nao um numero que eu tenha escrito a partir do meu proprio
 * resultado.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { nucleo } from './nucleo.mjs';
import { backup, ESPERADO, SEM_DADOS } from './dados.mjs';

const { detetarRecordes, melhoresPorExercicio } = nucleo;

// Ajuda a escrever series de teste sem ruido.
let n = 0;
const serie = (data, peso, reps, exercicioId = 1) =>
  ({ id: ++n, exercicioId, data, peso, reps, ordemExercicio: 0, ordem: n });

test('a primeira serie de um exercicio e sempre recorde', () => {
  const r = detetarRecordes([serie('2026-01-01', 100, 5)]);
  assert.equal(r.length, 1);
  assert.deepEqual(r[0].tipos.sort(), ['1rm', 'peso', 'reps']);
});

test('repetir a mesma serie nao e recorde nenhum', () => {
  const r = detetarRecordes([
    serie('2026-01-01', 100, 5),
    serie('2026-01-08', 100, 5)
  ]);
  assert.equal(r.length, 1, 'so a primeira conta');
});

test('mais peso com as mesmas reps e recorde', () => {
  const r = detetarRecordes([
    serie('2026-01-01', 100, 5),
    serie('2026-01-08', 102.5, 5)
  ]);
  assert.equal(r.length, 2);
  assert.ok(r[1].tipos.includes('peso'));
});

test('mais reps com o mesmo peso e recorde', () => {
  const r = detetarRecordes([
    serie('2026-01-01', 100, 5),
    serie('2026-01-08', 100, 8)
  ]);
  assert.equal(r.length, 2);
  assert.ok(r[1].tipos.includes('1rm'));
  assert.ok(!r[1].tipos.includes('peso'), 'o peso nao subiu');
});

test('menos peso com mais reps pode ser recorde para essas reps', () => {
  const r = detetarRecordes([
    serie('2026-01-01', 100, 5),
    serie('2026-01-08', 80, 12)
  ]);
  assert.equal(r.length, 2);
  assert.ok(r[1].tipos.includes('reps'));
});

test('uma serie dominada por outra anterior NAO e recorde', () => {
  // 100 kg x 10 domina 90 kg x 8: mais peso E mais reps. Logo a segunda nao
  // pode ser recorde de nada, mesmo sendo a primeira vez com 8 reps.
  const r = detetarRecordes([
    serie('2026-01-01', 100, 10),
    serie('2026-01-08', 90, 8)
  ]);
  assert.equal(r.length, 1);
});

test('exercicios diferentes nao se contaminam', () => {
  const r = detetarRecordes([
    serie('2026-01-01', 200, 10, 1),
    serie('2026-01-02', 50, 5, 2)
  ]);
  assert.equal(r.length, 2, 'cada exercicio tem os seus recordes');
});

test('a ordem dentro do dia conta', () => {
  // Duas series no mesmo dia: a mais pesada primeiro apaga a segunda.
  const a = { id: 1, exercicioId: 1, data: '2026-01-01', peso: 100, reps: 5, ordemExercicio: 0, ordem: 0 };
  const b = { id: 2, exercicioId: 1, data: '2026-01-01', peso: 90, reps: 5, ordemExercicio: 0, ordem: 1 };
  assert.equal(detetarRecordes([b, a]).length, 1, 'a lista vem desordenada de proposito');
  assert.equal(detetarRecordes([a, b])[0].serieId, 1);
});

test('series sem peso ou sem reps ficam de fora', () => {
  const r = detetarRecordes([
    { id: 1, exercicioId: 1, data: '2026-01-01', peso: null, reps: 5 },
    { id: 2, exercicioId: 1, data: '2026-01-01', peso: 100, reps: null },
    { id: 3, exercicioId: 1, data: '2026-01-01', peso: 100, reps: 0 },
    serie('2026-01-02', 100, 5)
  ]);
  assert.equal(r.length, 1);
});

test('peso corporal (0 kg) tambem tem recordes, pelas reps', () => {
  const r = detetarRecordes([
    serie('2026-01-01', 0, 10),
    serie('2026-01-08', 0, 15)
  ]);
  assert.equal(r.length, 2, '15 flexoes batem 10 flexoes');
});

test('melhoresPorExercicio devolve a melhor marca de sempre', () => {
  const m = melhoresPorExercicio([
    serie('2026-01-01', 100, 5),
    serie('2026-01-08', 90, 12),
    serie('2026-01-15', 105, 3)
  ]);
  assert.equal(m[1].pesoMax, 105);
  assert.equal(m[1].totalSeries, 3);
  assert.equal(m[1].ultima, '2026-01-15');
  assert.equal(m[1].melhorVolumeSerie, 90 * 12);
});

/* --------------------------------------------- contra o historico real */

test('historico real: bate exactamente os recordes marcados pelo FitNotes', SEM_DADOS, () => {
  const b = backup();
  const marcadasPelaApp = new Set(b.series.filter(s => s.recordeOriginal).map(s => s.id));
  assert.equal(marcadasPelaApp.size, ESPERADO.recordesMarcadosPelaApp,
    'a base tem de trazer 1187 series marcadas');

  const meus = new Set(detetarRecordes(b.series).map(r => r.serieId));

  const aMais = [...meus].filter(id => !marcadasPelaApp.has(id));
  const aMenos = [...marcadasPelaApp].filter(id => !meus.has(id));

  assert.equal(aMais.length, 0, aMais.length + ' series marcadas a mais');
  assert.equal(aMenos.length, 0, aMenos.length + ' recordes por apanhar');
  assert.equal(meus.size, ESPERADO.recordesMarcadosPelaApp);
});

test('historico real: 28.747 series passam pela deteccao sem rebentar', SEM_DADOS, () => {
  const b = backup();
  const r = detetarRecordes(b.series);
  assert.ok(r.every(x => Number.isFinite(x.serieId) && x.tipos.length > 0));
  const m = melhoresPorExercicio(b.series);
  assert.equal(Object.keys(m).length, 125,
    '125 dos 131 exercicios tem series com peso e reps; os outros 6 sao de ' +
    'cardio ou de tempo (prancha), que nao entram nesta conta');
});
