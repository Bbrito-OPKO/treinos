/**
 * Objetivo de peso corporal.
 *
 * As contas têm de servir para emagrecer E para aumentar. É por isso que os
 * testes fazem sempre os dois: um erro de sinal passaria despercebido se só
 * se testasse um dos sentidos.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { nucleo } from './nucleo.mjs';

const { progressoObjetivoPeso } = nucleo;

const perto = (a, b, tol = 0.001) => assert.ok(Math.abs(a - b) < tol,
  `esperava ${b}, veio ${a}`);

// Emagrecer: 80 -> 75 em 100 dias.
const EMAGRECER = { kg: 75, ate: '2026-04-11', desde: '2026-01-01', pesoInicial: 80 };
// Aumentar: 70 -> 75 nos mesmos 100 dias.
const AUMENTAR = { kg: 75, ate: '2026-04-11', desde: '2026-01-01', pesoInicial: 70 };

const pesagem = (data, kg) => ({ id: 1, data, kg });

test('a meio do caminho conta 50% nos dois sentidos', () => {
  const a = progressoObjetivoPeso([pesagem('2026-02-20', 77.5)], EMAGRECER, '2026-02-20');
  perto(a.percentagem, 50);
  perto(a.falta, -2.5, 0.001);

  const b = progressoObjetivoPeso([pesagem('2026-02-20', 72.5)], AUMENTAR, '2026-02-20');
  perto(b.percentagem, 50);
  perto(b.falta, 2.5, 0.001);
});

test('ir para o lado errado dá 0%, não um número negativo à solta', () => {
  const a = progressoObjetivoPeso([pesagem('2026-02-20', 82)], EMAGRECER, '2026-02-20');
  assert.equal(a.percentagem, 0);
  assert.ok(a.fracao < 0, 'a fração crua fica negativa, e isso é informação');
  assert.equal(a.atingido, false);
});

test('chegar ao objetivo, e passar dele, conta como atingido', () => {
  const a = progressoObjetivoPeso([pesagem('2026-03-01', 75)], EMAGRECER, '2026-03-01');
  assert.equal(a.atingido, true);
  perto(a.percentagem, 100);

  const b = progressoObjetivoPeso([pesagem('2026-03-01', 73)], EMAGRECER, '2026-03-01');
  assert.equal(b.atingido, true, 'passar do objetivo continua a ser atingido');
  assert.equal(b.percentagem, 100, 'a percentagem não passa dos 100');
});

test('adiantado e atrasado comparam o caminho com o tempo', () => {
  // 50 dias dos 100: era esperado estar a meio, ou seja nos 77,5 kg.
  const meio = '2026-02-20';

  const noPonto = progressoObjetivoPeso([pesagem(meio, 77.5)], EMAGRECER, meio);
  perto(noPonto.pesoEsperadoHoje, 77.5);
  assert.equal(noPonto.adiantado, true, 'exactamente no ponto conta como a cumprir');

  const bom = progressoObjetivoPeso([pesagem(meio, 76)], EMAGRECER, meio);
  assert.equal(bom.adiantado, true);

  const mau = progressoObjetivoPeso([pesagem(meio, 79)], EMAGRECER, meio);
  assert.equal(mau.adiantado, false);

  // A aumentar é ao contrário, e tem de continuar certo.
  const bomSubida = progressoObjetivoPeso([pesagem(meio, 74)], AUMENTAR, meio);
  assert.equal(bomSubida.adiantado, true);
  const mauSubida = progressoObjetivoPeso([pesagem(meio, 71)], AUMENTAR, meio);
  assert.equal(mauSubida.adiantado, false);
});

test('o ritmo por semana que falta é o que falta a dividir pelo tempo que resta', () => {
  // A 50 dias do fim, faltam 2,5 kg: 2,5 / 50 * 7 = 0,35 kg por semana.
  const r = progressoObjetivoPeso([pesagem('2026-02-20', 77.5)], EMAGRECER, '2026-02-20');
  assert.equal(r.diasRestantes, 50);
  perto(r.ritmoSemanalNecessario, -0.35);

  const s = progressoObjetivoPeso([pesagem('2026-02-20', 72.5)], AUMENTAR, '2026-02-20');
  perto(s.ritmoSemanalNecessario, 0.35, 0.001);
});

test('depois da data não se pede ritmo nenhum', () => {
  const r = progressoObjetivoPeso([pesagem('2026-05-01', 76)], EMAGRECER, '2026-05-01');
  assert.ok(r.diasRestantes < 0);
  assert.equal(r.ritmoSemanalNecessario, null, 'não faz sentido pedir kg por semana já depois do fim');
});

test('a linha do objetivo são dois pontos: onde se começou e onde se quer chegar', () => {
  const r = progressoObjetivoPeso([pesagem('2026-02-20', 77.5)], EMAGRECER, '2026-02-20');
  assert.deepEqual(r.linha, [
    { x: '2026-01-01', y: 80 },
    { x: '2026-04-11', y: 75 }
  ]);
});

test('sem pesagens usa-se o peso de partida', () => {
  const r = progressoObjetivoPeso([], EMAGRECER, '2026-02-20');
  assert.equal(r.pesoAtual, 80);
  assert.equal(r.percentagem, 0);
  assert.equal(r.dataDoPesoAtual, '2026-01-01');
});

test('vale sempre a pesagem mais recente, mesmo desordenadas', () => {
  const r = progressoObjetivoPeso([
    { id: 2, data: '2026-02-20', kg: 77.5 },
    { id: 1, data: '2026-01-15', kg: 79 }
  ], EMAGRECER, '2026-02-20');
  assert.equal(r.pesoAtual, 77.5);
});

test('objetivo igual ao ponto de partida já está atingido, sem dividir por zero', () => {
  const r = progressoObjetivoPeso([pesagem('2026-01-01', 80)],
    { kg: 80, ate: '2026-04-11', desde: '2026-01-01', pesoInicial: 80 }, '2026-02-01');
  assert.equal(r.atingido, true);
  assert.equal(r.percentagem, 100);
  assert.ok(Number.isFinite(r.fracao), 'não pode sair Infinity nem NaN');
});

test('objetivos incompletos devolvem null em vez de contas com lixo', () => {
  assert.equal(progressoObjetivoPeso([], null, '2026-01-01'), null);
  assert.equal(progressoObjetivoPeso([], {}, '2026-01-01'), null);
  assert.equal(progressoObjetivoPeso([], { kg: 75 }, '2026-01-01'), null);
  assert.equal(progressoObjetivoPeso([], { kg: 75, ate: '2026-04-11' }, '2026-01-01'), null);
  assert.equal(progressoObjetivoPeso([],
    { kg: 75, ate: '2026-04-11', desde: '2026-01-01' }, '2026-01-01'), null,
    'sem peso de partida não há caminho para medir');
});
