/**
 * Recordes pessoais.
 *
 * O teste do fim e o mais importante de todo o projeto: compara a deteccao de
 * recordes com as 1187 series que o proprio FitNotes ja tinha marcado como
 * recorde de sempre (coluna ZISALLTIMERECORD da base do iPhone). E uma fonte
 * independente — nao um numero que eu tenha escrito a partir do meu proprio
 * resultado.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { nucleo } from './nucleo.mjs';
import { backup, ESPERADO, SEM_DADOS } from './dados.mjs';

const { detetarRecordes, melhoresPorExercicio, recordesPorReps, curvaRepMax,
        melhorPesoParaReps, serieFeita, agregarPorPeriodo, mediaRir,
        progressaoExercicio } = nucleo;

// Ajuda a escrever series de teste sem ruido.
let n = 0;
const serie = (data, peso, reps, exercicioId = 1) =>
  ({ id: ++n, exercicioId, data, peso, reps, ordemExercicio: 0, ordem: n });

test('a primeira serie de um exercicio e sempre recorde', () => {
  const r = detetarRecordes([serie('2026-01-01', 100, 5)]);
  assert.equal(r.length, 1);
  assert.deepEqual(r[0].tipos.sort(), ['1rm', 'peso', 'reps']);
});

test('repetir a mesma serie nao e recorde nenhum', () => {
  const r = detetarRecordes([
    serie('2026-01-01', 100, 5),
    serie('2026-01-08', 100, 5)
  ]);
  assert.equal(r.length, 1, 'so a primeira conta');
});

test('mais peso com as mesmas reps e recorde', () => {
  const r = detetarRecordes([
    serie('2026-01-01', 100, 5),
    serie('2026-01-08', 102.5, 5)
  ]);
  assert.equal(r.length, 2);
  assert.ok(r[1].tipos.includes('peso'));
});

test('mais reps com o mesmo peso e recorde', () => {
  const r = detetarRecordes([
    serie('2026-01-01', 100, 5),
    serie('2026-01-08', 100, 8)
  ]);
  assert.equal(r.length, 2);
  assert.ok(r[1].tipos.includes('1rm'));
  assert.ok(!r[1].tipos.includes('peso'), 'o peso nao subiu');
});

test('menos peso com mais reps pode ser recorde para essas reps', () => {
  const r = detetarRecordes([
    serie('2026-01-01', 100, 5),
    serie('2026-01-08', 80, 12)
  ]);
  assert.equal(r.length, 2);
  assert.ok(r[1].tipos.includes('reps'));
});

test('uma serie dominada por outra anterior NAO e recorde', () => {
  // 100 kg x 10 domina 90 kg x 8: mais peso E mais reps. Logo a segunda nao
  // pode ser recorde de nada, mesmo sendo a primeira vez com 8 reps.
  const r = detetarRecordes([
    serie('2026-01-01', 100, 10),
    serie('2026-01-08', 90, 8)
  ]);
  assert.equal(r.length, 1);
});

test('exercicios diferentes nao se contaminam', () => {
  const r = detetarRecordes([
    serie('2026-01-01', 200, 10, 1),
    serie('2026-01-02', 50, 5, 2)
  ]);
  assert.equal(r.length, 2, 'cada exercicio tem os seus recordes');
});

test('a ordem dentro do dia conta', () => {
  // Duas series no mesmo dia: a mais pesada primeiro apaga a segunda.
  const a = { id: 1, exercicioId: 1, data: '2026-01-01', peso: 100, reps: 5, ordemExercicio: 0, ordem: 0 };
  const b = { id: 2, exercicioId: 1, data: '2026-01-01', peso: 90, reps: 5, ordemExercicio: 0, ordem: 1 };
  assert.equal(detetarRecordes([b, a]).length, 1, 'a lista vem desordenada de proposito');
  assert.equal(detetarRecordes([a, b])[0].serieId, 1);
});

test('series sem peso ou sem reps ficam de fora', () => {
  const r = detetarRecordes([
    { id: 1, exercicioId: 1, data: '2026-01-01', peso: null, reps: 5 },
    { id: 2, exercicioId: 1, data: '2026-01-01', peso: 100, reps: null },
    { id: 3, exercicioId: 1, data: '2026-01-01', peso: 100, reps: 0 },
    serie('2026-01-02', 100, 5)
  ]);
  assert.equal(r.length, 1);
});

test('peso corporal (0 kg) tambem tem recordes, pelas reps', () => {
  const r = detetarRecordes([
    serie('2026-01-01', 0, 10),
    serie('2026-01-08', 0, 15)
  ]);
  assert.equal(r.length, 2, '15 flexoes batem 10 flexoes');
});

test('melhoresPorExercicio devolve a melhor marca de sempre', () => {
  const m = melhoresPorExercicio([
    serie('2026-01-01', 100, 5),
    serie('2026-01-08', 90, 12),
    serie('2026-01-15', 105, 3)
  ]);
  assert.equal(m[1].pesoMax, 105);
  assert.equal(m[1].totalSeries, 3);
  assert.equal(m[1].ultima, '2026-01-15');
  assert.equal(m[1].melhorVolumeSerie, 90 * 12);
});

/* -------------------------------- series por fazer nao contam para nada */

test('uma serie por fazer nao conta como recorde', () => {
  // Copiar um treino e planear, nao registar. Se as series copiadas
  // contassem, bastava copiar um treino que nunca se fez para inventar um PR.
  const feita = serie('2026-01-01', 100, 5);
  const porFazer = { ...serie('2026-01-08', 200, 5), feita: false };
  const r = detetarRecordes([feita, porFazer]);
  assert.equal(r.length, 1, 'so a que foi mesmo feita');
  assert.equal(r[0].serieId, feita.id);
});

test('uma serie por fazer nao entra na carga maxima', () => {
  const t = recordesPorReps([
    serie('2026-01-01', 100, 5),
    { ...serie('2026-01-08', 250, 5), feita: false }
  ], 1);
  assert.equal(t.find(l => l.reps === 5).peso, 100, '250 kg planeados nao sao 250 kg feitos');
});

test('uma serie por fazer nao soma volume nem conta como serie', () => {
  const ex = [{ id: 1, nome: 'Supino', grupo: 'Peito' }];
  const r = agregarPorPeriodo([
    { exercicioId: 1, data: '2026-08-24', peso: 100, reps: 5 },
    { exercicioId: 1, data: '2026-08-24', peso: 100, reps: 5, feita: false }
  ], ex, { periodo: 'semana' });
  assert.equal(r[0].total.series, 1);
  assert.equal(r[0].total.volume, 500);
});

test('uma serie por fazer nao entra na media de RIR', () => {
  const r = mediaRir([
    { exercicioId: 1, data: '2026-08-24', rir: 2 },
    { exercicioId: 1, data: '2026-08-24', rir: 0, feita: false }
  ]);
  assert.equal(r.comRir, 1);
  assert.equal(r.global, 2);
});

test('uma serie por fazer nao aparece na progressao', () => {
  const p = progressaoExercicio([
    { exercicioId: 1, data: '2026-08-24', peso: 100, reps: 5 },
    { exercicioId: 1, data: '2026-08-31', peso: 200, reps: 5, feita: false }
  ], 1);
  assert.equal(p.length, 1);
  assert.equal(p[0].pesoMax, 100);
});

test('sem o campo feita conta como feita', () => {
  // As 28.747 series que vieram do FitNotes nao trazem o campo.
  assert.equal(serieFeita({ peso: 100, reps: 5 }), true);
  assert.equal(serieFeita({ peso: 100, reps: 5, feita: true }), true);
  assert.equal(serieFeita({ peso: 100, reps: 5, feita: false }), false);
  assert.equal(serieFeita(null), true, 'nao pode rebentar com nada');
});

test('dar o visto a uma serie planeada fa-la contar', () => {
  const planeada = { ...serie('2026-01-08', 200, 5), feita: false };
  assert.equal(detetarRecordes([serie('2026-01-01', 100, 5), planeada]).length, 1);
  planeada.feita = true;
  assert.equal(detetarRecordes([serie('2026-01-01', 100, 5), planeada]).length, 2);
});

/* ------------------------------------ cargas maximas por repeticoes */

test('carga maxima: uma serie longa conta para todas as repeticoes abaixo', () => {
  // O caso que o Bruno apanhou no Leg Extension: 111,5 kg a 10 repeticoes e
  // 109 kg a 8. Dizer que a marca das 8 e 109 esta errado — quem fez 10 com
  // 111,5 fez 8 com 111,5 pelo caminho.
  const t = recordesPorReps([
    serie('2026-01-01', 109, 8),
    serie('2026-01-08', 111.5, 10)
  ], 1);
  const oito = t.find(l => l.reps === 8);
  assert.equal(oito.peso, 111.5, 'as 8 herdam o peso da serie de 10');
  assert.equal(oito.herdado, true);
  assert.equal(oito.repsOrigem, 10, 'diz de que serie veio');
  assert.equal(t.find(l => l.reps === 10).peso, 111.5);
});

test('carga maxima: a curva nunca sobe quando as repeticoes sobem', () => {
  const t = recordesPorReps([
    serie('2026-01-01', 111.5, 10),
    serie('2026-01-02', 109, 12),
    serie('2026-01-03', 50, 20),
    serie('2026-01-04', 120, 6)
  ], 1);
  const pesos = t.map(l => l.peso);
  for (let i = 1; i < pesos.length; i++) {
    assert.ok(pesos[i] <= pesos[i - 1],
      `a ${t[i].reps} reps (${pesos[i]}) nao pode pesar mais do que a ${t[i - 1].reps} (${pesos[i - 1]})`);
  }
  // Os numeros do exemplo do Bruno, um a um.
  assert.equal(t.find(l => l.reps === 6).peso, 120);
  assert.equal(t.find(l => l.reps === 10).peso, 111.5);
  assert.equal(t.find(l => l.reps === 12).peso, 109, 'as 12 nao herdam: 111,5 nunca la chegou');
  assert.equal(t.find(l => l.reps === 20).peso, 50);
});

test('carga maxima: so aparecem as repeticoes que foram mesmo feitas', () => {
  const t = recordesPorReps([serie('2026-01-01', 100, 5), serie('2026-01-02', 80, 10)], 1);
  assert.deepEqual(t.map(l => l.reps), [5, 10], 'nao inventa linhas para 6, 7, 8 nem 9');
  assert.equal(t.find(l => l.reps === 5).peso, 100);
});

test('carga maxima: o melhor a N reps ganha ao herdado', () => {
  // 130 kg a 5 e melhor do que herdar os 100 kg da serie de 10.
  const t = recordesPorReps([
    serie('2026-01-01', 130, 5),
    serie('2026-01-02', 100, 10)
  ], 1);
  assert.equal(t.find(l => l.reps === 5).peso, 130);
  assert.equal(t.find(l => l.reps === 5).herdado, false);
  assert.equal(t.find(l => l.reps === 10).peso, 100);
});

test('curvaRepMax: responde a qualquer numero de repeticoes, nao so aos feitos', () => {
  const c = curvaRepMax([
    serie('2026-01-01', 111.5, 10),
    serie('2026-01-02', 50, 20)
  ], 1);
  assert.equal(melhorPesoParaReps(c, 1), 111.5);
  assert.equal(melhorPesoParaReps(c, 8), 111.5, 'nunca fez 8, mas fez 10 com esse peso');
  assert.equal(melhorPesoParaReps(c, 10), 111.5);
  assert.equal(melhorPesoParaReps(c, 15), 50, 'so a serie de 20 chega tao longe');
  assert.equal(melhorPesoParaReps(c, 20), 50);
  assert.equal(melhorPesoParaReps(c, 21), null, 'nunca foi tao longe');
  assert.equal(melhorPesoParaReps(c, 0), null);
  assert.equal(melhorPesoParaReps(c, null), null);
  assert.equal(c.maxReps, 20);
});

test('carga maxima: em empate fica a serie mais longa', () => {
  // 100 kg a 5 e a 9. A marca das 5 devia apontar para a de 9, que e a
  // que mostra mais capacidade.
  const a = { id: 1, exercicioId: 1, data: '2026-01-01', peso: 100, reps: 5 };
  const b = { id: 2, exercicioId: 1, data: '2026-02-01', peso: 100, reps: 9 };
  const t = recordesPorReps([a, b], 1);
  assert.equal(t.find(l => l.reps === 5).repsOrigem, 9);
  assert.equal(t.find(l => l.reps === 5).serieId, 2);
});

test('carga maxima: peso corporal e outros exercicios ficam de fora', () => {
  const t = recordesPorReps([
    serie('2026-01-01', 0, 20),        // peso corporal: nao ha carga
    serie('2026-01-02', 50, 5, 2),     // outro exercicio
    serie('2026-01-03', 100, 5)
  ], 1);
  assert.deepEqual(t.map(l => [l.reps, l.peso]), [[5, 100]]);
});

test('carga maxima: traz o 1RM estimado de cada linha', () => {
  const t = recordesPorReps([serie('2026-01-01', 100, 10)], 1);
  assert.ok(Math.abs(t[0].rm1 - 133.3333333) < 0.001);
  const uma = recordesPorReps([serie('2026-02-01', 140, 1)], 1);
  assert.equal(uma[0].rm1, 140, 'com 1 rep o 1RM e o proprio peso');
});

test('carga maxima: sem series devolve lista vazia', () => {
  assert.deepEqual(recordesPorReps([], 1), []);
  assert.deepEqual(recordesPorReps([serie('2026-01-01', 100, 5, 2)], 1), []);
  assert.equal(melhorPesoParaReps(curvaRepMax([], 1), 5), null);
});

test('historico real: a curva do Leg Extension desce sempre', SEM_DADOS, () => {
  const b = backup();
  const leg = b.exercicios.find(e => e.nome === 'Leg Extension Machine');
  assert.ok(leg, 'o Leg Extension Machine tem de existir no historico');
  const t = recordesPorReps(b.series, leg.id);
  assert.ok(t.length > 3, 'poucas linhas para conferir');
  for (let i = 1; i < t.length; i++) {
    assert.ok(t[i].peso <= t[i - 1].peso,
      `${t[i].reps} reps a ${t[i].peso} kg depois de ${t[i - 1].reps} reps a ${t[i - 1].peso} kg`);
  }
  // As 8 nao podem valer menos do que as 9 nem do que as 10.
  const p = (n) => (t.find(l => l.reps === n) || {}).peso;
  if (p(8) && p(10)) assert.ok(p(8) >= p(10), '8 reps: ' + p(8) + ' vs 10 reps: ' + p(10));
});

test('historico real: a curva desce sempre em todos os exercicios', SEM_DADOS, () => {
  const b = backup();
  let verificados = 0;
  b.exercicios.forEach(e => {
    const t = recordesPorReps(b.series, e.id);
    if (t.length < 2) return;
    verificados++;
    for (let i = 1; i < t.length; i++) {
      assert.ok(t[i].peso <= t[i - 1].peso,
        e.nome + ': ' + t[i].reps + ' reps a ' + t[i].peso + ' kg');
    }
  });
  assert.ok(verificados > 100, 'so ' + verificados + ' exercicios verificados');
});

/* --------------------------------------------- contra o historico real */

test('historico real: bate exactamente os recordes marcados pelo FitNotes', SEM_DADOS, () => {
  const b = backup();
  const marcadasPelaApp = new Set(b.series.filter(s => s.recordeOriginal).map(s => s.id));
  assert.equal(marcadasPelaApp.size, ESPERADO.recordesMarcadosPelaApp,
    'a base tem de trazer 1187 series marcadas');

  const meus = new Set(detetarRecordes(b.series).map(r => r.serieId));

  const aMais = [...meus].filter(id => !marcadasPelaApp.has(id));
  const aMenos = [...marcadasPelaApp].filter(id => !meus.has(id));

  assert.equal(aMais.length, 0, aMais.length + ' series marcadas a mais');
  assert.equal(aMenos.length, 0, aMenos.length + ' recordes por apanhar');
  assert.equal(meus.size, ESPERADO.recordesMarcadosPelaApp);
});

test('historico real: as posicoes sao ordinais pequenos, nao o ZINDEX cru', SEM_DADOS, () => {
  // O ZINDEX da base do FitNotes e uma chave de ordenacao de 64 bits
  // (-7378697629483820808 e afins). Ordena bem, mas somar-lhe seja o que for
  // da lixo — e a app soma, quando copia um treino para um dia que ja tem
  // series. O conversor renumera; este teste e a rede que garante que sim.
  const b = backup();
  const ordens = b.series.map(s => s.ordem);
  const ordensEx = b.series.map(s => s.ordemExercicio);

  assert.ok(ordens.every(Number.isInteger), 'ha ordens que nao sao inteiros');
  assert.ok(Math.min(...ordens) >= 0, 'ordem negativa: sobrou o ZINDEX cru');
  assert.ok(Math.max(...ordens) < 500, 'ordem de ' + Math.max(...ordens) + ': sobrou o ZINDEX cru');
  assert.ok(Math.min(...ordensEx) >= 0 && Math.max(...ordensEx) < 100);

  // Dentro de um dia, as posicoes tem de ser 0, 1, 2... sem buracos.
  const doDia = b.series.filter(s => s.data === '2026-08-07')
    .sort((a, c) => a.ordem - c.ordem);
  assert.deepEqual(doDia.map(s => s.ordem), doDia.map((_, i) => i),
    'as posicoes de um dia tem de ser seguidas');
});

test('historico real: 28.747 series passam pela deteccao sem rebentar', SEM_DADOS, () => {
  const b = backup();
  const r = detetarRecordes(b.series);
  assert.ok(r.every(x => Number.isFinite(x.serieId) && x.tipos.length > 0));
  const m = melhoresPorExercicio(b.series);
  assert.equal(Object.keys(m).length, 125,
    '125 dos 131 exercicios tem series com peso e reps; os outros 6 sao de ' +
    'cardio ou de tempo (prancha), que nao entram nesta conta');
});
