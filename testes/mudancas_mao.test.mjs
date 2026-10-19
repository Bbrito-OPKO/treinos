/**
 * Mudancas a mao por cima do plano (17/10/2026).
 *
 * O Bruno mudou exercicios numa tabela fora da app. O ficheiro
 * mudancas-2026-10-17.json e o que a app importa; o -esperado.json tem a
 * lista final de cada dia, tirada da tabela dele (outro codigo, o da pagina).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { nucleo, RAIZ } from './nucleo.mjs';

const N = nucleo;
const copia = x => JSON.parse(JSON.stringify(x));
const ler = f => JSON.parse(fs.readFileSync(RAIZ + '/testes/' + f, 'utf8'));
const MUD = ler('mudancas-2026-10-17.json');
const ESPERADO = ler('mudancas-2026-10-17-esperado.json');
const NA_APP = { 'Peso morto convencional': 'Deadlift', 'Supino plano com barra': 'Flat Barbell Bench Press',
  'Agachamento com barra livre': 'Barbell Squat', 'Press de ombro com barra': 'Barbell Shoulder Press' };

const cfg2 = () => N.rodarLifts(Object.assign(copia(N.PLANO_CONFIG_PADRAO), { dataInicio: '2026-09-28', ajustes: {} }), 'AGACHAMENTO');
const cfg3 = () => N.progredirConfig(cfg2(), '2026-10-26', '2026-10-16',
  { MORTO: { estado: 'sucesso', melhor: 190 }, AGACHAMENTO: { estado: 'sem-teste' }, OMBRO: { estado: 'falhou', melhor: 55 } }, []);
const nomesDoDia = (plano, data) => {
  for (const s of plano.calendario) for (const d of Object.values(s.dias)) if (d.data === data) return d.exercicios.map(e => e.nome);
  return null;
};
const diaDe = (plano, data) => {
  for (const s of plano.calendario) for (const d of Object.values(s.dias)) if (d.data === data) return d;
  return null;
};

test('ciclo 2: a lista final de cada dia e a da tabela dele', () => {
  const r = N.aplicarManual(N.gerarPlano(cfg2()), MUD.ciclos[0].dias, cfg2());
  assert.deepEqual(r.falhas, []);
  for (const data of ['2026-10-19', '2026-10-20', '2026-10-22', '2026-10-23'])
    assert.deepEqual(nomesDoDia(r.plano, data), ESPERADO[data], data);
});

test('ciclo 3: a lista final de cada dia e a da tabela dele', () => {
  const c = cfg3();
  assert.deepEqual(c.lifts, MUD.ciclos[1].lifts);
  const r = N.aplicarManual(N.gerarPlano(c), MUD.ciclos[1].dias, c);
  assert.deepEqual(r.falhas, []);
  let total = 0;
  for (const s of r.plano.calendario) for (const d of Object.values(s.dias)) {
    assert.deepEqual(d.exercicios.map(e => e.nome), ESPERADO[d.data], d.data);
    total += d.exercicios.length;
  }
  assert.equal(total, 133 - 27, 'os 133 da tabela menos os 27 do ciclo 2');
});

test('troca A<->B no mesmo dia troca os lugares, nao volta ao inicio', () => {
  const dias = { '4|terca': { trocar: [{ de: 'Dumbbell Row', para: 'Rear Delt Machine Fly' }, { de: 'Rear Delt Machine Fly', para: 'Dumbbell Row' }] } };
  const r = N.aplicarManual(N.gerarPlano(cfg2()), dias, cfg2());
  assert.deepEqual(nomesDoDia(r.plano, '2026-10-20').slice(2, 4), ['Rear Delt Machine Fly', 'Dumbbell Row']);
});

test('carga: do catalogo pela regra dos acessorios; fora do catalogo, a que vem no ficheiro', () => {
  const c = cfg2(), r = N.aplicarManual(N.gerarPlano(c), MUD.ciclos[0].dias, c);
  const seg = diaDe(r.plano, '2026-10-19').exercicios;
  const leg = seg.find(e => e.nome === 'Leg Curl Machine');
  assert.equal(leg.grupo, 'perna');
  assert.equal(leg.categoria, 'perna');
  // Leg Curl Machine no catalogo: 27,5 kg -> 25x8 e 30x6 num dia que nao e sexta
  assert.deepEqual(leg.series, [[25, 8], [30, 6]]);
  const sdp = seg.find(e => e.nome === 'Seated Dumbbell Press');
  assert.deepEqual(sdp.series, [[52.5, 8], [57.5, 6]]);
  assert.equal(sdp.categoria, 'empurrar');
});

test('o que nao encaixa diz-se e o resto do dia fica', () => {
  const p = N.gerarPlano(cfg2());
  const r = N.aplicarManual(p, {
    '4|segunda': { lift: 'MORTO', trocar: [{ de: 'Leg Press', para: 'Lungees' }] },
    '4|terca': { tirar: ['Nao Existe'], trocar: [{ de: 'Outro', para: 'Lungees' }, { de: 'Dumbbell Row', para: 'Sem Catalogo' }],
      novos: [{ nome: 'Lungees', depois: 'Fantasma' }] }
  }, cfg2());
  assert.equal(r.falhas.length, 5);
  assert.match(r.falhas[0], /eram para MORTO/);
  assert.deepEqual(nomesDoDia(r.plano, '2026-10-19'), nomesDoDia(p, '2026-10-19'), 'lift diferente: o dia fica');
  const ter = nomesDoDia(r.plano, '2026-10-20');
  assert.equal(ter[ter.length - 1], 'Lungees', 'depois de um nome que nao ha: vai para o fim');
  assert.ok(ter.includes('Dumbbell Row'), 'sem carga: fica o que estava');
  assert.deepEqual(N.gerarPlano(cfg2()), p, 'o plano de entrada nao muda');
});

/* Uma app com o ciclo 2 gravado e nada feito. */
function appCom(rec) {
  const p = N.gerarPlano(rec.cfg), nomes = new Set(['Seated Dumbbell Press']);
  p.calendario.forEach(s => Object.values(s.dias).forEach(d => d.exercicios.forEach(e => nomes.add(NA_APP[e.nome] || e.nome))));
  N.PLANO_CONFIG_PADRAO.acc.forEach(a => nomes.add(a[0]));
  const exercicios = [...nomes].map((nome, i) => ({ id: i + 1, nome, tipo: nome === 'Plank' ? 'peso_tempo' : 'peso_reps' }));
  const r = N.planoParaSessoes(p, exercicios, [], { sessao: 1, serie: 1 });
  return { exercicios, sessoes: r.sessoes, series: r.series };
}

test('series: so os dias mudados de hoje em diante; num dia comecado a serie feita fica', () => {
  const rec = { dataInicio: '2026-09-28', cfg: cfg2(), gravado: null };
  const app = appCom(rec);
  const comMudancas = Object.assign({}, rec, { manual: MUD.ciclos[0].dias });
  const sessao = data => app.sessoes.find(s => s.data === data);
  const feita = app.series.find(s => s.sessaoId === sessao('2026-10-23').id);
  feita.feita = true;   // sexta ja comecada
  const mapa = N.mapaDoPlano([comMudancas], app.sessoes);
  const prox = Math.max(...app.series.map(s => s.id)) + 1;
  const r = N.seriesDoManual(mapa, app.series, app.exercicios, 0, '2026-10-17', prox);

  assert.deepEqual(r.emFalta, []);
  assert.deepEqual(r.comFeitas, ['2026-10-23']);
  assert.deepEqual(r.dias, ['2026-10-19', '2026-10-20', '2026-10-22', '2026-10-23']);
  const apagadas = new Set(r.apagar);
  const doDia = data => app.series.filter(s => s.sessaoId === sessao(data).id);
  const inteiros = ['2026-10-19', '2026-10-20', '2026-10-22'];
  assert.equal(r.apagar.filter(i => inteiros.includes(app.series.find(s => s.id === i).data)).length,
    inteiros.reduce((t, d) => t + doDia(d).length, 0));
  assert.ok(!apagadas.has(feita.id));
  assert.ok(app.series.filter(s => s.data < '2026-10-17').every(s => !apagadas.has(s.id)));
  assert.deepEqual(r.novas.map(s => s.id), r.novas.map((_, i) => prox + i));

  // a terca refeita: exercicios pela ordem nova, series com as cargas do plano mudado
  const nome = id => app.exercicios.find(e => e.id === id).nome;
  const ter = r.novas.filter(s => s.data === '2026-10-20');
  const ordem = [...new Map(ter.map(s => [s.ordemExercicio, nome(s.exercicioId)])).values()];
  assert.deepEqual(ordem, ESPERADO['2026-10-20'].map(n => NA_APP[n] || n));
  assert.deepEqual(ter.map(s => s.ordem), ter.map((_, i) => i));
  assert.ok(ter.every(s => s.sessaoId === sessao('2026-10-20').id && !s.feita));
  const dips = ter.filter(s => nome(s.exercicioId) === 'Chest Dips').map(s => [s.peso, s.reps]);
  assert.deepEqual(dips, [[0, 8], [0, 6]], 'Chest Dips do catalogo padrao: 0 kg');
});

test('series: dia ja comecado muda so o que esta por fazer (19/10/2026)', () => {
  const rec = { dataInicio: '2026-09-28', cfg: cfg2(), gravado: null };
  const app = appCom(rec);
  const sessao = data => app.sessoes.find(s => s.data === data);
  const nome = id => app.exercicios.find(e => e.id === id).nome;
  const id = n => app.exercicios.find(e => e.nome === n).id;
  const seg = app.series.filter(s => s.sessaoId === sessao('2026-10-19').id);
  // feito: o supino todo e a 1.a serie do Smith Squat (sai na tabela)
  seg.filter(s => nome(s.exercicioId) === 'Flat Barbell Bench Press').forEach(s => { s.feita = true; });
  seg.find(s => nome(s.exercicioId) === 'Smith Squat').feita = true;
  const antes = copia(seg);
  const mapa = N.mapaDoPlano([Object.assign({}, rec, { manual: MUD.ciclos[0].dias })], app.sessoes);
  const prox = Math.max(...app.series.map(s => s.id)) + 1;
  const r = N.seriesDoManual(mapa, app.series, app.exercicios, 0, '2026-10-19', prox);

  assert.deepEqual(r.comFeitas, ['2026-10-19']);
  assert.ok(r.dias.includes('2026-10-19'));
  const apagadas = new Set(r.apagar);
  const novasSeg = r.novas.filter(s => s.data === '2026-10-19');
  // nenhuma serie feita sai, e o Smith Squat comecado fica inteiro
  assert.ok(antes.filter(s => s.feita).every(s => !apagadas.has(s.id)));
  assert.ok(antes.filter(s => s.exercicioId === id('Smith Squat')).every(s => !apagadas.has(s.id)));
  // Leg Press e Lateral Machine Raise (por fazer, fora da lista) saem
  for (const n of ['Leg Press', 'Lateral Machine Raise'])
    assert.ok(antes.filter(s => s.exercicioId === id(n)).every(s => apagadas.has(s.id)), n);
  // so isto sai: o que fica na lista e por fazer nao se mexe
  const sai = antes.filter(s => apagadas.has(s.id)).map(s => nome(s.exercicioId));
  assert.deepEqual([...new Set(sai)].sort(), ['Lateral Machine Raise', 'Leg Press']);
  // entram os 3 novos, com as cargas do plano mudado, por fazer
  const entra = {};
  novasSeg.forEach(s => (entra[nome(s.exercicioId)] = entra[nome(s.exercicioId)] || []).push([s.peso, s.reps]));
  assert.deepEqual(Object.keys(entra).sort(), ['Leg Curl Machine', 'Lungees', 'Seated Dumbbell Press']);
  assert.deepEqual(entra['Leg Curl Machine'], [[25, 8], [30, 6]]);
  assert.ok(novasSeg.every(s => !s.feita && s.sessaoId === sessao('2026-10-19').id));
  // as novas vao depois das que ja la estavam, e na posicao da lista nova
  const maxOrdem = Math.max(...antes.map(s => s.ordem));
  assert.ok(novasSeg.every(s => s.ordem > maxOrdem));
  const pos = ESPERADO['2026-10-19'].map(n => NA_APP[n] || n);
  novasSeg.forEach(s => assert.equal(s.ordemExercicio, pos.indexOf(nome(s.exercicioId))));
  assert.deepEqual(r.novas.map(s => s.id), r.novas.map((_, i) => prox + i));

  // importar outra vez nao duplica nem apaga nada
  const depois = app.series.filter(s => !apagadas.has(s.id)).concat(r.novas);
  const r2 = N.seriesDoManual(mapa, depois, app.exercicios, 0, '2026-10-19', prox + r.novas.length);
  assert.equal(r2.novas.filter(s => s.data === '2026-10-19').length, 0);
  assert.ok(r2.apagar.every(i => depois.find(s => s.id === i).data !== '2026-10-19'));
});

test('series: falta um exercicio na app, nada se mexe', () => {
  const rec = { dataInicio: '2026-09-28', cfg: cfg2(), gravado: null };
  const app = appCom(rec);
  const sem = app.exercicios.filter(e => e.nome !== 'Seated Dumbbell Press');
  const mapa = N.mapaDoPlano([Object.assign({}, rec, { manual: MUD.ciclos[0].dias })], app.sessoes);
  const r = N.seriesDoManual(mapa, app.series, sem, 0, '2026-10-17', 99999);
  assert.deepEqual(r.emFalta, ['Seated Dumbbell Press']);
  assert.deepEqual(r.apagar, []);
  assert.deepEqual(r.novas, []);
});

test('o mapa do plano mostra as mudancas; sem elas, o plano gerado', () => {
  const rec = { dataInicio: '2026-09-28', cfg: cfg2(), gravado: null };
  const sem = N.mapaDoPlano([rec], []);
  const com = N.mapaDoPlano([Object.assign({}, rec, { manual: MUD.ciclos[0].dias })], []);
  const ex = (m, data) => m[0].dias.find(d => d.data === data).exercicios.map(e => e.nome);
  assert.deepEqual(ex(com, '2026-10-19'), ESPERADO['2026-10-19']);
  assert.deepEqual(ex(sem, '2026-10-19'), nomesDoDia(N.gerarPlano(cfg2()), '2026-10-19'));
  assert.notDeepEqual(ex(sem, '2026-10-19'), ex(com, '2026-10-19'));
});

test('o backup leva as mudancas do ciclo seguinte', () => {
  assert.ok(N.DEFINICOES_NO_BACKUP.includes('planoManualSeguinte'));
});

test('series: um dia sem mudancas e um dia que ja passou ficam', () => {
  const rec = { dataInicio: '2026-09-28', cfg: cfg2(), gravado: null };
  const app = appCom(rec);
  const manual = copia({ '3|segunda': MUD.ciclos[0].dias['4|segunda'], '4|terca': MUD.ciclos[0].dias['4|terca'] });
  delete manual['3|segunda'].lift;
  const mapa = N.mapaDoPlano([Object.assign({}, rec, { manual })], app.sessoes);
  const r = N.seriesDoManual(mapa, app.series, app.exercicios, 0, '2026-10-17', 99999);
  assert.deepEqual(r.dias, ['2026-10-20'], 'so a terca: 12/10 ja passou e 19/10 nao tem mudancas');
  assert.ok(r.novas.every(s => s.data === '2026-10-20'));
});

test('carga de um exercicio do catalogo e sempre a da regra, mesmo que o ficheiro traga outra', () => {
  const dias = { '4|segunda': { trocar: [{ de: 'Leg Press', para: 'Leg Curl Machine', series: [[1, 1], [1, 1]] }] } };
  const r = N.aplicarManual(N.gerarPlano(cfg2()), dias, cfg2());
  assert.deepEqual(diaDe(r.plano, '2026-10-19').exercicios.find(e => e.nome === 'Leg Curl Machine').series, [[25, 8], [30, 6]]);
});

test('o lift do dia nao se troca nem se tira', () => {
  const p = N.gerarPlano(cfg2());
  const r = N.aplicarManual(p, { '4|segunda': { trocar: [{ de: 'Supino plano com barra', para: 'Chest Dips' }],
    tirar: ['Supino plano com barra'] } }, cfg2());
  assert.equal(r.falhas.length, 2);
  assert.deepEqual(nomesDoDia(r.plano, '2026-10-19'), nomesDoDia(p, '2026-10-19'));
});
