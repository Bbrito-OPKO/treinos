/**
 * Comida: a tabela do INSA, a pesquisa, as somas e o Open Food Facts.
 *
 * A tabela entra no repositorio (alimentos-insa.json), por isso estes testes
 * correm sempre. Os valores de referencia foram lidos no Excel do INSA v7.1.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { nucleo as N, RAIZ } from './nucleo.mjs';

const json = JSON.parse(fs.readFileSync(path.join(RAIZ, 'alimentos-insa.json'), 'utf8'));
const insa = N.alimentosDoInsa(json);
const porNome = n => insa.find(a => a.nome === n);

test('INSA: 1376 alimentos, com a fonte que as condicoes pedem', () => {
  assert.equal(insa.length, 1376);
  assert.match(json.fonte, /Instituto Nacional de Saúde Doutor Ricardo Jorge/);
  assert.match(json.fonte, /v 7\.1 - 2026/);
  assert.equal(new Set(insa.map(a => a.id)).size, insa.length, 'ids repetidos');
});

test('INSA: valores lidos no Excel batem (abacate, peito de frango, arroz)', () => {
  assert.deepEqual(porNome('Abacate, Hass').por100, { kcal: 176, p: 1.1, h: 2.3, g: 17.4, fibra: 3, acucar: 2.3, sal: 0 });
  assert.deepEqual(porNome('Frango, peito sem pele, cru').por100, { kcal: 108, p: 24.1, h: 0, g: 1.2, fibra: 0, acucar: 0, sal: 0.2 });
  assert.equal(porNome('Arroz cozido simples').por100.kcal, 125);
});

test('INSA: kcal coerentes com os macros em 99% (apanha colunas trocadas)', () => {
  const fora = insa.filter(a => a.grupo !== 'Bebidas alcoólicas' && a.por100.kcal > 20 &&
    Math.abs(4 * a.por100.p + 4 * a.por100.h + 9 * a.por100.g + 2 * a.por100.fibra - a.por100.kcal) / a.por100.kcal > 0.15);
  assert.ok(fora.length <= 14, fora.length + ' fora: ' + fora.slice(0, 5).map(a => a.nome).join(', '));
});

test('pesquisa: sem acentos, por palavras, em qualquer ordem', () => {
  const r = N.pesquisarAlimentos(insa, 'frango peito cru', {}, 10).map(a => a.nome);
  assert.ok(r.includes('Frango, peito sem pele, cru'), r.join(' | '));
  assert.ok(N.pesquisarAlimentos(insa, 'abobora', {}, 5).some(a => a.nome.startsWith('Abóbora')));
  assert.deepEqual(N.pesquisarAlimentos(insa, 'xyzzy', {}, 5), []);
  assert.deepEqual(N.pesquisarAlimentos(insa, '   ', {}, 5), []);
});

test('pesquisa: o que ja se usou vem primeiro, e o simples antes do prato', () => {
  const r = N.pesquisarAlimentos(insa, 'arroz', {}, 40).map(a => a.nome);
  assert.ok(r.indexOf('Arroz cozido simples') < r.indexOf('Arroz à valenciana'));
  const id = porNome('Arroz à valenciana').id;
  const usos = {}; usos[id] = 3;
  assert.equal(N.pesquisarAlimentos(insa, 'arroz', usos, 5)[0].nome, 'Arroz à valenciana');
});

test('macros: 150 g de peito de frango cru', () => {
  assert.deepEqual(N.macrosDe(porNome('Frango, peito sem pele, cru').por100, 150), { kcal: 162, p: 36.2, h: 0, g: 1.8 });
});

test('totais do dia: soma por refeicao e no total, ignora outros dias', () => {
  const frango = porNome('Frango, peito sem pele, cru'), arroz = porNome('Arroz cozido simples');
  const comidas = [
    { ...N.registoDeComida(frango, '2026-09-14', 'Almoço', 150), id: 1 },
    { ...N.registoDeComida(arroz, '2026-09-14', 'Almoço', 200), id: 2 },
    { ...N.registoDeComida(arroz, '2026-09-14', 'Jantar', 100), id: 3 },
    { ...N.registoDeComida(arroz, '2026-09-13', 'Jantar', 999), id: 4 },
  ];
  const t = N.totaisDoDia(comidas, '2026-09-14');
  assert.equal(t.porRefeicao['Almoço'].kcal, 162 + 250);
  assert.equal(t.porRefeicao['Almoço'].itens.length, 2);
  assert.equal(t.porRefeicao['Jantar'].kcal, 125);
  assert.equal(t.total.kcal, 162 + 250 + 125);
  assert.equal(t.total.p, 36.2 + 5 + 2.5);
  assert.equal(t.porRefeicao['Lanche'].kcal, 0);
});

test('o registo leva copia dos valores: mudar o alimento nao muda o que foi comido', () => {
  const a = { id: 'meu:1', origem: 'meu', nome: 'Batido', por100: { kcal: 100, p: 10, h: 5, g: 2 } };
  const r = N.registoDeComida(a, '2026-09-14', 'Lanche', 300);
  a.por100.kcal = 999;
  assert.equal(N.macrosDe(r.por100, r.gramas).kcal, 300);
});

test('Open Food Facts: produto real (leite Mimosa meio-gordo, 5601049132995)', () => {
  const a = N.alimentoDoOff({ code: '5601049132995', product_name: 'Leite Meio-Gordo Mimosa', brands: 'Mimosa',
    nutriments: { 'energy-kcal_100g': 48, energy_100g: 200, proteins_100g: 3.4, carbohydrates_100g: 4.9, fat_100g: 1.6, sugars_100g: 4.9, salt_100g: 0.1 } });
  assert.deepEqual(a, { id: 'off:5601049132995', origem: 'off', nome: 'Leite Meio-Gordo Mimosa', marca: 'Mimosa',
    codigoBarras: '5601049132995', incompleto: false,
    por100: { kcal: 48, p: 3.4, h: 4.9, g: 1.6, fibra: 0, acucar: 4.9, sal: 0.1 } });
});

test('Open Food Facts: so kJ converte; sem energia ou sem nome devolve null; macro em falta marca incompleto', () => {
  assert.equal(N.alimentoDoOff({ code: '1', product_name: 'X', nutriments: { energy_100g: 418.4, proteins_100g: 1, carbohydrates_100g: 1, fat_100g: 1 } }).por100.kcal, 100);
  assert.equal(N.alimentoDoOff({ code: '1', product_name: 'X', nutriments: { proteins_100g: 1 } }), null);
  assert.equal(N.alimentoDoOff({ code: '1', product_name: '', nutriments: { 'energy-kcal_100g': 5 } }), null);
  assert.equal(N.alimentoDoOff({ code: '1', product_name: 'X', nutriments: { 'energy-kcal_100g': 5, fat_100g: 1 } }).incompleto, true);
  assert.equal(N.alimentoDoOff(null), null);
});

test('copiar ontem: tudo ou so uma refeicao, sem ids, data nova', () => {
  const arroz = porNome('Arroz cozido simples');
  const comidas = [
    { ...N.registoDeComida(arroz, '2026-09-13', 'Almoço', 200), id: 1 },
    { ...N.registoDeComida(arroz, '2026-09-13', 'Jantar', 100), id: 2 },
    { ...N.registoDeComida(arroz, '2026-09-12', 'Jantar', 100), id: 3 },
  ];
  const tudo = N.copiarComidas(comidas, '2026-09-13', '2026-09-14');
  assert.equal(tudo.length, 2);
  assert.ok(tudo.every(c => c.data === '2026-09-14' && c.id === undefined));
  assert.equal(comidas[0].data, '2026-09-13', 'nao mexe no original');
  assert.equal(N.copiarComidas(comidas, '2026-09-13', '2026-09-14', 'Jantar').length, 1);
});

test('habitos: conta usos e lembra as gramas da ultima vez', () => {
  const h = N.habitosDeComida([
    { ref: 'insa:11', gramas: 150, data: '2026-09-10' },
    { ref: 'insa:11', gramas: 180, data: '2026-09-12' },
    { ref: 'insa:403', gramas: 200, data: '2026-09-11' },
  ]);
  assert.deepEqual(h.usos, { 'insa:11': 2, 'insa:403': 1 });
  assert.equal(h.gramas['insa:11'], 180);
});
