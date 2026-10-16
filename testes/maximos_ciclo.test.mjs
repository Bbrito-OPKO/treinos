/**
 * Maximo pelo que foi feito nas ultimas 4 semanas (16/10/2026).
 *
 * O ciclo 2 do Bruno ficou com os maximos do ciclo 1 (180/120/145/65) porque
 * so o single do dia de maximos os subia. Os numeros do primeiro teste sao
 * os que ele fez entre 29/09 e 15/10.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { nucleo } from './nucleo.mjs';

const N = nucleo;
const copia = x => JSON.parse(JSON.stringify(x));
const NA_APP = { 'Peso morto convencional': 'Deadlift', 'Supino plano com barra': 'Flat Barbell Bench Press',
  'Agachamento com barra livre': 'Barbell Squat', 'Press de ombro com barra': 'Barbell Shoulder Press' };
const HOJE = '2026-10-16';

function ciclo(dataInicio, primeiro) {
  const cfg = N.rodarLifts(Object.assign(copia(N.PLANO_CONFIG_PADRAO), { dataInicio, ajustes: {} }), primeiro);
  return { dataInicio, cfg, gravado: null };
}

/* Uma app com os ciclos gravados, sem nada feito. */
function appCom(ciclos) {
  const nomes = new Set();
  const planos = ciclos.map(c => N.gerarPlano(c.cfg));
  planos.forEach(p => p.calendario.forEach(s => Object.values(s.dias).forEach(d =>
    d.exercicios.forEach(e => nomes.add(NA_APP[e.nome] || e.nome)))));
  const exercicios = [...nomes].map((nome, i) => ({ id: i + 1, nome, tipo: nome === 'Plank' ? 'peso_tempo' : 'peso_reps' }));
  let sessoes = [], series = [], prox = { sessao: 1, serie: 1 };
  planos.forEach(p => {
    const r = N.planoParaSessoes(p, exercicios, sessoes, prox);
    sessoes = sessoes.concat(r.sessoes); series = series.concat(r.series);
    prox = { sessao: prox.sessao + r.sessoes.length, serie: prox.serie + r.series.length };
  });
  return { ciclos, exercicios, sessoes, series };
}
const idDe = (app, nome) => app.exercicios.find(e => e.nome === nome).id;
let idExtra = 100000;
/* Uma serie feita, solta (fora das series do plano). */
function feita(app, data, nome, peso, reps, rir = null, extra = {}) {
  app.series.push(Object.assign({ id: idExtra++, sessaoId: 0, exercicioId: idDe(app, nome), data, ordem: 0,
    peso, reps, rir, feita: true }, extra));
}
const sugerir = (app, hoje = HOJE) => N.sugerirMaximos(N.mapaDoPlano(app.ciclos, app.sessoes), app.series, app.exercicios, hoje);
const porLift = sug => Object.fromEntries(sug.map(s => [s.lift, s.novo]));

test('os numeros do Bruno a 16/10: morto 190, agachamento 157,5, supino 122,5; ombro nao', () => {
  const app = appCom([ciclo('2026-09-28', 'AGACHAMENTO')]);
  feita(app, '2026-09-29', 'Barbell Shoulder Press', 60, 3, 1);
  feita(app, '2026-10-05', 'Barbell Shoulder Press', 45, 13, 1);
  feita(app, '2026-10-06', 'Deadlift', 170, 6, 0);
  feita(app, '2026-10-08', 'Flat Barbell Bench Press', 110, 5, 2);
  feita(app, '2026-10-12', 'Deadlift', 190, 2, 1);
  feita(app, '2026-10-15', 'Barbell Squat', 120, 12, 1);
  const sug = sugerir(app);
  assert.deepEqual(porLift(sug), { MORTO: 190, AGACHAMENTO: 157.5, SUPINO: 122.5 });
  const morto = sug.find(s => s.lift === 'MORTO');
  assert.equal(morto.antes, 180);
  assert.equal(morto.chave, 'maximo|MORTO|190');
  assert.match(morto.detalhe, /12\/10 fizeste 190×2 RIR 1/);
});

test('sem RIR conta 0 reps de reserva', () => {
  const app = appCom([ciclo('2026-09-28', 'AGACHAMENTO')]);
  feita(app, '2026-10-08', 'Flat Barbell Bench Press', 110, 5, null);
  assert.deepEqual(sugerir(app), [], '110×5 sem RIR: 116,7 -> 117,5, menos de 2,5 acima de 120');
  feita(app, '2026-10-09', 'Flat Barbell Bench Press', 110, 5, 2);
  assert.deepEqual(porLift(sugerir(app)), { SUPINO: 122.5 });
});

test('janela: 28 dias antes de hoje, hoje fica de fora', () => {
  let app = appCom([ciclo('2026-09-28', 'AGACHAMENTO')]);
  feita(app, '2026-09-17', 'Flat Barbell Bench Press', 110, 5, 2);
  feita(app, HOJE, 'Flat Barbell Bench Press', 110, 5, 2);
  assert.deepEqual(sugerir(app), []);
  app = appCom([ciclo('2026-09-28', 'AGACHAMENTO')]);
  feita(app, '2026-09-18', 'Flat Barbell Bench Press', 110, 5, 2);
  assert.deepEqual(porLift(sugerir(app)), { SUPINO: 122.5 });
});

test('nao contam: series por fazer, mais de 15 reps, peso 0', () => {
  const app = appCom([ciclo('2026-09-28', 'AGACHAMENTO')]);
  feita(app, '2026-10-08', 'Flat Barbell Bench Press', 110, 5, 2, { feita: false });
  feita(app, '2026-10-08', 'Flat Barbell Bench Press', 100, 16, 2);
  feita(app, '2026-10-08', 'Flat Barbell Bench Press', 0, 5, 2);
  assert.deepEqual(sugerir(app), []);
});

test('so sobe, e pelo menos o incremento do lift', () => {
  const app = appCom([ciclo('2026-09-28', 'AGACHAMENTO')]);
  feita(app, '2026-10-06', 'Deadlift', 170, 5, 1);          // 204 -> 185: +5, o incremento e 7,5
  feita(app, '2026-10-05', 'Barbell Shoulder Press', 55, 3, 0); // 60,5 -> 55: desce, nao se sugere
  assert.deepEqual(sugerir(app), []);
  feita(app, '2026-10-07', 'Deadlift', 172.5, 5, 1);        // 207 -> 187,5
  assert.deepEqual(porLift(sugerir(app)), { MORTO: 187.5 });
});

test('calcularSugestoes inclui o maximo; decidido nao volta', () => {
  const app = appCom([ciclo('2026-09-28', 'AGACHAMENTO')]);
  feita(app, '2026-10-12', 'Deadlift', 190, 2, 1);
  const todas = N.calcularSugestoes(app.ciclos, app.sessoes, app.series, app.exercicios, HOJE, {});
  assert.ok(todas.some(s => s.chave === 'maximo|MORTO|190'));
  const depois = N.calcularSugestoes(app.ciclos, app.sessoes, app.series, app.exercicios, HOJE, { 'maximo|MORTO|190': 1 });
  assert.ok(!depois.some(s => s.tipo === 'maximo'));
});

test('aplicar: o ciclo sobe na proporcao, so as series por fazer de hoje em diante mudam', () => {
  const app = appCom([ciclo('2026-08-31', 'MORTO'), ciclo('2026-09-28', 'AGACHAMENTO')]);
  const morto = idDe(app, 'Deadlift');
  const de = data => app.series.filter(s => s.data === data && s.exercicioId === morto).sort((a, b) => a.ordem - b.ordem);
  de('2026-10-23')[0].feita = true;                 // ja feita: fica
  const mapa = N.mapaDoPlano(app.ciclos, app.sessoes);
  const r = N.aplicarMaximo(mapa, app.series, app.exercicios, 'MORTO', 190, HOJE);

  assert.deepEqual(r.ciclos[0].cfg.lift.MORTO, N.PLANO_CONFIG_PADRAO.lift.MORTO, 'o ciclo 1 acabou: fica');
  const l = r.ciclos[1].cfg.lift.MORTO;
  assert.equal(l.max, 190);
  assert.deepEqual(l.maximos, [[137.5, 3], [162.5, 2], [190, 1], [147.5, 8]]);
  assert.deepEqual(l.leve, [[115, 8], [127.5, 8], [135, 8], [142.5, 8]]);
  assert.deepEqual(r.ciclos[1].cfg.lift.SUPINO, N.PLANO_CONFIG_PADRAO.lift.SUPINO, 'os outros lifts ficam');

  // a 23/10 (sexta, leve) e o unico dia do morto daqui para a frente
  const ids = new Set(r.series.map(s => s.id));
  assert.deepEqual([...new Set(r.series.map(s => s.data))], ['2026-10-23']);
  assert.ok(!ids.has(de('2026-10-23')[0].id), 'a feita nao muda');
  assert.deepEqual(r.series.map(s => [s.peso, s.reps]), [[127.5, 8], [135, 8], [142.5, 8]]);
  assert.ok(!r.series.some(s => s.data < HOJE));
  assert.ok(r.series.every(s => s.exercicioId === morto));

  // o plano refeito continua a passar as 17 provas
  assert.deepEqual(N.validarPlano(N.gerarPlano(r.ciclos[1].cfg)), []);
});

test('aplicar e depois o ciclo seguinte: parte do maximo novo', () => {
  const app = appCom([ciclo('2026-09-28', 'AGACHAMENTO')]);
  const mapa = N.mapaDoPlano(app.ciclos, app.sessoes);
  const r = N.aplicarMaximo(mapa, app.series, app.exercicios, 'AGACHAMENTO', 157.5, HOJE);
  // o dia de maximos do agachamento (28/09) nao se fez: fica no maximo novo
  const seg = N.progredirConfig(r.ciclos[0].cfg, '2026-10-26', HOJE, { AGACHAMENTO: { estado: 'sem-teste' } }, []);
  assert.equal(seg.lift.AGACHAMENTO.max, 157.5);
  assert.equal(seg.lift.AGACHAMENTO.maximos[2][0], 157.5);
});
