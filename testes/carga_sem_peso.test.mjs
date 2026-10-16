/**
 * Acessorio a 0 kg no plano feito com lastro (16/10/2026): os Chest Dips
 * estavam a 0 e o Bruno fez 20x8 RIR 4 e 30x7 RIR 0 a 15/10.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { nucleo } from './nucleo.mjs';

const N = nucleo;
const copia = x => JSON.parse(JSON.stringify(x));
const NA_APP = { 'Peso morto convencional': 'Deadlift', 'Supino plano com barra': 'Flat Barbell Bench Press',
  'Agachamento com barra livre': 'Barbell Squat', 'Press de ombro com barra': 'Barbell Shoulder Press' };

function app() {
  const cfg = N.rodarLifts(Object.assign(copia(N.PLANO_CONFIG_PADRAO), { dataInicio: '2026-09-28', ajustes: {} }), 'AGACHAMENTO');
  const ciclos = [{ dataInicio: '2026-09-28', cfg, gravado: null }];
  const plano = N.gerarPlano(cfg);
  const nomes = new Set();
  plano.calendario.forEach(s => Object.values(s.dias).forEach(d => d.exercicios.forEach(e => nomes.add(NA_APP[e.nome] || e.nome))));
  const exercicios = [...nomes].map((nome, i) => ({ id: i + 1, nome, tipo: nome === 'Plank' ? 'peso_tempo' : 'peso_reps' }));
  const r = N.planoParaSessoes(plano, exercicios, [], { sessao: 1, serie: 1 });
  return { ciclos, exercicios, sessoes: r.sessoes, series: r.series };
}
const dips = (a, data) => a.series.filter(s => s.data === data && s.exercicioId === a.exercicios.find(e => e.nome === 'Chest Dips').id)
  .sort((x, y) => x.ordem - y.ordem);
const cargas = (a, hoje = '2026-10-16') => N.sugerirCargas(N.mapaDoPlano(a.ciclos, a.sessoes), a.series, a.exercicios, hoje);

test('Chest Dips a 0 kg feitos com lastro: sugere a carga do lastro', () => {
  const a = app();
  const [s1, s2] = dips(a, '2026-10-15');
  Object.assign(s1, { peso: 20, reps: 8, rir: 4, feita: true });
  Object.assign(s2, { peso: 30, reps: 7, rir: 0, feita: true });
  const s = cargas(a).find(x => x.nome === 'Chest Dips');
  assert.equal(s.antes, 0);
  assert.equal(s.novo, 27.5);
  assert.equal(s.titulo, 'Chest Dips: 0 → 27,5 kg');

  const mapa = N.mapaDoPlano(a.ciclos, a.sessoes);
  const r = N.aplicarCarga(mapa, a.series, a.exercicios, 'Chest Dips', 27.5, '2026-10-16');
  assert.equal(r.ciclos[0].cfg.acc.find(x => x[0] === 'Chest Dips')[2], 27.5);
  assert.deepEqual(N.validarPlano(N.gerarPlano(r.ciclos[0].cfg)), []);
});

test('Chest Dips feitos so com o corpo: nao sugere nada', () => {
  const a = app();
  dips(a, '2026-10-15').forEach(s => { s.feita = true; });
  assert.ok(!cargas(a).some(x => x.nome === 'Chest Dips'));
});
