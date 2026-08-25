/**
 * Períodos, intervalos de datas, e a evolução da carga máxima para um dado
 * número de repetições. É o que faz as Análises poderem ser filtradas.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { nucleo } from './nucleo.mjs';
import { backup, SEM_DADOS } from './dados.mjs';

const { recuarDias, PERIODOS, intervaloDoPeriodo, filtrarPorIntervalo,
        pesoPorDiaParaReps } = nucleo;

let n = 0;
const serie = (data, peso, reps, exercicioId = 1) =>
  ({ id: ++n, exercicioId, data, peso, reps, ordemExercicio: 0, ordem: n });

/* ------------------------------------------------------------- recuar */

test('recuar dias atravessa meses e anos', () => {
  assert.equal(recuarDias('2026-08-25', 0), '2026-08-25');
  assert.equal(recuarDias('2026-08-25', 28), '2026-07-28');
  assert.equal(recuarDias('2026-03-05', 10), '2026-02-23');
  assert.equal(recuarDias('2026-01-05', 10), '2025-12-26');
  assert.equal(recuarDias('2026-01-01', 365), '2025-01-01');
});

test('recuar dias não é apanhado pela mudança da hora', () => {
  // Em Portugal a hora muda no último domingo de março e de outubro. Com
  // contas em hora local isto podia dar um dia a menos.
  assert.equal(recuarDias('2026-03-31', 3), '2026-03-28');
  assert.equal(recuarDias('2026-10-27', 3), '2026-10-24');
});

test('recuar dias apanha o ano bissexto', () => {
  assert.equal(recuarDias('2024-03-01', 1), '2024-02-29');
  assert.equal(recuarDias('2026-03-01', 1), '2026-02-28');
});

/* ---------------------------------------------------------- intervalos */

test('cada período dá o intervalo certo', () => {
  const hoje = '2026-08-25';
  assert.deepEqual(intervaloDoPeriodo({ tipo: '4s' }, hoje), { de: '2026-07-28', ate: hoje });
  assert.deepEqual(intervaloDoPeriodo({ tipo: '3m' }, hoje), { de: '2026-05-26', ate: hoje });
  assert.deepEqual(intervaloDoPeriodo({ tipo: '1a' }, hoje), { de: '2025-08-25', ate: hoje });
});

test('"tudo" não tem limites', () => {
  assert.deepEqual(intervaloDoPeriodo({ tipo: 'tudo' }, '2026-08-25'), { de: null, ate: null });
  assert.deepEqual(intervaloDoPeriodo({}, '2026-08-25'), { de: null, ate: null });
  assert.deepEqual(intervaloDoPeriodo(null, '2026-08-25'), { de: null, ate: null });
});

test('datas à escolha passam tal e qual', () => {
  const r = intervaloDoPeriodo({ tipo: 'datas', de: '2020-01-01', ate: '2020-12-31' }, '2026-08-25');
  assert.deepEqual(r, { de: '2020-01-01', ate: '2020-12-31' });
});

test('a lista de períodos tem o que a app precisa', () => {
  assert.deepEqual(PERIODOS.map(p => p.chave), ['4s', '3m', '6m', '1a', 'tudo']);
  assert.equal(PERIODOS[PERIODOS.length - 1].dias, null, 'o último é "tudo"');
});

/* ------------------------------------------------------------- filtrar */

test('filtrar por intervalo inclui os extremos', () => {
  const s = [serie('2026-01-01', 100, 5), serie('2026-06-15', 100, 5), serie('2026-12-31', 100, 5)];
  assert.equal(filtrarPorIntervalo(s, { de: '2026-01-01', ate: '2026-12-31' }).length, 3);
  assert.equal(filtrarPorIntervalo(s, { de: '2026-01-02', ate: '2026-12-30' }).length, 1);
  assert.equal(filtrarPorIntervalo(s, { de: '2026-06-15', ate: '2026-06-15' }).length, 1);
});

test('filtrar só com um dos limites', () => {
  const s = [serie('2026-01-01', 100, 5), serie('2026-12-31', 100, 5)];
  assert.equal(filtrarPorIntervalo(s, { de: '2026-06-01' }).length, 1);
  assert.equal(filtrarPorIntervalo(s, { ate: '2026-06-01' }).length, 1);
});

test('sem intervalo passa tudo, e séries sem data ficam de fora quando há', () => {
  const s = [serie('2026-01-01', 100, 5), { id: 99, exercicioId: 1, data: null, peso: 1, reps: 1 }];
  assert.equal(filtrarPorIntervalo(s, null).length, 2, 'sem intervalo nao se mexe em nada');
  assert.equal(filtrarPorIntervalo(s, {}).length, 2);
  assert.equal(filtrarPorIntervalo(s, { de: '2020-01-01' }).length, 1, 'sem data nao entra');
});

/* ---------------------------------------- carga máxima a N reps ao longo do tempo */

test('evolução a N reps: um ponto por dia, com o melhor desse dia', () => {
  const p = pesoPorDiaParaReps([
    serie('2026-01-01', 100, 5),
    serie('2026-01-01', 105, 5),
    serie('2026-01-08', 102.5, 5)
  ], 1, 5);
  assert.deepEqual(p, [
    { data: '2026-01-01', peso: 105 },
    { data: '2026-01-08', peso: 102.5 }
  ]);
});

test('evolução a N reps: séries mais longas contam', () => {
  // Quem fez 8 repetições fez 5 pelo caminho.
  const p = pesoPorDiaParaReps([serie('2026-01-01', 100, 8)], 1, 5);
  assert.deepEqual(p, [{ data: '2026-01-01', peso: 100 }]);
});

test('evolução a N reps: séries mais curtas não contam', () => {
  // 200 kg a 2 repetições não diz nada sobre o máximo a 5.
  const p = pesoPorDiaParaReps([
    serie('2026-01-01', 200, 2),
    serie('2026-01-08', 100, 5)
  ], 1, 5);
  assert.deepEqual(p, [{ data: '2026-01-08', peso: 100 }]);
});

test('evolução a N reps: um dia sem nada a N reps não dá ponto', () => {
  // Nao pode aparecer um zero — o grafico mergulhava sem razao nenhuma.
  const p = pesoPorDiaParaReps([
    serie('2026-01-01', 100, 5),
    serie('2026-01-08', 200, 3)
  ], 1, 5);
  assert.equal(p.length, 1);
  assert.equal(p[0].data, '2026-01-01');
});

test('evolução a N reps: peso corporal, séries por fazer e outros exercícios ficam de fora', () => {
  const p = pesoPorDiaParaReps([
    serie('2026-01-01', 0, 10),                                  // peso corporal
    serie('2026-01-02', 80, 10, 2),                              // outro exercicio
    { ...serie('2026-01-03', 300, 10), feita: false },           // por fazer
    serie('2026-01-04', 100, 10)
  ], 1, 5);
  assert.deepEqual(p, [{ data: '2026-01-04', peso: 100 }]);
});

test('evolução a N reps: pedidos sem sentido devolvem lista vazia', () => {
  const s = [serie('2026-01-01', 100, 5)];
  assert.deepEqual(pesoPorDiaParaReps(s, 1, 0), []);
  assert.deepEqual(pesoPorDiaParaReps(s, 1, null), []);
  assert.deepEqual(pesoPorDiaParaReps(s, 1, 50), [], 'nunca fez 50 repetições');
});

/* ----------------------------------------------------- contra o histórico */

test('histórico real: filtrar por ano dá contas que fecham', SEM_DADOS, () => {
  const b = backup();
  let soma = 0;
  for (let ano = 2020; ano <= 2026; ano++) {
    soma += filtrarPorIntervalo(b.series, { de: ano + '-01-01', ate: ano + '-12-31' }).length;
  }
  assert.equal(soma, b.series.length, 'a soma dos anos tem de dar o total');
});

test('histórico real: a evolução a 5 reps desce quando as repetições sobem', SEM_DADOS, () => {
  const b = backup();
  const sup = b.exercicios.find(e => e.nome === 'Flat Barbell Bench Press');
  const a5 = pesoPorDiaParaReps(b.series, sup.id, 5);
  const a10 = pesoPorDiaParaReps(b.series, sup.id, 10);

  assert.ok(a5.length > 20, 'poucos pontos a 5 reps: ' + a5.length);
  assert.ok(a5.length >= a10.length, 'a 10 reps nunca pode haver mais dias do que a 5');

  // Em cada dia que apareça nas duas, o de 10 nunca pode pesar mais.
  const por5 = Object.fromEntries(a5.map(p => [p.data, p.peso]));
  a10.forEach(p => {
    if (por5[p.data] !== undefined) {
      assert.ok(p.peso <= por5[p.data], p.data + ': 10 reps a ' + p.peso + ', 5 reps a ' + por5[p.data]);
    }
  });
});
