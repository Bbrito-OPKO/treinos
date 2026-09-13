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

const meta = { kcal: 2750, p: 162, h: 355, g: 76 };
const base = (extra) => ({ perfil, meta, pesoAtual: 81, pesagens: [], comidas: [], avaliacoes: [], treino: null, decididas: {}, ...extra });

test('dieta: a ganhar mas o peso parado -> sobe kcal, limitado a +300', () => {
  const d = base({ perfil: { ...perfil, objetivo: 'ganhar' }, pesagens: pesagens('2026-08-10', 21, 81, 0), comidas: comidas('2026-08-24', 7, 2750, 170) });
  const s = N.sugerirDieta(d, '2026-08-30').find(x => x.tipo === 'dieta-kcal');
  // alvo +0,25 ; real 0 ; 0,25 x 7700 / 7 = 275 -> 300 (a 50), dentro do teto
  assert.ok(s, 'sem sugestao');
  assert.equal(s.novaMeta.kcal, 3050);
  const rapido = N.sugerirDieta(base({ perfil: { ...perfil, objetivo: 'perder' }, pesagens: pesagens('2026-08-10', 21, 81, 1),
    comidas: comidas('2026-08-24', 7, 2750, 170) }), '2026-08-30').find(x => x.tipo === 'dieta-kcal');
  assert.equal(rapido.novaMeta.kcal, 2450, 'o teto de -300');
});

test('dieta: peso no ritmo certo, ou comida mal registada, nao mexe nas kcal', () => {
  const certo = base({ pesagens: pesagens('2026-08-10', 21, 81, 0.05), comidas: comidas('2026-08-24', 7, 2750, 170) });
  assert.equal(N.sugerirDieta(certo, '2026-08-30').filter(x => x.tipo === 'dieta-kcal').length, 0);
  const pouca = base({ perfil: { ...perfil, objetivo: 'ganhar' }, pesagens: pesagens('2026-08-10', 21, 81, 0), comidas: comidas('2026-08-27', 3, 2750, 170) });
  assert.equal(N.sugerirDieta(pouca, '2026-08-30').filter(x => x.tipo === 'dieta-kcal').length, 0);
});

test('dieta: proteina abaixo de 85% da meta sugere, com gramas de frango', () => {
  const d = base({ comidas: comidas('2026-08-24', 7, 2750, 120) });
  const s = N.sugerirDieta(d, '2026-08-31').find(x => x.tipo === 'dieta-proteina');
  assert.equal(s.titulo, 'Mais 42 g de proteína por dia');
  assert.match(s.detalhe, /174 g de peito de frango/);   // 42 / 0,241
  assert.equal(N.sugerirDieta(base({ comidas: comidas('2026-08-24', 7, 2750, 140) }), '2026-08-31').filter(x => x.tipo === 'dieta-proteina').length, 0);
});

test('dieta: fome 4/5 so em defice; energia baixa so com o treino a falhar', () => {
  const av = [{ data: '2026-08-30', fome: 4, energia: 2, sono: 3 }];
  const perder = { ...perfil, objetivo: 'perder' };
  const m = { kcal: 2200, p: 178, h: 250, g: 61 };
  assert.ok(N.sugerirDieta(base({ perfil: perder, meta: m, avaliacoes: av }), '2026-08-31').some(x => x.tipo === 'dieta-fome'));
  assert.equal(N.sugerirDieta(base({ avaliacoes: av, gasto: 2750 }), '2026-08-31').some(x => x.tipo === 'dieta-fome'), false, 'em manutencao nao');
  const treinoMau = { planeados: 4, feitos: 2, maximosFalhados: ['SUPINO'] };
  const e = N.sugerirDieta(base({ perfil: perder, meta: m, avaliacoes: av, treino: treinoMau }), '2026-08-31').find(x => x.tipo === 'dieta-energia');
  assert.equal(e.novaMeta.kcal, 2350);
  assert.match(e.detalhe, /supino/);
  const treinoBom = { planeados: 4, feitos: 4, maximosFalhados: [] };
  assert.equal(N.sugerirDieta(base({ perfil: perder, meta: m, avaliacoes: av, treino: treinoBom }), '2026-08-31').some(x => x.tipo === 'dieta-energia'), false);
});

test('dieta: gasto medido 100+ kcal longe da formula sugere a meta medida (e so essa)', () => {
  const pes = pesagens('2026-08-10', 21, 82, -0.5), com = comidas('2026-08-10', 21, 2500, 170);
  const medido = N.gastoMedido(pes, com, '2026-08-30');
  const metaFormula = { ...N.metaDeMacros(perfil, 81, 2736), origem: 'formula', gasto: 2736 };
  const s = N.sugerirDieta(base({ meta: metaFormula, pesagens: pes, comidas: com, medido }), '2026-08-31');
  assert.equal(s.length, 1);
  assert.equal(s[0].tipo, 'dieta-medido');
  assert.equal(s[0].novaMeta.kcal, N.metaDeMacros(perfil, N.pesoMedio(pes, '2026-08-31', 7), medido.gasto).kcal);
  // meta ja ajustada: nao volta a sugerir
  assert.equal(N.sugerirDieta(base({ meta: { ...metaFormula, origem: 'ajuste' }, pesagens: pes, comidas: com, medido }), '2026-08-31')
    .some(x => x.tipo === 'dieta-medido'), false);
});

test('dieta: sem perfil ou sem meta nao sugere nada; decididas escondem', () => {
  assert.deepEqual(N.sugerirDieta(base({ perfil: null }), '2026-08-31'), []);
  const d = base({ comidas: comidas('2026-08-24', 7, 2750, 120) });
  const s = N.sugerirDieta(d, '2026-08-31');
  const ch = {}; s.forEach(x => { ch[x.chave] = 1; });
  assert.deepEqual(N.sugerirDieta({ ...d, decididas: ch }, '2026-08-31'), []);
});
