/**
 * Objetivos.
 *
 * As contas têm de servir para subir E para descer. É por isso que os testes
 * fazem sempre os dois sentidos: um erro de sinal passaria despercebido se só
 * se testasse um.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { nucleo } from './nucleo.mjs';

const { progressoDeObjetivo } = nucleo;

const perto = (a, b, tol = 0.001) => assert.ok(Math.abs(a - b) < tol,
  `esperava ${b}, veio ${a}`);

// Subir: supino de 100 para 120 kg em 100 dias.
const SUBIR = { alvo: 120, ate: '2026-04-11', desde: '2026-01-01', inicial: 100 };
// Descer: serve para qualquer coisa que se queira baixar.
const DESCER = { alvo: 80, ate: '2026-04-11', desde: '2026-01-01', inicial: 100 };

test('a meio do caminho conta 50% nos dois sentidos', () => {
  const a = progressoDeObjetivo(110, SUBIR, '2026-02-20');
  perto(a.percentagem, 50);
  perto(a.falta, 10);

  const b = progressoDeObjetivo(90, DESCER, '2026-02-20');
  perto(b.percentagem, 50);
  perto(b.falta, -10);
});

test('ir para o lado errado dá 0%, não um número negativo à solta', () => {
  const a = progressoDeObjetivo(95, SUBIR, '2026-02-20');
  assert.equal(a.percentagem, 0);
  assert.ok(a.fracao < 0, 'a fração crua fica negativa, e isso é informação');
  assert.equal(a.atingido, false);
});

test('chegar ao objetivo, e passar dele, conta como atingido', () => {
  const a = progressoDeObjetivo(120, SUBIR, '2026-03-01');
  assert.equal(a.atingido, true);
  perto(a.percentagem, 100);

  const b = progressoDeObjetivo(125, SUBIR, '2026-03-01');
  assert.equal(b.atingido, true, 'passar do objetivo continua a ser atingido');
  assert.equal(b.percentagem, 100, 'a percentagem não passa dos 100');
});

test('adiantado e atrasado comparam o caminho com o tempo', () => {
  // 50 dias dos 100: era esperado estar a meio, ou seja nos 110 kg.
  const meio = '2026-02-20';

  const noPonto = progressoDeObjetivo(110, SUBIR, meio);
  perto(noPonto.esperadoHoje, 110);
  assert.equal(noPonto.adiantado, true, 'exactamente no ponto conta como a cumprir');

  assert.equal(progressoDeObjetivo(115, SUBIR, meio).adiantado, true);
  assert.equal(progressoDeObjetivo(105, SUBIR, meio).adiantado, false);

  // A descer é ao contrário, e tem de continuar certo.
  assert.equal(progressoDeObjetivo(85, DESCER, meio).adiantado, true);
  assert.equal(progressoDeObjetivo(95, DESCER, meio).adiantado, false);
});

test('o ritmo por semana é o que falta a dividir pelo tempo que resta', () => {
  // A 50 dias do fim, faltam 10 kg: 10 / 50 * 7 = 1,4 kg por semana.
  const r = progressoDeObjetivo(110, SUBIR, '2026-02-20');
  assert.equal(r.diasRestantes, 50);
  perto(r.ritmoSemanal, 1.4);

  const d = progressoDeObjetivo(90, DESCER, '2026-02-20');
  perto(d.ritmoSemanal, -1.4);
});

test('depois da data não se pede ritmo nenhum', () => {
  const r = progressoDeObjetivo(110, SUBIR, '2026-05-01');
  assert.ok(r.diasRestantes < 0);
  assert.equal(r.ritmoSemanal, null, 'não faz sentido pedir kg por semana já depois do fim');
});

test('a linha do objetivo são dois pontos: onde se começou e onde se quer chegar', () => {
  const r = progressoDeObjetivo(110, SUBIR, '2026-02-20');
  assert.deepEqual(r.linha, [
    { x: '2026-01-01', y: 100 },
    { x: '2026-04-11', y: 120 }
  ]);
});

test('sem valor conhecido usa-se o ponto de partida', () => {
  const r = progressoDeObjetivo(null, SUBIR, '2026-02-20');
  assert.equal(r.atual, 100);
  assert.equal(r.percentagem, 0);
  assert.equal(progressoDeObjetivo(undefined, SUBIR, '2026-02-20').atual, 100);
  assert.equal(progressoDeObjetivo(NaN, SUBIR, '2026-02-20').atual, 100);
});

test('objetivo igual ao ponto de partida já está atingido, sem dividir por zero', () => {
  const r = progressoDeObjetivo(100,
    { alvo: 100, ate: '2026-04-11', desde: '2026-01-01', inicial: 100 }, '2026-02-01');
  assert.equal(r.atingido, true);
  assert.equal(r.percentagem, 100);
  assert.ok(Number.isFinite(r.fracao), 'não pode sair Infinity nem NaN');
});

test('objetivos incompletos devolvem null em vez de contas com lixo', () => {
  assert.equal(progressoDeObjetivo(100, null, '2026-01-01'), null);
  assert.equal(progressoDeObjetivo(100, {}, '2026-01-01'), null);
  assert.equal(progressoDeObjetivo(100, { alvo: 120 }, '2026-01-01'), null);
  assert.equal(progressoDeObjetivo(100, { alvo: 120, ate: '2026-04-11' }, '2026-01-01'), null);
  assert.equal(progressoDeObjetivo(100,
    { alvo: 120, ate: '2026-04-11', desde: '2026-01-01' }, '2026-01-01'), null,
    'sem ponto de partida não há caminho para medir');
});
