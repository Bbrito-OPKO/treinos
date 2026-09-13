/**
 * O gerador do plano dentro da app.
 *
 * A prova que vale: com a configuracao de partida, o JavaScript gera EXATAMENTE
 * o plano-treino.json que o gerar.py escreveu (e que o validar.py aprovou).
 * Campo a campo, peso a peso. E o validador traduzido tem de aprovar esse
 * plano e rebentar com planos estragados de proposito, um por regra.
 *
 * O plano-treino.json e o para_app_esperado.json ficam em dados-reais/ (fora
 * do git): trazem os pesos dele. Sem eles, os testes golden dizem que saltaram.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { nucleo, RAIZ } from './nucleo.mjs';

const { PLANO_CONFIG_PADRAO, arredondarPy, escolherMax, escolherMin,
  gerarPlano, validarPlano, planoParaSessoes } = nucleo;

const P_PLANO = path.join(RAIZ, 'dados-reais', 'plano-treino.json');
const P_APP = path.join(RAIZ, 'dados-reais', 'para_app_esperado.json');
const SEM_PLANO = { skip: fs.existsSync(P_PLANO) ? false : 'falta dados-reais/plano-treino.json' };
const SEM_APP = { skip: fs.existsSync(P_APP) ? false : 'falta dados-reais/para_app_esperado.json' };

const copia = x => JSON.parse(JSON.stringify(x));
const gerado = () => gerarPlano(copia(PLANO_CONFIG_PADRAO));

test('arredondarPy faz como o round() do Python (,5 vai para o par)', () => {
  assert.equal(arredondarPy(0.5), 0);
  assert.equal(arredondarPy(1.5), 2);
  assert.equal(arredondarPy(2.5), 2);
  assert.equal(arredondarPy(3.5), 4);
  assert.equal(arredondarPy(2.4999), 2);
  assert.equal(arredondarPy(2.5001), 3);
});

test('escolherMax/Min devolvem o primeiro empatado, como o Python', () => {
  const l = ['a', 'b', 'c'];
  const k = { a: 1, b: 3, c: 3 };
  assert.equal(escolherMax(l, x => k[x]), 'b');
  assert.equal(escolherMin(['c', 'b', 'a'], x => k[x] === 1 ? 5 : 3), 'c');
  assert.equal(escolherMin(l, x => [k[x] === 1 ? 3 : k[x], x === 'c' ? 0 : 1]), 'c');
});

test('golden: o plano gerado e igual ao plano-treino.json do gerar.py', SEM_PLANO, () => {
  const esperado = JSON.parse(fs.readFileSync(P_PLANO, 'utf8'));
  const g = gerado();
  // semana a semana e dia a dia primeiro, para a mensagem apontar o sitio
  for (let w = 0; w < 4; w++) {
    for (const d of esperado.config.dias) {
      assert.deepEqual(g.calendario[w].dias[d], esperado.calendario[w].dias[d], `semana ${w + 1} ${d}`);
    }
  }
  assert.deepEqual(g, esperado);
});

test('as 17 provas passam no plano gerado', () => {
  assert.deepEqual(validarPlano(gerado()), []);
});

test('as 17 provas passam no plano-treino.json do Python', SEM_PLANO, () => {
  assert.deepEqual(validarPlano(JSON.parse(fs.readFileSync(P_PLANO, 'utf8'))), []);
});

/* Cada estrago tem de ser apanhado pela prova certa. */
const ESTRAGOS = [
  ['P1', 'tirar uma serie a um acessorio', p => { p.calendario[0].dias.terca.exercicios[1].series.pop(); }],
  ['P2', 'tirar o braco de um dia', p => {
    const d = p.calendario[0].dias.segunda;
    d.exercicios = d.exercicios.filter(e => e.categoria !== 'braco');
  }],
  ['P3', 'trocar os lifts de dois dias', p => {
    const s = p.calendario[1].dias;
    [s.terca.lift, s.quinta.lift] = [s.quinta.lift, s.terca.lift];
  }],
  // os dias ficam certos (a P3 continua a passar), so o maximos muda de sitio
  ['P4', 'maximos do morto na sexta em vez da segunda', p => {
    p.calendario[0].dias.segunda.modo = 'leve';
    p.calendario[1].dias.sexta.modo = 'maximos';
  }],
  ['P5', 'por na sexta o lift dos maximos seguintes', p => {
    p.calendario[0].dias.sexta.lift = p.calendario[1].dias.segunda.lift;
  }],
  ['P6', 'pesado do grupo em aproximacao na quinta', p => {
    const s = p.calendario[0];
    s.dias.quinta.exercicios.push({ nome: 'X', grupo: s.grupo_em_aproximacao, categoria: 'empurrar',
      foco: false, intensidade: 'pesado', series: [[1, 8], [1, 6]] });
  }],
  ['P7', 'gemeos em 3 dias', p => {
    const s = p.calendario[0].dias;
    const dia = ['segunda', 'terca', 'quinta', 'sexta'].find(d => !s[d].exercicios.some(e => e.grupo === 'gemeos'));
    s[dia].exercicios.push({ nome: 'Seated Calf Raise Machine', grupo: 'gemeos', categoria: 'gemeos',
      foco: false, intensidade: 'leve', series: [[1, 10], [1, 8]] });
  }],
  ['P11', 'perna acessoria no dia do agachamento', p => {
    const s = p.calendario[0];
    const d = Object.keys(s.dias).find(k => s.dias[k].lift === 'AGACHAMENTO');
    s.dias[d].exercicios.splice(1, 0, { nome: 'Leg Press', grupo: 'perna', categoria: 'perna',
      foco: false, intensidade: 'leve', series: [[1, 8], [1, 6]] });
  }],
  ['P14', 'biceps no dia do supino', p => {
    const s = p.calendario[0];
    const d = Object.keys(s.dias).find(k => s.dias[k].lift === 'SUPINO');
    s.dias[d].exercicios.find(e => e.categoria === 'braco').grupo = 'biceps';
  }],
  ['P8', 'passar o teto da segunda', p => {
    p.calendario[0].dias.segunda.exercicios[0].series.push([1, 1], [1, 1], [1, 1], [1, 1], [1, 1]);
  }],
  ['P9', 'repetir o exercicio de ontem', p => {
    const s = p.calendario[0].dias;
    const e = s.segunda.exercicios.find(x => !x.foco);
    s.terca.exercicios.push(copia(e));
  }],
  ['P10', 'abs antes do braco', p => { p.calendario[0].dias.segunda.exercicios.reverse(); }],
  ['P12', 'abs a terca', p => {
    p.calendario[0].dias.terca.exercicios.push({ nome: 'Crunch', grupo: 'abs', categoria: 'abs',
      foco: false, intensidade: 'leve', series: [[0, 30], [0, 40]] });
  }],
  ['P13', 'dois da mesma familia no mesmo dia', p => {
    p.calendario[0].dias.terca.exercicios.push({ nome: 'Flat Machine Fly', grupo: 'peito', categoria: 'empurrar',
      foco: false, intensidade: 'leve', series: [[1, 8], [1, 6]] },
    { nome: 'Flat Dumbbell Fly', grupo: 'peito', categoria: 'empurrar', foco: false, intensidade: 'leve', series: [[1, 8], [1, 6]] });
  }],
  ['P15', 'posterior no dia do morto', p => {
    const s = p.calendario[0];
    const d = Object.keys(s.dias).find(k => s.dias[k].lift === 'MORTO');
    s.dias[d].exercicios.push({ nome: 'Leg Curl Machine', grupo: 'perna', categoria: 'perna',
      foco: false, intensidade: 'leve', series: [[1, 8], [1, 6]] });
  }],
  ['P16', 'acessorio com uma serie', p => { p.calendario[0].dias.terca.exercicios[1].series = [[1, 8]]; }],
  ['P17', 'acessorio a 15 reps a segunda', p => {
    const e = p.calendario[0].dias.segunda.exercicios.find(x => !x.foco && x.categoria !== 'abs');
    e.series[0][1] = 15;
  }],
];

for (const [prova, nome, estragar] of ESTRAGOS) {
  test(`o validador apanha: ${nome} (${prova})`, () => {
    const p = gerado();
    estragar(p);
    const falhas = validarPlano(p);
    assert.ok(falhas.some(f => f.startsWith(prova + ' ')), `${prova} nao apareceu em: ${falhas.join(' | ') || 'nenhuma falha'}`);
  });
}

/* Com os pesos de hoje nao ha nenhum ,5 exato (medido: 0 casos), por isso o
   golden sozinho nao distingue o round do Python do Math.round. Com 150 kg ha:
   150 x 0,95 / 5 = 28,5 -> o Python da 28 (140 kg), o Math.round dava 29 (145).
   Os valores esperados sairam do gerar.py com estes pesos. */
test('arredondamento do Python nos pesos: 150 kg -> 140/160, 25 kg -> 25/27,5', () => {
  const cfg = copia(PLANO_CONFIG_PADRAO);
  cfg.acc.find(a => a[0] === 'Leg Press')[2] = 150;
  cfg.acc.find(a => a[0] === 'Barbell Curl')[2] = 25;
  const p = gerarPlano(cfg);
  assert.deepEqual(p.acessorios['Leg Press'].series, [[140, 8], [160, 6]]);
  assert.deepEqual(p.acessorios['Barbell Curl'].series, [[25, 8], [27.5, 6]]);
});

test('ciclo seguinte: maximos sobem o incremento, series na mesma proporcao', () => {
  const { progredirConfig } = nucleo;
  const c1 = copia(PLANO_CONFIG_PADRAO);
  const c2 = progredirConfig(c1, '2026-09-28', '2026-09-26');
  assert.equal(c2.lift.MORTO.max, 187.5);
  assert.equal(c2.lift.SUPINO.max, 122.5);
  // o single dos maximos fica no maximo novo
  assert.deepEqual(c2.lift.MORTO.maximos[2], [187.5, 1]);
  assert.deepEqual(c2.lift.SUPINO.maximos[2], [122.5, 1]);
  // 130 x 187,5/180 = 135,4 -> 135 ; 90 x 122,5/120 = 91,875 -> 92,5
  assert.deepEqual(c2.lift.MORTO.maximos[0], [135, 3]);
  assert.deepEqual(c2.lift.SUPINO.maximos[3], [92.5, 10]);
  for (const L of c2.lifts) for (const m of ['maximos', 'volume_5', 'volume_8', 'leve']) {
    for (const [kg, reps] of c2.lift[L][m]) {
      assert.equal(kg % 2.5, 0, `${L} ${m} ${kg}`);
      assert.ok(kg >= 0);
    }
    assert.deepEqual(c2.lift[L].volume_5.map(s => s[1]), c1.lift[L].volume_5.map(s => s[1]));
  }
  assert.deepEqual(c2.ajustes, {});
  assert.equal(c1.lift.MORTO.max, 180, 'a configuracao antiga nao pode mudar');
  const p = gerarPlano(c2);
  assert.equal(p.calendario[0].dias.segunda.data, '2026-09-28');
  assert.deepEqual(validarPlano(p), []);
});

test('ciclo com outra data de arranque: datas deslocam, regras continuam a passar', () => {
  const cfg = copia(PLANO_CONFIG_PADRAO);
  cfg.dataInicio = '2026-09-28';
  const p = gerarPlano(cfg);
  assert.equal(p.calendario[0].dias.segunda.data, '2026-09-28');
  assert.equal(p.calendario[3].dias.sexta.data, '2026-10-23');
  assert.deepEqual(validarPlano(p), []);
});

test('para a app: igual ao para_app.py (16 treinos, 248 series)', SEM_APP, () => {
  const f = JSON.parse(fs.readFileSync(P_APP, 'utf8'));
  const p = gerado();
  const r = planoParaSessoes(p, f.exercicios, f.sessoes, { sessao: f.proxSessao, serie: f.proxSerie });
  assert.deepEqual(r.emFalta, []);
  assert.deepEqual(r.choques, []);
  assert.equal(r.sessoes.length, 16);
  assert.equal(r.series.length, 248);
  assert.deepEqual(r.sessoes, f.esperadoSessoes);
  assert.deepEqual(r.series, f.esperadoSeries);
});

test('para a app: exercicio desconhecido nao grava nada', () => {
  const r = planoParaSessoes(gerado(), [{ id: 1, nome: 'Deadlift', tipo: 'peso_reps' }], [], { sessao: 1, serie: 1 });
  assert.ok(r.emFalta.length > 0);
  assert.deepEqual(r.sessoes, []);
  assert.deepEqual(r.series, []);
});

test('para a app: dia com treino fica de fora', SEM_APP, () => {
  const f = JSON.parse(fs.readFileSync(P_APP, 'utf8'));
  const r = planoParaSessoes(gerado(), f.exercicios, [{ id: 9, data: '2026-09-07' }], { sessao: 100, serie: 1000 });
  assert.deepEqual(r.choques, ['2026-09-07']);
  assert.equal(r.sessoes.length, 15);
});
