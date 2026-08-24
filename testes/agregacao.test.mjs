/**
 * Volume e numero de series por semana e por grupo muscular.
 *
 * Os valores esperados do historico real nao foram copiados do que este codigo
 * devolve: foram calculados por SQL directamente na base do FitNotes, num
 * caminho que nao passa por nenhuma linha do index.html.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { nucleo } from './nucleo.mjs';
import { backup, csv, SEM_DADOS } from './dados.mjs';

const {
  agregarPorPeriodo, chaveSemanaIso, segundaDaSemana, chaveMes, diasEntre,
  mediaRir, progressaoExercicio, importarFitNotes
} = nucleo;

const perto = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) < tol,
  `esperava ${b}, veio ${a}`);

/* ------------------------------------------------------- semanas ISO */

test('semana ISO: comeca a segunda-feira', () => {
  assert.equal(segundaDaSemana('2026-08-24'), '2026-08-24', 'uma segunda e a sua propria segunda');
  assert.equal(segundaDaSemana('2026-08-30'), '2026-08-24', 'domingo pertence a semana que comecou na 2.a');
  assert.equal(segundaDaSemana('2026-08-23'), '2026-08-17');
});

test('semana ISO: a semana 1 e a que tem a primeira quinta-feira', () => {
  // 2021-01-01 foi sexta: pertence a semana 53 de 2020.
  assert.equal(chaveSemanaIso('2021-01-01'), '2020-W53');
  assert.equal(chaveSemanaIso('2021-01-04'), '2021-W01');
  // 2020-01-13, o primeiro treino do historico, caiu na semana 3.
  assert.equal(chaveSemanaIso('2020-01-13'), '2020-W03');
  // 2026-12-31 e uma quinta: semana 53 de 2026.
  assert.equal(chaveSemanaIso('2026-12-31'), '2026-W53');
});

test('semana ISO: a virada do ano nao inventa semanas', () => {
  assert.equal(chaveSemanaIso('2019-12-30'), '2020-W01', 'segunda ja da semana 1 de 2020');
  assert.equal(chaveMes('2026-08-07'), '2026-08');
  assert.equal(diasEntre('2020-01-13', '2020-01-20'), 7);
  assert.equal(diasEntre('2026-03-28', '2026-03-30'), 2, 'a mudanca da hora nao pode roubar um dia');
});

/* --------------------------------------------------------- agregacao */

const EX = [
  { id: 1, nome: 'Supino', grupo: 'Peito' },
  { id: 2, nome: 'Agachamento', grupo: 'Pernas' },
  { id: 3, nome: 'Flexões', grupo: 'Peito' }
];

test('volume = reps x peso, somado por grupo', () => {
  const r = agregarPorPeriodo([
    { exercicioId: 1, data: '2026-08-24', peso: 100, reps: 5 },   // 500
    { exercicioId: 1, data: '2026-08-26', peso: 100, reps: 5 },   // 500
    { exercicioId: 2, data: '2026-08-25', peso: 140, reps: 8 }    // 1120
  ], EX, { periodo: 'semana' });

  assert.equal(r.length, 1, 'os tres dias caem na mesma semana');
  assert.equal(r[0].chave, '2026-W35');
  assert.equal(r[0].inicio, '2026-08-24');
  assert.equal(r[0].grupos.Peito.volume, 1000);
  assert.equal(r[0].grupos.Peito.series, 2);
  assert.equal(r[0].grupos.Pernas.volume, 1120);
  assert.equal(r[0].total.volume, 2120);
  assert.equal(r[0].total.series, 3);
  assert.equal(r[0].total.reps, 18);
});

test('peso corporal conta como serie mas nao soma volume', () => {
  const r = agregarPorPeriodo([
    { exercicioId: 3, data: '2026-08-24', peso: 0, reps: 20 }
  ], EX, { periodo: 'semana' });
  assert.equal(r[0].grupos.Peito.series, 1, 'a serie tem de contar');
  assert.equal(r[0].grupos.Peito.volume, 0, 'mas nao inventa peso');
  assert.equal(r[0].grupos.Peito.reps, 20);
});

test('semanas diferentes ficam em baldes diferentes e por ordem', () => {
  const r = agregarPorPeriodo([
    { exercicioId: 1, data: '2026-08-31', peso: 100, reps: 5 },
    { exercicioId: 1, data: '2026-08-24', peso: 100, reps: 5 }
  ], EX, { periodo: 'semana' });
  assert.equal(r.length, 2);
  assert.deepEqual(r.map(b => b.chave), ['2026-W35', '2026-W36'], 'sempre por ordem de data');
});

test('agregacao por mes', () => {
  const r = agregarPorPeriodo([
    { exercicioId: 1, data: '2026-07-31', peso: 100, reps: 5 },
    { exercicioId: 1, data: '2026-08-01', peso: 100, reps: 5 }
  ], EX, { periodo: 'mes' });
  assert.deepEqual(r.map(b => b.chave), ['2026-07', '2026-08']);
  assert.equal(r[0].inicio, '2026-07-01');
});

test('filtro por intervalo de datas', () => {
  const series = [
    { exercicioId: 1, data: '2026-01-05', peso: 100, reps: 5 },
    { exercicioId: 1, data: '2026-08-24', peso: 100, reps: 5 }
  ];
  assert.equal(agregarPorPeriodo(series, EX, { de: '2026-06-01' }).length, 1);
  assert.equal(agregarPorPeriodo(series, EX, { ate: '2026-06-01' }).length, 1);
  assert.equal(agregarPorPeriodo(series, EX, {}).length, 2);
});

test('exercicio sem grupo conhecido cai em Outros', () => {
  const r = agregarPorPeriodo([{ exercicioId: 99, data: '2026-08-24', peso: 50, reps: 10 }],
    EX, { periodo: 'semana' });
  assert.equal(r[0].grupos.Outros.volume, 500);
});

test('series sem data sao ignoradas em vez de rebentar', () => {
  const r = agregarPorPeriodo([
    { exercicioId: 1, data: null, peso: 100, reps: 5 },
    { exercicioId: 1, data: '2026-08-24', peso: 100, reps: 5 }
  ], EX, {});
  assert.equal(r.length, 1);
  assert.equal(r[0].total.series, 1);
});

/* --------------------------------------------------------------- RIR */

test('RIR: media por sessao e no conjunto, saltando as series sem RIR', () => {
  const r = mediaRir([
    { exercicioId: 1, data: '2026-08-24', rir: 2 },
    { exercicioId: 1, data: '2026-08-24', rir: 0 },
    { exercicioId: 1, data: '2026-08-24', rir: null },   // nao entra na conta
    { exercicioId: 2, data: '2026-08-26', rir: 3 }
  ]);
  assert.equal(r.comRir, 3);
  assert.equal(r.porSessao.length, 2);
  assert.equal(r.porSessao[0].media, 1, '(2 + 0) / 2');
  assert.equal(r.porSessao[0].series, 2, 'a serie sem RIR nao conta para o divisor');
  perto(r.global, 5 / 3);
  assert.equal(r.porExercicio[1].media, 1);
});

test('RIR: sem nenhum RIR devolve null, nao NaN', () => {
  const r = mediaRir([{ exercicioId: 1, data: '2026-08-24', rir: null }]);
  assert.equal(r.global, null);
  assert.equal(r.comRir, 0);
  assert.deepEqual(r.porSessao, []);
});

test('RIR: o zero conta (zero em reserva e ir ao limite)', () => {
  const r = mediaRir([{ exercicioId: 1, data: '2026-08-24', rir: 0 }]);
  assert.equal(r.comRir, 1);
  assert.equal(r.global, 0);
});

/* -------------------------------------------------------- progressao */

test('progressao: um ponto por dia, com o melhor de cada dia', () => {
  const p = progressaoExercicio([
    { exercicioId: 1, data: '2026-08-24', peso: 100, reps: 5, rir: 2 },
    { exercicioId: 1, data: '2026-08-24', peso: 105, reps: 3, rir: 0 },
    { exercicioId: 2, data: '2026-08-24', peso: 200, reps: 5, rir: 1 },   // outro exercicio
    { exercicioId: 1, data: '2026-08-31', peso: 102.5, reps: 5, rir: 1 }
  ], 1);
  assert.equal(p.length, 2);
  assert.equal(p[0].pesoMax, 105);
  assert.equal(p[0].series, 2);
  assert.equal(p[0].volume, 100 * 5 + 105 * 3);
  assert.equal(p[0].rirMedio, 1);
  assert.equal(p[1].pesoMax, 102.5);
});

/* ------------------------------------------------ contra o historico */

// Calculado por SQL na base do FitNotes, sem passar por este codigo.
// (Os valores em kg ja com a escala certa: a base guarda centesimos.)
const REAL = {
  volumeTotal: 14606423.50,
  semanas: 323,
  primeira: '2020-W03',
  ultima: '2026-W32',
  porGrupo: {
    'Abdominais': { volume: 187870.00, series: 1317, reps: 28616 },
    'Bíceps': { volume: 783077.50, series: 3122, reps: 33832 },
    'Cardio': { volume: 0, series: 65, reps: 0 },
    'Costas': { volume: 2884446.50, series: 5197, reps: 55631 },
    'Ombros': { volume: 1301887.00, series: 4093, reps: 42598 },
    'Peito': { volume: 3181872.00, series: 5847, reps: 60200 },
    'Pernas': { volume: 5307496.00, series: 6455, reps: 80363 },
    'Tríceps': { volume: 959774.50, series: 2651, reps: 28269 }
  }
};

test('historico real: volume por grupo bate com o SQL', SEM_DADOS, () => {
  const b = backup();
  const semanas = agregarPorPeriodo(b.series, b.exercicios, { periodo: 'semana' });

  assert.equal(semanas.length, REAL.semanas, 'semanas com treino');
  assert.equal(semanas[0].chave, REAL.primeira);
  assert.equal(semanas[semanas.length - 1].chave, REAL.ultima);

  const soma = {};
  let total = 0;
  semanas.forEach(s => {
    total += s.total.volume;
    Object.keys(s.grupos).forEach(g => {
      const d = soma[g] || (soma[g] = { volume: 0, series: 0, reps: 0 });
      d.volume += s.grupos[g].volume;
      d.series += s.grupos[g].series;
      d.reps += s.grupos[g].reps;
    });
  });

  perto(total, REAL.volumeTotal, 1);
  assert.deepEqual(Object.keys(soma).sort(), Object.keys(REAL.porGrupo).sort());
  Object.keys(REAL.porGrupo).forEach(g => {
    perto(soma[g].volume, REAL.porGrupo[g].volume, 1, g);
    assert.equal(soma[g].series, REAL.porGrupo[g].series, 'series de ' + g);
    assert.equal(soma[g].reps, REAL.porGrupo[g].reps, 'reps de ' + g);
  });
});

test('historico real: o CSV e a base dao o mesmo volume', SEM_DADOS, () => {
  // Duas fontes independentes: o ficheiro exportado e a base do iPhone.
  // Se divergirem, uma das duas leituras esta errada.
  const daBase = backup();
  const doCsv = importarFitNotes(csv());

  const somar = (series, exercicios) => agregarPorPeriodo(series, exercicios, { periodo: 'semana' })
    .reduce((t, s) => t + s.total.volume, 0);

  perto(somar(daBase.series, daBase.exercicios), somar(doCsv.series, doCsv.exercicios), 1);
  assert.equal(daBase.series.length, doCsv.series.length);
});

test('historico real: series por semana, medidas', SEM_DADOS, () => {
  const b = backup();
  const semanas = agregarPorPeriodo(b.series, b.exercicios, { periodo: 'semana' });
  const contas = semanas.map(s => s.total.series).sort((a, c) => a - c);

  // Valores medidos, nao inventados: a semana mais cheia foi a 2020-W08, com
  // 235 series. Servem de aviso se um dia a agregacao passar a perder series.
  assert.equal(contas[contas.length - 1], 235, 'semana mais cheia');
  assert.equal(contas[0], 8, 'semana mais vazia');
  assert.equal(contas[Math.floor(contas.length / 2)], 63, 'mediana');
  assert.ok(semanas.every(s => s.total.series > 0), 'nao ha semanas vazias na lista');
  assert.equal(contas.reduce((a, c) => a + c, 0), 28747, 'nenhuma serie se perde pelo caminho');
});
