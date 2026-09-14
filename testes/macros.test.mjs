/**
 * Macros: formula, gasto medido, tendencia do peso e sugestoes para a dieta.
 * Os valores esperados estao feitos a mao nos comentarios.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { nucleo as N } from './nucleo.mjs';

const perfil = { idade: 35, altura: 180, sexo: 'M', atividade: 'moderado', objetivo: 'manter' };
const dia = (base, n) => new Date(Date.parse(base + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);

/* pesagens diarias de `inicio` durante `dias`, a mudar `kgSemana` por semana */
function pesagens(inicio, dias, kg0, kgSemana) {
  return Array.from({ length: dias }, (_, i) => ({ id: i + 1, data: dia(inicio, i), kg: Math.round((kg0 + kgSemana * i / 7) * 10) / 10 }));
}
/* comida: um registo por dia com `kcal` e `p` gramas de proteina */
function comidas(inicio, dias, kcal, p = 150) {
  return Array.from({ length: dias }, (_, i) => ({ id: i + 1, data: dia(inicio, i), refeicao: 'Almoço', gramas: 100,
    por100: { kcal, p, h: 0, g: 0 } }));
}

test('formula: homem 81 kg, 180 cm, 35 anos, moderado = 2736 kcal', () => {
  // 10x81 + 6,25x180 - 5x35 + 5 = 810 + 1125 - 175 + 5 = 1765 ; x1,55 = 2735,75
  assert.equal(N.gastoPorFormula(perfil, 81), 2736);
  // mulher: -161 em vez de +5 -> 1599 x 1,55 = 2478,45
  assert.equal(N.gastoPorFormula({ ...perfil, sexo: 'F' }, 81), 2478);
});

test('meta: manter, perder e ganhar a partir de 2736 kcal e 81 kg', () => {
  // manter: 2736 -> 2750 (a 50) ; P 2,0x81 = 162 ; G max(64,8 ; 2750x0,25/9=76,4) = 76 ; H (2750-648-684)/4 = 354,5 -> 355
  assert.deepEqual(N.metaDeMacros(perfil, 81, 2736), { kcal: 2750, p: 162, h: 355, g: 76 });
  // perder: x0,8 = 2188,8 -> 2200 ; P 2,2x81 = 178,2 -> 178
  const perder = N.metaDeMacros({ ...perfil, objetivo: 'perder' }, 81, 2736);
  assert.equal(perder.kcal, 2200); assert.equal(perder.p, 178);
  // ganhar: x1,1 = 3009,6 -> 3000 ; P 1,8x81 = 145,8 -> 146
  const ganhar = N.metaDeMacros({ ...perfil, objetivo: 'ganhar' }, 81, 2736);
  assert.equal(ganhar.kcal, 3000); assert.equal(ganhar.p, 146);
  for (const m of [perder, ganhar]) assert.ok(Math.abs(m.p * 4 + m.h * 4 + m.g * 9 - m.kcal) <= 10);
});

test('macros: hidratos nunca negativos; gordura nunca abaixo de 0,8 g/kg', () => {
  assert.equal(N.macrosParaKcal(900, 81, 'perder').h, 0);
  // 1500 kcal: 25% dava 41,7 g ; 0,8 x 81 = 64,8 -> 65
  assert.equal(N.macrosParaKcal(1500, 81, 'perder').g, 65);
});

test('peso medio dos 7 dias', () => {
  const p = [{ data: '2026-09-01', kg: 80 }, { data: '2026-09-05', kg: 81 }, { data: '2026-09-07', kg: 82 }, { data: '2026-08-20', kg: 90 }];
  // 01/09 a 07/09 inclusive: 80, 81, 82 -> 81 ; o de 20/08 fica de fora
  assert.equal(N.pesoMedio(p, '2026-09-07', 7), 81);
  // 02/09 a 08/09: so 81 e 82
  assert.equal(N.pesoMedio(p, '2026-09-08', 7), 81.5);
  assert.equal(N.pesoMedio(p, '2026-10-30', 7), null);
});

test('tendencia: reta de 21 dias; precisa de 3 pesagens em 14+ dias', () => {
  const t = N.tendenciaPeso(pesagens('2026-08-10', 21, 80, -0.5), '2026-08-30', 21);
  assert.ok(Math.abs(t.kgSemana - -0.5) <= 0.03, String(t.kgSemana));
  assert.equal(N.tendenciaPeso([{ data: '2026-08-29', kg: 80 }, { data: '2026-08-30', kg: 79 }], '2026-08-30', 21), null);
  const juntas = [{ data: '2026-08-25', kg: 80 }, { data: '2026-08-27', kg: 80 }, { data: '2026-08-30', kg: 79 }];
  assert.equal(N.tendenciaPeso(juntas, '2026-08-30', 21), null, 'so 5 dias de intervalo');
});

test('gasto medido: 2500 kcal por dia e -0,5 kg/semana = ~3050 kcal', () => {
  // 2500 + 0,5 x 7700 / 7 = 2500 + 550 = 3050
  const g = N.gastoMedido(pesagens('2026-08-10', 21, 82, -0.5), comidas('2026-08-10', 21, 2500), '2026-08-30');
  assert.ok(Math.abs(g.gasto - 3050) <= 30, String(g.gasto));
  assert.equal(g.diasComida, 21);
  assert.equal(g.kcalMedia, 2500);
});

test('gasto medido: menos de 14 dias de comida (ou dias de 500 kcal) nao conta', () => {
  assert.equal(N.gastoMedido(pesagens('2026-08-10', 21, 82, 0), comidas('2026-08-10', 13, 2500), '2026-08-30'), null);
  assert.equal(N.gastoMedido(pesagens('2026-08-10', 21, 82, 0), comidas('2026-08-10', 21, 500), '2026-08-30'), null);
});

/* --- plano alimentar fixo --------------------------------------------------- */

const item = (refeicao, nome, gramas, por100) => ({ refeicao, nome, origem: 'insa', ref: 'insa:' + nome, gramas, por100 });
const FRANGO = { kcal: 108, p: 24.1, h: 0, g: 1.2 };
const ARROZ = { kcal: 125, p: 2.5, h: 28, g: 0.2 };
const AVEIA = { kcal: 366, p: 13.5, h: 61.7, g: 5.8 };
const AZEITE = { kcal: 900, p: 0, h: 0, g: 100 };
const treino = [item('Pequeno-almoço', 'Aveia', 80, AVEIA), item('Almoço', 'Frango', 200, FRANGO),
  item('Almoço', 'Arroz', 250, ARROZ), item('Almoço', 'Azeite', 10, AZEITE), item('Jantar', 'Frango', 200, FRANGO),
  item('Jantar', 'Arroz', 200, ARROZ)];
const descanso = [item('Almoço', 'Frango', 200, FRANGO), item('Almoço', 'Arroz', 150, ARROZ), item('Jantar', 'Frango', 200, FRANGO),
  item('Jantar', 'Azeite', 10, AZEITE), item('Lanche', 'Aveia', 60, AVEIA)];
const planoAlim = { versoes: [{ desde: '2026-08-01', treino, descanso }] };

test('tipo de dia: seg, ter, qui, sex treino; qua, sab, dom descanso', () => {
  // 14/09/2026 e segunda
  assert.deepEqual(['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19', '2026-09-20'].map(N.tipoDeDia),
    ['treino', 'treino', 'descanso', 'treino', 'treino', 'descanso', 'descanso']);
});

test('consumo: registo ganha ao plano; sem registo conta o plano do tipo de dia; antes do plano nada', () => {
  // treino: aveia 292,8 + frango 216 + arroz 312,5 + azeite 90 + frango 216 + arroz 250 = 1377,3 -> por item arredondado: 293+216+313+90+216+250 = 1378
  assert.equal(N.consumoDoDia('2026-09-14', [], planoAlim).kcal, 1378);
  assert.equal(N.consumoDoDia('2026-09-14', [], planoAlim).origem, 'plano');
  // descanso: 216 + 188 + 216 + 90 + 220 = 930
  assert.equal(N.consumoDoDia('2026-09-16', [], planoAlim).kcal, 930);
  const reg = [{ data: '2026-09-14', gramas: 100, por100: { kcal: 2000, p: 0, h: 0, g: 0 } }];
  assert.deepEqual([N.consumoDoDia('2026-09-14', reg, planoAlim).kcal, N.consumoDoDia('2026-09-14', reg, planoAlim).origem], [2000, 'registo']);
  assert.equal(N.consumoDoDia('2026-07-01', [], planoAlim), null);
});

test('versoes: o dia usa o plano em vigor nessa data, nao o de hoje', () => {
  const v = { versoes: [{ desde: '2026-08-01', treino, descanso }, { desde: '2026-09-10', treino: [item('Almoço', 'Arroz', 1000, ARROZ)], descanso }] };
  assert.equal(N.consumoDoDia('2026-09-08', [], v).kcal, 1378);
  assert.equal(N.consumoDoDia('2026-09-14', [], v).kcal, 1250);
  assert.equal(N.planoAtualAlimentar(v).desde, '2026-09-10');
});

test('gasto medido com o plano: dias sem registo contam como plano', () => {
  // plano so com 2500 kcal nos dois tipos; peso a descer 0,5 kg/semana -> ~3050
  const p2500 = { versoes: [{ desde: '2026-08-01', treino: [item('Almoço', 'X', 100, { kcal: 2500, p: 150, h: 300, g: 70 })],
    descanso: [item('Almoço', 'X', 100, { kcal: 2500, p: 150, h: 300, g: 70 })] }] };
  const g = N.gastoMedido(pesagens('2026-08-10', 21, 82, -0.5), [], '2026-08-30', 21, p2500);
  assert.ok(Math.abs(g.gasto - 3050) <= 30, String(g && g.gasto));
  assert.equal(g.diasComida, 21);
});

test('cintura: cm/semana entre a primeira e a ultima medida, 14+ dias', () => {
  const av = [{ data: '2026-09-01', cintura: 86 }, { data: '2026-09-08', cintura: 85.5 }, { data: '2026-09-15', cintura: 85 }];
  assert.deepEqual(N.tendenciaCintura(av, '2026-09-15'), { cmSemana: -0.5, primeira: 86, ultima: 85, medidas: 3, dias: 14 });
  assert.equal(N.tendenciaCintura(av.slice(1), '2026-09-15'), null, 'so 7 dias');
  assert.equal(N.tendenciaCintura([{ data: '2026-09-15', cintura: 85 }], '2026-09-15'), null);
});

test('ajustar +200 kcal: so os hidratos sobem, a proteina fica, gramas a 5', () => {
  const r = N.ajustarPlanoKcal(treino, 200);
  // hidratos no treino: aveia 292,8 + arroz 312,5 + arroz 250 = 855,3 kcal ; fator 1,2338
  // aveia 80 -> 98,7 -> 100 ; arroz 250 -> 308 -> 310 ; arroz 200 -> 246,8 -> 245
  assert.deepEqual(r.mudancas.map(m => [m.nome, m.antes, m.depois]), [['Aveia', 80, 100], ['Arroz', 250, 310], ['Arroz', 200, 245]]);
  assert.ok(Math.abs(r.kcal - 200) <= 25, String(r.kcal));
  assert.deepEqual(r.itens.filter(i => i.nome === 'Frango').map(i => i.gramas), [200, 200]);
  assert.equal(treino[2].gramas, 250, 'nao mexe no original');
});

test('ajustar -300 num plano com poucos hidratos entra a gordura; nunca abaixo de 30%', () => {
  const pouco = [item('Almoço', 'Frango', 300, FRANGO), item('Almoço', 'Arroz', 100, ARROZ), item('Almoço', 'Azeite', 30, AZEITE)];
  // hidratos 125 kcal, x0,7 = 87,5 < 300 -> junta o azeite (270) ; base 395 ; fator 1-300/395 = 0,24 -> 0,3
  const r = N.ajustarPlanoKcal(pouco, -300);
  assert.deepEqual(r.mudancas.map(m => [m.nome, m.antes, m.depois]), [['Arroz', 100, 30], ['Azeite', 30, 10]]);
  assert.equal(N.ajustarPlanoKcal([item('Almoço', 'Frango', 300, FRANGO)], 100), null, 'so proteina: nada a mexer');
});

test('ajustar com marcas: so os marcados; o "subir" so recebe quando e para acrescentar; sem gordura', () => {
  const marcado = [
    { ...item('Pequeno-almoço', 'Aveia', 45, AVEIA), ajustavel: true },
    item('Almoço', 'Arroz', 150, ARROZ),                                  // arroz do almoco: nao mexe
    { ...item('Jantar', 'Arroz', 150, ARROZ), ajustavel: true },
    { ...item('Meio da manhã', 'Maçã', 150, { kcal: 64, p: 0.2, h: 13.4, g: 0.5 }), ajustavel: 'subir' },
    item('Jantar', 'Azeite', 10, AZEITE),
  ];
  // +100: aveia 164,7 + arroz jantar 187,5 + maca 96 = 448,2 ; fator 1,2231
  // aveia 45 -> 55 ; arroz 150 -> 183,5 -> 185 ; maca 150 -> 183,5 -> 185
  const mais = N.ajustarPlanoKcal(marcado, 100);
  assert.deepEqual(mais.mudancas.map(m => [m.refeicao, m.nome, m.antes, m.depois]),
    [['Pequeno-almoço', 'Aveia', 45, 55], ['Jantar', 'Arroz', 150, 185], ['Meio da manhã', 'Maçã', 150, 185]]);
  // -100: so aveia e arroz do jantar (352,2) ; fator 0,716 -> aveia 32,2 -> 30 ; arroz 107,4 -> 105
  const menos = N.ajustarPlanoKcal(marcado, -100);
  assert.deepEqual(menos.mudancas.map(m => [m.nome, m.refeicao, m.antes, m.depois]),
    [['Aveia', 'Pequeno-almoço', 45, 30], ['Arroz', 'Jantar', 150, 105]]);
  // muito para tirar: fica no minimo de 30% e nao vai a gordura nem ao arroz do almoco
  const muito = N.ajustarPlanoKcal(marcado, -600);
  assert.equal(muito.mudancas.some(m => m.nome === 'Azeite' || m.refeicao === 'Almoço'), false);
  assert.deepEqual(muito.mudancas.map(m => m.depois), [15, 45]);
  assert.equal(muito.itens.find(i => i.nome === 'Aveia').ajustavel, true, 'a marca fica no plano novo');
});

const perfilM = { ...perfil, objetivo: 'manter' };
const base = (extra) => ({ perfil: perfilM, planoAlimentar: planoAlim, pesoAtual: 81, pesagens: [], comidas: [], avaliacoes: [], decididas: {}, ...extra });

test('dieta: sem 3 pesagens em 2 semanas pede para se pesar', () => {
  const s = N.sugerirDieta(base({ pesagens: [{ data: '2026-09-10', kg: 81 }] }), '2026-09-14');
  assert.equal(s[0].tipo, 'dieta-pesar');
  assert.match(s[0].detalhe, /Só 1 pesagens/);
});

test('dieta: a ganhar com o peso parado -> +300 kcal em gramas nos dois planos', () => {
  const d = base({ perfil: { ...perfil, objetivo: 'ganhar' }, pesagens: pesagens('2026-08-24', 21, 81, 0) });
  const s = N.sugerirDieta(d, '2026-09-13').find(x => x.tipo === 'dieta-plano');
  // alvo +0,25 ; 0,25 x 7700 / 7 = 275 -> 300 (a 50)
  assert.equal(s.titulo, '+300 kcal por dia no plano');
  assert.ok(s.detalhe.includes('o alvo é +0,25 kg/semana'), s.detalhe);
  assert.ok(s.linhas.some(l => l.startsWith('Treino · Almoço: Arroz 250 →')), s.linhas.join(' | '));
  assert.ok(s.linhas.some(l => l.startsWith('Descanso · ')));
  const kT = N.totaisDeItens(s.novoPlano.treino).kcal - N.totaisDeItens(treino).kcal;
  assert.ok(Math.abs(kT - 300) <= 30, 'treino +' + kT);
});

test('dieta: a perder 1 kg/semana (depressa de mais) tira, no maximo 300', () => {
  const d = base({ perfil: { ...perfil, objetivo: 'perder' }, pesagens: pesagens('2026-08-24', 21, 81, -1) });
  const s = N.sugerirDieta(d, '2026-09-13').find(x => x.tipo === 'dieta-plano');
  // alvo -0,5 ; real -1 ; diferenca +0,5 -> +550 -> teto +300 (esta a perder de mais: come mais)
  assert.equal(s.titulo, '+300 kcal por dia no plano');
});

test('dieta: peso no ritmo nao mexe; recomposicao (peso parado a perder, cintura a descer) diz para nao mexer', () => {
  assert.equal(N.sugerirDieta(base({ pesagens: pesagens('2026-08-24', 21, 81, 0.05) }), '2026-09-13').some(x => x.tipo === 'dieta-plano'), false);
  const av = [{ data: '2026-08-25', cintura: 87 }, { data: '2026-09-12', cintura: 85.5 }];
  const s = N.sugerirDieta(base({ perfil: { ...perfil, objetivo: 'perder' }, pesagens: pesagens('2026-08-24', 21, 81, 0), avaliacoes: av }), '2026-09-13');
  assert.equal(s.some(x => x.tipo === 'dieta-plano'), false);
  const r = s.find(x => x.tipo === 'dieta-recomposicao');
  assert.match(r.detalhe, /87 → 85,5 cm em 18 dias/);
  assert.match(r.detalhe, /O peso está parado/);
  assert.ok(r.detalhe.includes('o alvo é -0,5 kg/semana'), r.detalhe);
  // sem a cintura a descer, a mesma situacao ajusta o plano
  assert.ok(N.sugerirDieta(base({ perfil: { ...perfil, objetivo: 'perder' }, pesagens: pesagens('2026-08-24', 21, 81, 0) }), '2026-09-13')
    .some(x => x.tipo === 'dieta-plano' && x.titulo.startsWith('-300')));
});

test('dieta: proteina do plano abaixo de 85% do alvo avisa com gramas', () => {
  // treino 48,2+10,8+... ; o plano de teste tem ~112 g no treino e ~106 no descanso ; alvo manter 2,0 x 81 = 162
  const s = N.sugerirDieta(base({ pesagens: pesagens('2026-08-24', 21, 81, 0.05) }), '2026-09-13').find(x => x.tipo === 'dieta-proteina');
  assert.ok(s, 'sem aviso de proteina');
  assert.match(s.titulo, /faltam \d+ g por dia/);
  const muito = { versoes: [{ desde: '2026-08-01', treino: [item('Almoço', 'Frango', 700, FRANGO)], descanso: [item('Almoço', 'Frango', 700, FRANGO)] }] };
  assert.equal(N.sugerirDieta(base({ planoAlimentar: muito, pesagens: pesagens('2026-08-24', 21, 81, 0.05) }), '2026-09-13').some(x => x.tipo === 'dieta-proteina'), false);
});

test('dieta: sem perfil ou sem plano nao sugere; decididas escondem', () => {
  assert.deepEqual(N.sugerirDieta(base({ perfil: null }), '2026-09-13'), []);
  assert.deepEqual(N.sugerirDieta(base({ planoAlimentar: null }), '2026-09-13'), []);
  const d = base({ perfil: { ...perfil, objetivo: 'ganhar' }, pesagens: pesagens('2026-08-24', 21, 81, 0) });
  const ch = {}; N.sugerirDieta(d, '2026-09-13').forEach(x => { ch[x.chave] = 1; });
  assert.deepEqual(N.sugerirDieta({ ...d, decididas: ch }, '2026-09-13'), []);
});
