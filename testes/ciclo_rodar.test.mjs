/**
 * Ciclo seguinte a entrar por outra semana (29/09/2026): o Bruno quis o
 * ciclo 2 a 28/09 com agachamento na primeira segunda e ombro a 05/10.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { nucleo } from './nucleo.mjs';

const { PLANO_CONFIG_PADRAO: P, gerarPlano, validarPlano, rodarLifts, partesDoCiclo } = nucleo;

test('rodarLifts: agachamento primeiro da agachamento a 28/09 e ombro a 05/10', () => {
  const cfg = rodarLifts(Object.assign({}, P, { dataInicio: '2026-09-28' }), 'AGACHAMENTO');
  const cal = gerarPlano(cfg).calendario;
  assert.equal(cal[0].dias.segunda.data, '2026-09-28');
  assert.equal(cal[0].dias.segunda.lift, 'AGACHAMENTO');
  assert.equal(cal[1].dias.segunda.data, '2026-10-05');
  assert.equal(cal[1].dias.segunda.lift, 'OMBRO');
  assert.deepEqual(cfg.lifts, ['AGACHAMENTO', 'OMBRO', 'MORTO', 'SUPINO']);
});

test('rodarLifts: as 4 ordens passam as 17 regras e nao mexem nos pesos', () => {
  P.lifts.forEach((L) => {
    const cfg = rodarLifts(P, L);
    assert.equal(cfg.lifts[0], L);
    assert.deepEqual(validarPlano(gerarPlano(cfg)), [], L);
    assert.deepEqual(cfg.lift, P.lift);
  });
  assert.deepEqual(P.lifts, ['MORTO', 'SUPINO', 'AGACHAMENTO', 'OMBRO'], 'o original fica igual');
});

test('partesDoCiclo: so as sessoes do ciclo e as series delas', () => {
  const sessoes = [
    { id: 1, data: '2026-10-05', plano: { ciclo: '2026-10-05', semana: 1, dia: 'segunda' } },
    { id: 2, data: '2026-09-25', plano: { ciclo: '2026-08-31', semana: 4, dia: 'sexta' } },
    { id: 3, data: '2026-09-29' }
  ];
  const series = [
    { id: 10, sessaoId: 1, peso: 100, reps: 5, feita: false },
    { id: 11, sessaoId: 2, peso: 100, reps: 5 },
    { id: 12, sessaoId: 3, peso: 100, reps: 5 }
  ];
  const p = partesDoCiclo('2026-10-05', sessoes, series);
  assert.deepEqual(p.sessoes.map((s) => s.id), [1]);
  assert.deepEqual(p.series.map((s) => s.id), [10]);
  assert.equal(p.feitas, 0);
  assert.equal(partesDoCiclo('2026-08-31', sessoes, series).feitas, 1);
});
