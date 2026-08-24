/**
 * Leitor de CSV e importador do FitNotes.
 *
 * O teste que vale mais e o ultimo bloco: corre contra o ficheiro real de
 * 1,6 MB exportado do FitNotes e exige os numeros exactos do historico.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { nucleo } from './nucleo.mjs';
import { csv, ESPERADO, SEM_DADOS } from './dados.mjs';

const {
  analisarCsv, detetarSeparador, detetarColunas, pareceCabecalho,
  analisarData, detetarOrdemDatas, analisarTempo, analisarNumero,
  importarFitNotes, LBS_PARA_KG, traduzirGrupo
} = nucleo;

/* ---------------------------------------------------------------- leitor */

test('leitor: linha simples', () => {
  const r = analisarCsv('a,b,c\n1,2,3\n');
  assert.deepEqual(r.linhas, [['a', 'b', 'c'], ['1', '2', '3']]);
  assert.equal(r.separador, ',');
});

test('leitor: campo entre aspas com virgula la dentro', () => {
  const r = analisarCsv('a,b\n1,"tres, quatro"\n');
  assert.deepEqual(r.linhas[1], ['1', 'tres, quatro']);
});

test('leitor: campo entre aspas com MUDANCA DE LINHA la dentro', () => {
  // Isto e o caso que parte um split(): o export real tem 64 notas assim.
  const r = analisarCsv('a,b\n1,"30s descanso\n2s pico"\n');
  assert.equal(r.linhas.length, 2, 'a nota nao pode virar duas linhas');
  assert.equal(r.linhas[1][1], '30s descanso\n2s pico');
});

test('leitor: aspas duplicadas sao uma aspa a serio', () => {
  const r = analisarCsv('a\n"ele disse ""ja"""\n');
  assert.equal(r.linhas[1][0], 'ele disse "ja"');
});

test('leitor: aceita ; e tab como separador', () => {
  assert.equal(detetarSeparador('a;b;c\n'), ';');
  assert.equal(detetarSeparador('a\tb\tc\n'), '\t');
  assert.deepEqual(analisarCsv('a;b\n1;2\n').linhas[1], ['1', '2']);
});

test('leitor: nao se engana com um separador que so aparece dentro de aspas', () => {
  assert.equal(detetarSeparador('"a;b;c;d",x\n'), ',');
});

test('leitor: come o BOM do Excel', () => {
  const r = analisarCsv('﻿Date,Exercise\n2020-01-13,Agachamento\n');
  assert.equal(r.linhas[0][0], 'Date', 'o BOM nao pode colar-se ao primeiro cabecalho');
});

test('leitor: linhas vazias e CRLF nao criam registos', () => {
  const r = analisarCsv('a,b\r\n1,2\r\n\r\n\r\n');
  assert.equal(r.linhas.length, 2);
  assert.equal(r.linhas[1][1], '2', 'o \\r nao pode ficar colado ao valor');
});

test('leitor: entrada que nao e texto nao rebenta', () => {
  assert.deepEqual(analisarCsv(null).linhas, []);
  assert.deepEqual(analisarCsv(undefined).linhas, []);
  assert.deepEqual(analisarCsv(123).linhas, []);
});

/* --------------------------------------------------------------- colunas */

test('colunas: cabecalho real do FitNotes de iPhone', () => {
  const cab = ['Date', 'Exercise', 'Category', 'Weight (kg)', 'Weight (lbs)',
    'Reps', 'Distance', 'Distance Unit', 'Time', 'Notes', 'Kind'];
  const c = detetarColunas(cab);
  assert.equal(c.data, 0);
  assert.equal(c.exercicio, 1);
  assert.equal(c.categoria, 2);
  assert.equal(c.pesoKg, 3);
  assert.equal(c.pesoLbs, 4);
  assert.equal(c.reps, 5);
  assert.equal(c.tempo, 8);
  assert.equal(c.nota, 9, 'no iPhone a coluna chama-se Notes, nao Comment');
  assert.equal(c.tipo, 10);
  assert.equal(c.peso, -1, 'o "Weight" generico nao pode roubar a coluna de kg');
  assert.ok(pareceCabecalho(cab));
});

test('colunas: cabecalho do FitNotes de Android', () => {
  const cab = ['Date', 'Exercise', 'Category', 'Weight', 'Weight Unit',
    'Reps', 'Distance', 'Distance Unit', 'Time', 'Comment'];
  const c = detetarColunas(cab);
  assert.equal(c.peso, 3);
  assert.equal(c.unidadePeso, 4);
  assert.equal(c.nota, 9, 'no Android chama-se Comment');
  assert.equal(c.pesoKg, -1);
});

test('colunas: cabecalho em portugues e com acentos', () => {
  const c = detetarColunas(['Data', 'Exercício', 'Categoria', 'Peso (kg)', 'Repetições', 'Nota']);
  assert.equal(c.data, 0);
  assert.equal(c.exercicio, 1);
  assert.equal(c.pesoKg, 3);
  assert.equal(c.reps, 4);
});

test('colunas: uma primeira linha de dados nao passa por cabecalho', () => {
  assert.equal(pareceCabecalho(['2020-01-13', 'Supino', 'Chest', '70', 'kg', '5']), false);
});

/* ----------------------------------------------------------------- datas */

test('datas: formato ISO', () => {
  assert.equal(analisarData('2020-01-13', 'iso'), '2020-01-13');
  assert.equal(analisarData('2020/01/13', 'iso'), '2020-01-13');
  assert.equal(analisarData('2020-1-3', 'iso'), '2020-01-03');
  assert.equal(analisarData('2026-08-07 18:30', 'iso'), '2026-08-07', 'a hora e deitada fora');
  assert.equal(analisarData('2026-08-07T18:30:00', 'iso'), '2026-08-07');
});

test('datas: dd/mm e mm/dd dao dias diferentes', () => {
  assert.equal(analisarData('03/04/2026', 'dmy'), '2026-04-03');
  assert.equal(analisarData('03/04/2026', 'mdy'), '2026-03-04');
  assert.equal(analisarData('13-01-2020', 'dmy'), '2020-01-13');
  assert.equal(analisarData('13.01.2020', 'dmy'), '2020-01-13');
});

test('datas: ano com dois digitos', () => {
  assert.equal(analisarData('13/01/20', 'dmy'), '2020-01-13');
  assert.equal(analisarData('13/01/99', 'dmy'), '1999-01-13');
});

test('datas: datas que nao existem sao recusadas', () => {
  assert.equal(analisarData('31/02/2026', 'dmy'), null, '31 de Fevereiro');
  assert.equal(analisarData('2026-02-30', 'iso'), null);
  assert.equal(analisarData('2026-13-01', 'iso'), null, 'mes 13');
  assert.equal(analisarData('ontem', 'dmy'), null);
  assert.equal(analisarData('', 'dmy'), null);
  assert.equal(analisarData(null, 'dmy'), null);
});

test('datas: descobrir a ordem olhando para o ficheiro todo', () => {
  assert.equal(detetarOrdemDatas(['2020-01-13', '2020-01-14']).ordem, 'iso');

  // 25 no primeiro lugar so pode ser dia.
  const d = detetarOrdemDatas(['03/04/2026', '25/04/2026']);
  assert.equal(d.ordem, 'dmy');
  assert.equal(d.ambigua, false);

  // 25 no segundo lugar so pode ser dia, logo o primeiro e o mes.
  const m = detetarOrdemDatas(['04/03/2026', '04/25/2026']);
  assert.equal(m.ordem, 'mdy');
  assert.equal(m.ambigua, false);

  // Nenhuma passa de 12: e mesmo indecidivel, e tem de o dizer.
  const a = detetarOrdemDatas(['03/04/2026', '05/06/2026']);
  assert.equal(a.ambigua, true);
  assert.equal(a.ordem, 'dmy', 'na duvida assume-se o formato portugues');

  // As duas posicoes passam de 12: o ficheiro esta incoerente.
  const c = detetarOrdemDatas(['25/04/2026', '04/25/2026']);
  assert.equal(c.conflito, true);
});

/* --------------------------------------------------------- tempo e numero */

test('tempo: mm:ss e hh:mm:ss', () => {
  // Conferido contra a coluna ZTIME da base, que guarda segundos:
  // o CSV escreve 10:00 onde a base tem 600.
  assert.equal(analisarTempo('10:00'), 600);
  assert.equal(analisarTempo('01:00'), 60);
  assert.equal(analisarTempo('15:00'), 900);
  assert.equal(analisarTempo('00:45'), 45);
  assert.equal(analisarTempo('01:30:00'), 5400);
  assert.equal(analisarTempo('600'), 600, 'ja em segundos');
  assert.equal(analisarTempo('1h 30m'), 5400);
  assert.equal(analisarTempo('90s'), 90);
  assert.equal(analisarTempo(''), null);
  assert.equal(analisarTempo('depressa'), null);
});

test('numeros: virgula e ponto decimal valem o mesmo', () => {
  assert.equal(analisarNumero('12.5'), 12.5);
  assert.equal(analisarNumero('12,5'), 12.5);
  assert.equal(analisarNumero('70.00'), 70);
  assert.equal(analisarNumero(' 8 '), 8);
  assert.equal(analisarNumero('0.00'), 0);
  assert.equal(analisarNumero(''), null);
  assert.equal(analisarNumero('muito'), null);
  assert.equal(analisarNumero('12kg'), null, 'nao se adivinha o que esta colado');
});

test('grupos: ingles e espanhol caem no mesmo grupo portugues', () => {
  assert.equal(traduzirGrupo('Chest'), 'Peito');
  assert.equal(traduzirGrupo('Pecho'), 'Peito');
  assert.equal(traduzirGrupo('Legs'), 'Pernas');
  assert.equal(traduzirGrupo('Biceps'), 'Bíceps');
  assert.equal(traduzirGrupo('Bíceps'), 'Bíceps', 'com acento tem de dar o mesmo');
  assert.equal(traduzirGrupo('Abs'), 'Abdominais');
  assert.equal(traduzirGrupo(''), 'Outros');
  assert.equal(traduzirGrupo('Antebraço'), 'Antebraço', 'o que nao conheco fica como veio');
});

/* ------------------------------------------------------------ importador */

const CAB_IPHONE = 'Date,Exercise,Category,Weight (kg),Weight (lbs),Reps,Distance,Distance Unit,Time,Notes,Kind';

test('importador: caso normal do iPhone', () => {
  const r = importarFitNotes(CAB_IPHONE + '\n' +
    '2020-01-13,Incline Barbell Bench Press,Chest,70.00,154.32,5,,,,,wr\n' +
    '2020-01-13,Incline Barbell Bench Press,Chest,70.00,154.32,5,,,,,wr\n' +
    '2020-01-14,Crunch,Abs,0.00,0.00,35,,,,,wr\n');
  assert.equal(r.series.length, 3);
  assert.equal(r.sessoes.length, 2);
  assert.equal(r.exercicios.length, 2);
  assert.equal(r.series[0].peso, 70, 'le a coluna em kg, sem converter nada');
  assert.equal(r.series[0].reps, 5);
  assert.equal(r.series[2].peso, 0, 'peso corporal fica em 0, nao em null');
  assert.equal(r.exercicios.find(e => e.nome === 'Crunch').grupo, 'Abdominais');
  assert.equal(r.resumo.de, '2020-01-13');
  assert.equal(r.resumo.ate, '2020-01-14');
});

test('importador: os tres tipos de serie do FitNotes', () => {
  const r = importarFitNotes(CAB_IPHONE + '\n' +
    '2020-09-30,Stationary Bike,Cardio,,,,0.00,m,10:00,,dt\n' +
    '2021-08-31,Side Plank,Abs,0.00,0.00,,,,01:00,,wt\n' +
    '2020-01-13,Squat,Legs,100.00,220.46,5,,,,,wr\n');
  assert.equal(r.series.length, 3, 'nenhum dos tres tipos pode ser deitado fora');
  const bike = r.series.find(s => s.tempoSeg === 600);
  assert.ok(bike, 'a serie de cardio tem de sobreviver');
  assert.equal(r.series.find(s => s.reps === 5).peso, 100);
  const plank = r.series.find(s => s.tempoSeg === 60);
  assert.ok(plank, 'a prancha tem de sobreviver');
  assert.equal(plank.reps, null);
});

test('importador: converte libras quando so ha libras', () => {
  const r = importarFitNotes('Date,Exercise,Category,Weight,Weight Unit,Reps,Comment\n' +
    '2020-01-13,Bench,Chest,225,lbs,5,\n' +
    '2020-01-14,Bench,Chest,100,kg,5,\n');
  assert.ok(Math.abs(r.series[0].peso - 225 * LBS_PARA_KG) < 1e-9);
  assert.ok(Math.abs(r.series[0].peso - 102.0582) < 0.001);
  assert.equal(r.series[1].peso, 100, 'a linha em kg nao pode ser convertida');
});

test('importador: com as duas colunas de peso usa a de kg', () => {
  // Se usasse a de libras e convertesse, dava 70,0000 na mesma — mas por um
  // caminho que perde precisao. Este teste fixa qual das duas e lida.
  const r = importarFitNotes(CAB_IPHONE + '\n' +
    '2020-01-13,Bench,Chest,70.00,154.32,5,,,,,wr\n');
  assert.equal(r.series[0].peso, 70, 'exactamente 70, sem arredondamentos de conversao');
});

test('importador: ficheiro sem cabecalho nenhum', () => {
  const r = importarFitNotes('2020-01-13,Squat,Legs,100,kg,5,,,,\n' +
    '2020-01-13,Squat,Legs,100,kg,5,,,,\n');
  assert.equal(r.series.length, 2);
  assert.equal(r.series[0].peso, 100);
  assert.ok(r.avisos.some(a => a.tipo === 'sem-cabecalho'), 'tem de avisar que adivinhou');
});

test('importador: linhas mal formadas sao postas de lado, nao rebentam', () => {
  const r = importarFitNotes(CAB_IPHONE + '\n' +
    '2020-01-13,Squat,Legs,100.00,220.46,5,,,,,wr\n' +
    'lixo,,,,,,,,,,\n' +                                        // data ilegivel
    '2020-01-13,,Legs,100.00,220.46,5,,,,,wr\n' +               // sem exercicio
    '2020-01-13,Squat,Legs,100.00,220.46,,,,,,wr\n' +           // sem reps/tempo/distancia
    '2020-01-14,Squat,Legs,105.00,231.48,5,,,,,wr\n');
  assert.equal(r.series.length, 2, 'so as duas linhas boas passam');
  assert.equal(r.resumo.ignoradas, 3);
  assert.ok(r.avisos.some(a => a.tipo === 'linhas-ignoradas'));
  assert.equal(r.ignoradas[0].motivo, 'data ilegível');
});

test('importador: separador ; e virgula decimal', () => {
  const r = importarFitNotes('Date;Exercise;Category;Weight (kg);Reps\n' +
    '2020-01-13;Squat;Legs;102,5;5\n');
  assert.equal(r.series.length, 1);
  assert.equal(r.series[0].peso, 102.5);
});

test('importador: nota com mudanca de linha chega inteira', () => {
  const r = importarFitNotes(CAB_IPHONE + '\n' +
    '2021-05-12,Seated Cable Row,Back,32.00,70.55,10,,,,"30s descanso\n2s pico",wr\n');
  assert.equal(r.series.length, 1, 'a nota nao pode partir a linha em duas');
  assert.equal(r.series[0].nota, '30s descanso\n2s pico');
});

test('importador: ficheiro vazio ou sem colunas obrigatorias', () => {
  assert.ok(importarFitNotes('').avisos.some(a => a.tipo === 'vazio'));
  const r = importarFitNotes('Peso,Reps\n100,5\n');
  assert.ok(r.avisos.some(a => a.tipo === 'colunas'));
  assert.equal(r.series.length, 0);
});

test('importador: reconstroi a ordem das series dentro do dia', () => {
  const r = importarFitNotes(CAB_IPHONE + '\n' +
    '2020-01-13,Squat,Legs,100.00,0,5,,,,,wr\n' +
    '2020-01-13,Squat,Legs,100.00,0,5,,,,,wr\n' +
    '2020-01-13,Bench,Chest,80.00,0,5,,,,,wr\n');
  assert.deepEqual(r.series.map(s => s.ordem), [0, 1, 2]);
  assert.deepEqual(r.series.map(s => s.ordemExercicio), [0, 0, 1]);
});

/* ------------------------------------------------- o ficheiro real do BB */

test('ficheiro real do FitNotes: os numeros tem de bater certo', SEM_DADOS, () => {
  const r = importarFitNotes(csv());

  assert.equal(r.series.length, ESPERADO.series, 'total de series');
  assert.equal(r.sessoes.length, ESPERADO.sessoes, 'dias de treino');
  assert.equal(r.exercicios.length, ESPERADO.exercicios, 'exercicios distintos');
  assert.equal(r.resumo.de, ESPERADO.de);
  assert.equal(r.resumo.ate, ESPERADO.ate);
  assert.equal(r.resumo.ignoradas, 0, 'nao pode perder-se nenhuma linha');
  assert.equal(r.ordemDatas.ordem, 'iso');
});

test('ficheiro real: as 64 notas com mudanca de linha chegam inteiras', SEM_DADOS, () => {
  const r = importarFitNotes(csv());
  const partidas = r.series.filter(s => s.nota && s.nota.includes('\n'));
  assert.equal(partidas.length, ESPERADO.notasMultiLinha,
    'um split() por linha daria 0 aqui e 128 linhas de lixo no ficheiro');
});

test('ficheiro real: as categorias caem todas em grupos portugueses', SEM_DADOS, () => {
  const r = importarFitNotes(csv());
  const grupos = [...new Set(r.exercicios.map(e => e.grupo))].sort();
  assert.deepEqual(grupos, ESPERADO.categorias);
});

test('ficheiro real: o cardio e as pranchas nao se perdem', SEM_DADOS, () => {
  const r = importarFitNotes(csv());
  const comTempo = r.series.filter(s => s.tempoSeg !== null);
  assert.equal(comTempo.length, 175, '117 de cardio + 58 de prancha');
  const comDistancia = r.series.filter(s => s.distancia !== null);
  assert.equal(comDistancia.length, 117);
});

test('ficheiro real: o historico nao traz RIR nenhum', SEM_DADOS, () => {
  // Nao e um defeito: o FitNotes tem a coluna mas nunca a preencheu.
  // As analises de esforco so comecam a contar a partir da app nova.
  const r = importarFitNotes(csv());
  assert.equal(r.series.filter(s => s.rir !== null).length, ESPERADO.seriesComRir);
});
