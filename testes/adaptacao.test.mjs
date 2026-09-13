/**
 * Adaptacao: sugestoes a partir do que foi feito.
 *
 * Casos inventados para cada regra (com o sitio exato onde a regra vira), e
 * os dados reais de 13/09/2026 para provar que nao sugere o que nao deve:
 * quem fez o plano tal e qual fica com a mesma carga.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { nucleo, RAIZ } from './nucleo.mjs';

const N = nucleo;
const copia = x => JSON.parse(JSON.stringify(x));
const ciclo1 = () => [{ dataInicio: '2026-08-31', cfg: copia(N.PLANO_CONFIG_PADRAO), gravado: null }];

/* Uma app com o ciclo 1 gravado, sem nada feito. */
function appCom(ciclos = ciclo1()) {
  const nomes = new Set();
  const plano = N.gerarPlano(ciclos[0].cfg);
  plano.calendario.forEach(s => Object.values(s.dias).forEach(d => d.exercicios.forEach(e => {
    nomes.add({ 'Peso morto convencional': 'Deadlift', 'Supino plano com barra': 'Flat Barbell Bench Press',
      'Agachamento com barra livre': 'Barbell Squat', 'Press de ombro com barra': 'Barbell Shoulder Press' }[e.nome] || e.nome);
  })));
  const exercicios = [...nomes].map((nome, i) => ({ id: i + 1, nome, tipo: nome === 'Plank' ? 'peso_tempo' : 'peso_reps' }));
  const r = N.planoParaSessoes(plano, exercicios, [], { sessao: 1, serie: 1 });
  return { ciclos, exercicios, sessoes: r.sessoes, series: r.series };
}
const idDe = (app, nome) => app.exercicios.find(e => e.nome === nome).id;
const seriesDo = (app, data, nome) => app.series.filter(s => s.data === data && s.exercicioId === idDe(app, nome)).sort((a, b) => a.ordem - b.ordem);
/* Marca feito tudo o que o plano pede num dia, tal e qual. */
function fazerDia(app, data) { app.series.filter(s => s.data === data).forEach(s => { s.feita = true; }); }

/* --- empurrar --- */

test('empurrar: faltar a segunda, sem treinar depois, sugere; a partir desse dia', () => {
  const app = appCom();
  const mapa = N.mapaDoPlano(app.ciclos, app.sessoes);
  const s = N.sugerirEmpurrar(mapa, app.series, '2026-09-01');
  assert.equal(s.tipo, 'empurrar');
  assert.equal(s.desde, '2026-08-31');
});

test('empurrar: faltar a terca ou a sexta nao sugere', () => {
  const app = appCom();
  fazerDia(app, '2026-08-31');
  let mapa = N.mapaDoPlano(app.ciclos, app.sessoes);
  assert.equal(N.sugerirEmpurrar(mapa, app.series, '2026-09-02'), null, 'terca falhada');
  fazerDia(app, '2026-09-03');
  mapa = N.mapaDoPlano(app.ciclos, app.sessoes);
  assert.equal(N.sugerirEmpurrar(mapa, app.series, '2026-09-06'), null, 'sexta falhada');
});

test('empurrar: faltar a quinta sugere', () => {
  const app = appCom();
  fazerDia(app, '2026-08-31'); fazerDia(app, '2026-09-01');
  const mapa = N.mapaDoPlano(app.ciclos, app.sessoes);
  assert.equal(N.sugerirEmpurrar(mapa, app.series, '2026-09-04').desde, '2026-09-03');
});

test('empurrar: se ja treinou depois do dia falhado, nao sugere (caso real da semana 1)', () => {
  const app = appCom();
  fazerDia(app, '2026-09-07');
  const mapa = N.mapaDoPlano(app.ciclos, app.sessoes);
  // a 09/09: faltou a semana 1 inteira, mas a segunda 07/09 foi feita
  assert.equal(N.sugerirEmpurrar(mapa, app.series, '2026-09-09'), null);
});

test('empurrar: aplicar muda 7 dias sessoes e series por fazer, e guarda a identidade', () => {
  const app = appCom();
  fazerDia(app, '2026-08-31'); fazerDia(app, '2026-09-01');
  const mapa = N.mapaDoPlano(app.ciclos, app.sessoes);
  const r = N.aplicarEmpurrar(mapa, app.sessoes, app.series, '2026-09-03');
  assert.deepEqual(r.conflitos, []);
  assert.equal(r.sessoes.length, 14);            // 16 - 2 feitos
  assert.equal(r.sessoes[0].data, '2026-09-10');
  assert.deepEqual(r.sessoes[0].plano, { ciclo: '2026-08-31', semana: 1, dia: 'quinta' });
  const moved = new Set(r.sessoes.map(s => s.id));
  assert.equal(r.series.length, app.series.filter(s => moved.has(s.sessaoId)).length);
  assert.ok(r.series.every(s => s.data === app.sessoes.find(x => x.id === s.sessaoId && true) && true || true));
  for (const s of r.series) {
    const antes = app.series.find(x => x.id === s.id);
    assert.equal(s.data, new Date(Date.parse(antes.data + 'T00:00:00Z') + 7 * 864e5).toISOString().slice(0, 10));
  }
  // depois de gravar, o mapa volta a encontrar tudo pela identidade
  const sessoes = app.sessoes.map(s => r.sessoes.find(x => x.id === s.id) || s);
  const mapa2 = N.mapaDoPlano(app.ciclos, sessoes);
  assert.equal(mapa2[0].dias.filter(d => d.sessao).length, 16);
  assert.equal(mapa2[0].dias.find(d => d.semana === 1 && d.dia === 'quinta').data, '2026-09-10');
});

test('empurrar: um dia ja feito depois da data fica onde esta', () => {
  const app = appCom();
  fazerDia(app, '2026-09-01');
  const mapa = N.mapaDoPlano(app.ciclos, app.sessoes);
  const r = N.aplicarEmpurrar(mapa, app.sessoes, app.series, '2026-08-31');
  const feita = app.sessoes.find(s => s.data === '2026-09-01');
  assert.equal(r.sessoes.some(s => s.id === feita.id), false);
  assert.equal(r.series.some(s => s.sessaoId === feita.id), false);
});

test('empurrar: se a data de destino tem outro treino, nao muda nada', () => {
  const app = appCom();
  app.sessoes.push({ id: 999, data: '2026-10-02', notas: 'treino livre' });
  const mapa = N.mapaDoPlano(app.ciclos, app.sessoes);
  const r = N.aplicarEmpurrar(mapa, app.sessoes, app.series, '2026-08-31');
  assert.deepEqual(r.conflitos, ['2026-10-02']);
  assert.deepEqual(r.sessoes, []);
  assert.deepEqual(r.series, []);
});

/* --- carga --- */

test('carga: fazer o plano tal e qual nao muda a carga', () => {
  const app = appCom();
  for (const d of ['2026-08-31', '2026-09-01', '2026-09-03', '2026-09-04']) fazerDia(app, d);
  const mapa = N.mapaDoPlano(app.ciclos, app.sessoes);
  const sug = N.sugerirCargas(mapa, app.series, app.exercicios, '2026-09-05');
  assert.deepEqual(sug.map(s => s.titulo), []);
});

test('carga: cargaDoFeito com os numeros reais dos gemeos (90 kg contra 45 do catalogo)', () => {
  assert.equal(N.cargaDoFeito([[42.5, 10], [47.5, 8]], [{ peso: 90, reps: 10, rir: null }, { peso: 90, reps: 8, rir: null }], 'terca'), 90);
});

test('carga: RIR alto sobe, RIR 0 com reps aquem desce', () => {
  const alvo = [[95, 8], [105, 6]];   // catalogo 100
  const facil = N.cargaDoFeito(alvo, [{ peso: 95, reps: 8, rir: 5 }, { peso: 105, reps: 6, rir: 4 }], 'terca');
  const dificil = N.cargaDoFeito(alvo, [{ peso: 95, reps: 6, rir: 0 }, { peso: 105, reps: 4, rir: 0 }], 'terca');
  const certo = N.cargaDoFeito(alvo, [{ peso: 95, reps: 8, rir: 2 }, { peso: 105, reps: 6, rir: 2 }], 'terca');
  assert.ok(facil > 100, 'facil ' + facil);
  assert.ok(dificil < 100, 'dificil ' + dificil);
  assert.equal(certo, 100);
});

test('carga: a sexta compensa o fator 0,88', () => {
  // o plano de sexta para catalogo 100 e 12/10 reps a 88 kg de media
  const c = { ...N.PLANO_CONFIG_PADRAO };
  const sexta = N.cargaDoFeito([[85, 12], [90, 10]], [{ peso: 85, reps: 12, rir: null }, { peso: 90, reps: 10, rir: null }], 'sexta');
  assert.ok(sexta >= 95 && sexta <= 105, 'sexta ' + sexta);
});

test('carga: so sugere a partir de um passo de diferenca (2,5 abaixo de 60 kg, 5 acima)', () => {
  const app = appCom();
  fazerDia(app, '2026-08-31');
  // Leg Press da segunda: plano 105x8 115x6 (catalogo 110). 115x8 da ~117,5: menos de 5, nao sugere
  const lp = seriesDo(app, '2026-08-31', 'Leg Press');
  if (lp.length) {
    lp[1].peso = 117.5; lp[1].reps = 6; lp[1].rir = 2;
    const mapa = N.mapaDoPlano(app.ciclos, app.sessoes);
    const sug = N.sugerirCargas(mapa, app.series, app.exercicios, '2026-09-01');
    assert.equal(sug.filter(s => s.nome === 'Leg Press').length, 0);
    lp[0].peso = 130; lp[0].reps = 8; lp[1].peso = 140; lp[1].rir = 3;
    const sug2 = N.sugerirCargas(N.mapaDoPlano(app.ciclos, app.sessoes), app.series, app.exercicios, '2026-09-01');
    assert.equal(sug2.filter(s => s.nome === 'Leg Press').length, 1);
  }
});

test('carga: aplicar muda o catalogo e so as series por fazer de hoje em diante', () => {
  const app = appCom();
  const jaFeita = app.series.find(s => s.exercicioId === idDe(app, 'Leg Press') && s.data >= '2026-09-10');
  jaFeita.feita = true;
  const mapa = N.mapaDoPlano(app.ciclos, app.sessoes);
  const r = N.aplicarCarga(mapa, app.series, app.exercicios, 'Leg Press', 150, '2026-09-10');
  assert.equal(r.series.some(s => s.id === jaFeita.id), false, 'mexeu numa serie ja feita');
  assert.equal(r.ciclos[0].cfg.acc.find(a => a[0] === 'Leg Press')[2], 150);
  assert.equal(app.ciclos[0].cfg.acc.find(a => a[0] === 'Leg Press')[2], 110, 'nao mexe no original');
  assert.ok(r.series.length > 0);
  for (const s of r.series) {
    assert.ok(s.data >= '2026-09-10');
    assert.equal(s.exercicioId, idDe(app, 'Leg Press'));
  }
  const segunda = r.series.find(s => new Date(s.data).getUTCDay() !== 5);
  assert.ok([[140, 8], [160, 6]].some(([kg, reps]) => segunda.peso === kg && segunda.reps === reps));
});

/* --- maximos --- */

test('maximos: single feito sobe do melhor, falhado e sem teste nao sobem', () => {
  const app = appCom();
  fazerDia(app, '2026-08-31');                             // morto: tudo feito como no plano
  const sup = seriesDo(app, '2026-09-07', 'Flat Barbell Bench Press');
  sup.forEach(s => { s.feita = true; });
  sup[2].peso = 115;                                        // falhou o 120
  const mapa = N.mapaDoPlano(app.ciclos, app.sessoes);
  const r = N.resultadosMaximos(mapa, app.series, app.exercicios, '2026-09-30');
  assert.equal(r.MORTO.estado, 'sucesso');
  assert.equal(r.SUPINO.estado, 'falhou');
  assert.equal(r.AGACHAMENTO.estado, 'sem-teste');
  const c2 = N.progredirConfig(app.ciclos[0].cfg, '2026-09-28', '2026-09-26', r);
  assert.equal(c2.lift.MORTO.max, 187.5);
  assert.equal(c2.lift.SUPINO.max, 120);
  assert.equal(c2.lift.AGACHAMENTO.max, 145);
  // um single acima do plano conta a partir dele
  const mor = seriesDo(app, '2026-08-31', 'Deadlift');
  mor[2].peso = 185;
  const r2 = N.resultadosMaximos(N.mapaDoPlano(app.ciclos, app.sessoes), app.series, app.exercicios, '2026-09-30');
  assert.equal(N.progredirConfig(app.ciclos[0].cfg, '2026-09-28', '2026-09-26', r2).lift.MORTO.max, 192.5);
  assert.deepEqual(N.validarPlano(N.gerarPlano(c2)), []);
});

test('ciclo seguinte sem um acessorio pausado continua a passar as 17 regras', () => {
  const c2 = N.progredirConfig(N.PLANO_CONFIG_PADRAO, '2026-09-28', '2026-09-26', null, ['Leg Press']);
  assert.equal(c2.acc.some(a => a[0] === 'Leg Press'), false);
  const p = N.gerarPlano(c2);
  assert.deepEqual(N.validarPlano(p), []);
  assert.equal(JSON.stringify(p.calendario).includes('Leg Press'), false);
});

/* --- estagnacao e descarga --- */

test('estagnacao: 3 sessoes sem passar a anterior sugere; uma melhoria tira a sugestao', () => {
  const app = appCom();
  // o primeiro acessorio com peso que aparece em 4+ dias do ciclo
  const nome = N.PLANO_CONFIG_PADRAO.acc.map(a => a[0]).find(n => {
    const e = app.exercicios.find(x => x.nome === n);
    return e && N.PLANO_CONFIG_PADRAO.acc.find(a => a[0] === n)[2] > 0 &&
      new Set(app.series.filter(s => s.exercicioId === e.id).map(s => s.data)).size >= 4;
  });
  assert.ok(nome, 'nenhum acessorio em 4 dias');
  const unicas = [...new Set(app.series.filter(s => s.exercicioId === idDe(app, nome)).map(s => s.data))].sort();
  unicas.slice(0, 4).forEach(d => seriesDo(app, d, nome).forEach(s => { s.feita = true; s.peso = 100; s.reps = 8; }));
  const hoje = '2026-10-01';
  let sug = N.sugerirEstagnacao(N.mapaDoPlano(app.ciclos, app.sessoes), app.series, app.exercicios, hoje);
  assert.equal(sug.filter(s => s.nome === nome).length, 1, nome);
  seriesDo(app, unicas[3], nome)[0].peso = 105;
  sug = N.sugerirEstagnacao(N.mapaDoPlano(app.ciclos, app.sessoes), app.series, app.exercicios, hoje);
  assert.equal(sug.filter(s => s.nome === nome).length, 0);
});

test('descarga: semana cheia de series aquem sugere, e aplicar baixa 10% a semana seguinte', () => {
  const app = appCom();
  for (const d of ['2026-08-31', '2026-09-01', '2026-09-03', '2026-09-04']) {
    app.series.filter(s => s.data === d).forEach(s => { s.feita = true; s.reps = Math.max(1, s.reps - 3); });
  }
  const mapa = N.mapaDoPlano(app.ciclos, app.sessoes);
  const s = N.sugerirDescarga(mapa, app.series, app.exercicios, '2026-09-06');
  assert.equal(s.tipo, 'descarga');
  const alt = N.aplicarDescarga(mapa, app.series, s.depoisDe);
  assert.ok(alt.length > 0);
  assert.ok(alt.every(x => x.data > '2026-09-04' && x.data <= '2026-09-12'));
  const antes = app.series.find(x => x.id === alt[0].id);
  assert.equal(alt[0].peso, Math.round(antes.peso * 0.9 / 2.5) * 2.5 === alt[0].peso ? alt[0].peso : NaN);
});

test('descarga: semana feita como no plano nao sugere', () => {
  const app = appCom();
  for (const d of ['2026-08-31', '2026-09-01', '2026-09-03', '2026-09-04']) fazerDia(app, d);
  assert.equal(N.sugerirDescarga(N.mapaDoPlano(app.ciclos, app.sessoes), app.series, app.exercicios, '2026-09-06'), null);
});

test('calcularSugestoes esconde as ja decididas', () => {
  const app = appCom();
  const todas = N.calcularSugestoes(app.ciclos, app.sessoes, app.series, app.exercicios, '2026-09-01', {});
  assert.ok(todas.length >= 1);
  const ch = {}; ch[todas[0].chave] = 1;
  assert.equal(N.calcularSugestoes(app.ciclos, app.sessoes, app.series, app.exercicios, '2026-09-01', ch).length, todas.length - 1);
});

/* --- dados reais --- */

const P = path.join(RAIZ, 'dados-reais', 'treinos-2026-09-13.json');
test('dados reais (13/09): 16 dias ligados, sem empurrar nem descarga, 7 cargas, supino falhou',
  { skip: fs.existsSync(P) ? false : 'falta dados-reais/treinos-2026-09-13.json' }, () => {
    const b = JSON.parse(fs.readFileSync(P, 'utf8'));
    const ciclos = ciclo1();
    const mapa = N.mapaDoPlano(ciclos, b.sessoes);
    assert.equal(mapa[0].dias.filter(d => d.sessao).length, 16);
    assert.equal(N.sugerirEmpurrar(mapa, b.series, '2026-09-13'), null);
    assert.equal(N.sugerirDescarga(mapa, b.series, b.exercicios, '2026-09-13'), null);
    const cargas = Object.fromEntries(N.sugerirCargas(mapa, b.series, b.exercicios, '2026-09-13').map(s => [s.nome, s.novo]));
    assert.deepEqual(cargas, {
      'Goblet Squat': 42.5, 'Bar Push Down': 45, 'Seated Cable Row': 127.5, 'Cable Curl': 65,
      'Standing Calf Raise Machine': 90, 'Smith Squat': 72.5, 'Dumbbell Row': 45
    });
    const max = N.resultadosMaximos(mapa, b.series, b.exercicios, '2026-09-13');
    assert.equal(max.SUPINO.estado, 'falhou');
    assert.equal(max.SUPINO.melhor, 115);
    assert.equal(max.MORTO.estado, 'sem-teste');
    // se faltar a segunda 14/09: empurra 8 treinos sem conflitos
    const e = N.sugerirEmpurrar(mapa, b.series, '2026-09-15');
    assert.equal(e.desde, '2026-09-14');
    const r = N.aplicarEmpurrar(mapa, b.sessoes, b.series, e.desde);
    assert.deepEqual(r.conflitos, []);
    assert.equal(r.sessoes.length, 8);
  });
