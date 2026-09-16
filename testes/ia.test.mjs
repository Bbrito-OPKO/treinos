/**
 * F5: revisao pela IA.
 *
 * Nao se chama a API aqui (custa dinheiro e precisa da chave). Prova-se o que
 * a app controla: o pedido que sai, o resumo que leva, e sobretudo o filtro
 * das respostas — o que a IA disser so entra se se aplicar com as funcoes que
 * ja existem e o plano continuar a passar nas 17 provas.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { nucleo as N, RAIZ } from './nucleo.mjs';

const copia = x => JSON.parse(JSON.stringify(x));
const HOJE = '2026-09-16';
const cfg = () => copia(N.PLANO_CONFIG_PADRAO);
const resposta = (sugestoes, extra = {}) => ({
  stop_reason: 'end_turn',
  content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: JSON.stringify({ sugestoes }) }],
  ...extra
});
const sug = (o) => ({ tipo: 'nota', titulo: 't', detalhe: 'd', nome: '', novo_kg: 0, plano: '', refeicao: '', gramas: 0, ...o });
const ctxTreino = (o = {}) => ({ hoje: HOJE, cfg: cfg(), pausados: [], planoAlimentar: null, area: 'treino', ...o });

const item = (refeicao, nome, gramas, ajustavel, kcal = 350) =>
  ({ refeicao, nome, gramas, ajustavel, por100: { kcal, p: 10, h: 60, g: 5 } });
const planoAlimentar = () => ({ versoes: [{ desde: '2026-09-14',
  treino: [item('Pequeno-almoço', 'Aveia', 60, true), item('Jantar', 'Arroz', 200, true, 130), item('Meio da manhã', 'Uvas', 150, 'subir', 70)],
  descanso: [item('Pequeno-almoço', 'Aveia', 60, true), item('Jantar', 'Arroz', 150, true, 130)] }] });
const ctxComida = (o = {}) => ({ hoje: HOJE, cfg: cfg(), pausados: [], planoAlimentar: planoAlimentar(), area: 'comida', ...o });

/* --- o pedido --- */

test('pedido: modelo, fallback, saida estruturada, e nenhuma chave no corpo', () => {
  const p = N.pedidoIA({ hoje: HOJE }, 'treino');
  assert.equal(p.model, 'claude-opus-5');
  assert.equal(p.fallbacks, 'default');
  assert.equal(p.output_config.format.type, 'json_schema');
  assert.deepEqual(p.output_config.format.schema, N.IA_ESQUEMA);
  assert.ok(!('thinking' in p) && !('temperature' in p), 'no Opus 5 o thinking e adaptativo por defeito');
  assert.ok(!/sk-ant/.test(JSON.stringify(p)));
  assert.match(p.messages[0].content, /treino/);
  assert.match(N.pedidoIA({}, 'comida').messages[0].content, /alimentação/);
});

test('cabecalhos: chave, versao, beta do fallback e acesso direto do browser', () => {
  const h = N.iaCabecalhos('sk-ant-x');
  assert.equal(h['x-api-key'], 'sk-ant-x');
  assert.equal(h['anthropic-version'], '2023-06-01');
  assert.equal(h['anthropic-beta'], 'server-side-fallback-2026-07-01');
  assert.equal(h['anthropic-dangerous-direct-browser-access'], 'true');
});

test('esquema: todos os campos obrigatorios e sem propriedades extra (saida estruturada exige)', () => {
  const it = N.IA_ESQUEMA.properties.sugestoes.items;
  assert.equal(it.additionalProperties, false);
  assert.deepEqual([...it.required].sort(), Object.keys(it.properties).sort());
  assert.deepEqual(it.properties.tipo.enum, ['carga', 'estagnado', 'descarga', 'dieta-gramas', 'nota']);
});

test('erros HTTP em frase curta', () => {
  assert.match(N.erroIA(401, null), /chave não foi aceite/);
  assert.match(N.erroIA(429, null), /Limite/);
  assert.match(N.erroIA(529, null), /sobrecarregada/);
  assert.match(N.erroIA(400, { error: { message: 'x mau' } }), /x mau/);
});

/* --- o resumo --- */

test('resumo: 4 semanas de treino com o feito e o planeado, sem ids', () => {
  const c = cfg();
  const ciclos = [{ dataInicio: '2026-08-31', cfg: c, gravado: null }];
  const plano = N.gerarPlano(c);
  const nomes = new Set();
  plano.calendario.forEach(s => Object.values(s.dias).forEach(d => d.exercicios.forEach(e => nomes.add(({ 'Peso morto convencional': 'Deadlift',
    'Supino plano com barra': 'Flat Barbell Bench Press', 'Agachamento com barra livre': 'Barbell Squat',
    'Press de ombro com barra': 'Barbell Shoulder Press' })[e.nome] || e.nome))));
  const exercicios = [...nomes].map((nome, i) => ({ id: i + 1, nome, tipo: 'peso_reps' }));
  const r = N.planoParaSessoes(plano, exercicios, [], { sessao: 1, serie: 1 });
  r.series.filter(s => s.data === '2026-09-14').forEach(s => { s.feita = true; s.rir = 2; });
  const res = N.resumoParaIA({ hoje: HOJE, ciclos, cfg: c, pausados: ['Leg Press'], sessoes: r.sessoes, series: r.series,
    exercicios, pesagens: [{ data: '2026-09-15', kg: 92.4 }, { data: '2026-01-01', kg: 99 }],
    avaliacoes: [{ data: '2026-09-14', cintura: 90 }], perfil: { objetivo: 'perder' }, planoAlimentar: planoAlimentar() });
  assert.equal(res.objetivo, 'Perder gordura');
  assert.equal(res.acessorios.length, c.acc.length);
  assert.deepEqual(res.fora_do_ciclo_seguinte, ['Leg Press']);
  assert.ok(res.treinos_4_semanas.every(t => t.data >= '2026-08-19' && t.data < HOJE));
  const seg = res.treinos_4_semanas.find(t => t.data === '2026-09-14');
  assert.equal(seg.estado, 'feito');
  assert.ok(seg.feito.some(l => /RIR2/.test(l)), 'o RIR vai no resumo');
  assert.equal(res.treinos_4_semanas.find(t => t.data === '2026-09-15').estado, 'nao feito');
  assert.deepEqual(res.pesagens_4_semanas, ['2026-09-15 92,4 kg'], 'so as ultimas 4 semanas');
  assert.equal(res.plano_alimentar.dia_de_treino[2].ajustavel, 'so subir');
  assert.ok(!/"id"|sessaoId|exercicioId/.test(JSON.stringify(res)));
});

/* --- a resposta: erros --- */

test('resposta: recusa, corte, JSON partido e vazio dao erro e nada entra', () => {
  assert.match(N.lerRespostaIA(resposta([], { stop_reason: 'refusal' }), ctxTreino()).erro, /recusou/);
  assert.match(N.lerRespostaIA(resposta([], { stop_reason: 'max_tokens' }), ctxTreino()).erro, /cortada/);
  assert.match(N.lerRespostaIA({ content: [{ type: 'text', text: '{"sug' }] }, ctxTreino()).erro, /formato/);
  assert.match(N.lerRespostaIA({ content: [{ type: 'text', text: '{"outra":1}' }] }, ctxTreino()).erro, /formato/);
  assert.match(N.lerRespostaIA(null, ctxTreino()).erro, /vazia/);
});

/* --- carga --- */

test('carga: acessorio do plano, arredondada a 2,5, no formato das regras', () => {
  const r = N.lerRespostaIA(resposta([sug({ tipo: 'carga', nome: 'Leg Press', novo_kg: 116 })]), ctxTreino());
  assert.equal(r.recusadas.length, 0);
  const s = r.sugestoes[0];
  assert.equal(s.tipo, 'carga');
  assert.equal(s.antes, 110);
  assert.equal(s.novo, 115);
  assert.equal(s.chave, 'ia|carga|Leg Press|' + HOJE);
  assert.match(s.titulo, /^IA · Leg Press: 110 → 115 kg$/);
});

test('carga: nome inventado, mais de 25%, a mesma carga, ou pedida na comida sao recusadas', () => {
  const r = N.lerRespostaIA(resposta([
    sug({ tipo: 'carga', nome: 'Supino inventado', novo_kg: 50 }),
    sug({ tipo: 'carga', nome: 'Leg Press', novo_kg: 140 }),
    sug({ tipo: 'carga', nome: 'Leg Press', novo_kg: 110 })
  ]), ctxTreino());
  assert.equal(r.sugestoes.length, 0);
  assert.deepEqual(r.recusadas.map(x => x.motivo), [
    '"Supino inventado" não é um acessório do plano', '110 → 140 kg muda mais de 25%', 'a carga já é essa']);
  assert.equal(N.lerRespostaIA(resposta([sug({ tipo: 'carga', nome: 'Leg Press', novo_kg: 115 })]), ctxComida()).sugestoes.length, 0);
});

test('carga: exatamente 25% ainda passa', () => {
  const r = N.lerRespostaIA(resposta([sug({ tipo: 'carga', nome: 'Leg Press', novo_kg: 137.5 })]), ctxTreino());
  assert.equal(r.sugestoes.length, 1);
});

/* --- estagnado, descarga, nota --- */

test('estagnado: tira do ciclo seguinte se o plano sem ele passar nas 17 provas', () => {
  const r = N.lerRespostaIA(resposta([sug({ tipo: 'estagnado', nome: 'Leg Press' })]), ctxTreino());
  assert.equal(r.sugestoes[0].tipo, 'estagnado');
  assert.equal(r.sugestoes[0].nome, 'Leg Press');
  const ja = N.lerRespostaIA(resposta([sug({ tipo: 'estagnado', nome: 'Leg Press' })]), ctxTreino({ pausados: ['Leg Press'] }));
  assert.match(ja.recusadas[0].motivo, /já sai/);
});

test('17 provas: um acessorio cuja saida parte o plano e recusado', () => {
  // Tirar TODOS os acessorios de perna menos um deixa o gerador sem por onde escolher.
  const c = cfg();
  const perna = c.acc.filter(a => a[1] === 'perna').map(a => a[0]);
  const pausados = perna.slice(1);
  const r = N.lerRespostaIA(resposta([sug({ tipo: 'estagnado', nome: perna[0] })]), ctxTreino({ pausados }));
  assert.equal(r.sugestoes.length, 0);
  assert.match(r.recusadas[0].motivo, /17 provas|não se consegue gerar/);
});

test('descarga: os 8 dias a partir de hoje; nota: so Ok', () => {
  const r = N.lerRespostaIA(resposta([sug({ tipo: 'descarga' }), sug({ tipo: 'nota', titulo: 'Dorme mais' })]), ctxTreino());
  assert.equal(r.sugestoes[0].tipo, 'descarga');
  assert.equal(r.sugestoes[0].depoisDe, '2026-09-15');
  assert.equal(r.sugestoes[1].informativa, true);
  assert.equal(r.sugestoes[1].titulo, 'IA · Dorme mais');
});

test('tipo desconhecido e repetidas sao recusadas', () => {
  const r = N.lerRespostaIA(resposta([sug({ tipo: 'apagar-tudo' }), sug({ tipo: 'descarga' }), sug({ tipo: 'descarga' })]), ctxTreino());
  assert.equal(r.sugestoes.length, 1);
  assert.deepEqual(r.recusadas.map(x => x.motivo), ['tipo desconhecido', 'repetida']);
});

/* --- dieta --- */

test('dieta-gramas: muda so o alimento, a refeicao e o tipo de dia pedidos', () => {
  const r = N.lerRespostaIA(resposta([sug({ tipo: 'dieta-gramas', nome: 'Arroz', refeicao: 'Jantar', plano: 'treino', gramas: 222 })]), ctxComida());
  assert.equal(r.recusadas.length, 0, JSON.stringify(r.recusadas));
  const s = r.sugestoes[0];
  assert.equal(s.tipo, 'dieta-plano', 'usa o caminho de aceitar que ja existe');
  assert.deepEqual(s.linhas, ['Treino · Jantar: Arroz 200 → 220 g']);
  assert.equal(s.novoPlano.treino[1].gramas, 220);
  assert.equal(s.novoPlano.descanso[1].gramas, 150);
  assert.deepEqual(s.mudanca, { nome: 'Arroz', refeicao: 'Jantar', plano: 'treino', gramas: 220 });
});

test('dieta-gramas: ambos os dias; e recusa inventado, >50%, e baixar o que so sobe', () => {
  const r = N.lerRespostaIA(resposta([
    sug({ tipo: 'dieta-gramas', nome: 'Aveia', plano: 'ambos', gramas: 55 }),
    sug({ tipo: 'dieta-gramas', nome: 'Bolo', plano: 'ambos', gramas: 50 }),
    sug({ tipo: 'dieta-gramas', nome: 'Arroz', plano: 'treino', gramas: 320 }),
    sug({ tipo: 'dieta-gramas', nome: 'Uvas', plano: 'treino', gramas: 100 })
  ]), ctxComida());
  assert.deepEqual(r.sugestoes[0].linhas, ['Treino · Pequeno-almoço: Aveia 60 → 55 g', 'Descanso · Pequeno-almoço: Aveia 60 → 55 g']);
  assert.deepEqual(r.recusadas.map(x => x.motivo), [
    '"Bolo" não está no plano, ou já tem essas gramas', 'Arroz 200 → 320 g muda mais de 50%', 'Uvas só pode subir']);
});

test('dieta-gramas: ambos com gramas diferentes nos dois dias e recusado (nao sobe um a baixar o outro)', () => {
  const r = N.lerRespostaIA(resposta([sug({ tipo: 'dieta-gramas', nome: 'Arroz', refeicao: 'Jantar', plano: 'ambos', gramas: 180 })]), ctxComida());
  assert.equal(r.sugestoes.length, 0);
  assert.equal(r.recusadas[0].motivo, 'Arroz tem gramas diferentes (150 e 200 g): um dia de cada vez');
});

test('dieta-gramas: a refeicao conta (a aveia nao esta ao jantar)', () => {
  const r = N.lerRespostaIA(resposta([sug({ tipo: 'dieta-gramas', nome: 'Aveia', refeicao: 'Jantar', plano: 'treino', gramas: 70 })]), ctxComida());
  assert.equal(r.sugestoes.length, 0);
  assert.equal(r.recusadas[0].motivo, '"Aveia" não está no plano em Jantar, ou já tem essas gramas');
});

test('dieta-gramas: duas aceites seguidas nao se apagam (a UI reaplica sobre o plano de agora)', () => {
  const pa = planoAlimentar();
  const a = N.aplicarDietaGramas(pa, { nome: 'Arroz', refeicao: 'Jantar', plano: 'treino', gramas: 220 });
  pa.versoes.push({ desde: HOJE, ...a.novoPlano });
  const b = N.aplicarDietaGramas(pa, { nome: 'Aveia', refeicao: '', plano: 'treino', gramas: 70 });
  assert.equal(b.novoPlano.treino[1].gramas, 220, 'o arroz aceite antes fica');
  assert.equal(b.novoPlano.treino[0].gramas, 70);
});

test('dieta-gramas no foco do treino e recusada; sem plano alimentar tambem', () => {
  assert.equal(N.lerRespostaIA(resposta([sug({ tipo: 'dieta-gramas', nome: 'Arroz', plano: 'ambos', gramas: 180 })]),
    ctxTreino({ planoAlimentar: planoAlimentar() })).recusadas[0].motivo, 'fora do foco pedido');
  assert.match(N.lerRespostaIA(resposta([sug({ tipo: 'dieta-gramas', nome: 'Arroz', plano: 'ambos', gramas: 180 })]),
    ctxComida({ planoAlimentar: null })).recusadas[0].motivo, /não há plano/);
});

/* --- a chave --- */

test('a chave e as sugestoes da IA nunca vao no backup', () => {
  assert.ok(!N.DEFINICOES_NO_BACKUP.includes('chaveIA'));
  assert.ok(!N.DEFINICOES_NO_BACKUP.includes('sugestoesIA'));
});

test('nenhuma chave escrita no codigo (o repo e publico)', () => {
  for (const f of ['index.html', 'sw.js', 'LEIA-ME.md']) {
    const t = fs.readFileSync(path.join(RAIZ, f), 'utf8');
    assert.ok(!/sk-ant-[A-Za-z0-9_-]{8,}/.test(t), f);
  }
});
