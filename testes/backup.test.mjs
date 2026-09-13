/**
 * Juntar um backup sem apagar o que esta na app.
 *
 * O que importa provar: o que so existe na app fica, o mesmo registo editado
 * e contado como atualizado, e um id repetido com outro conteudo trava tudo
 * em vez de trocar um treino por outro. E, com os dados reais, que o backup
 * de 25/08 (antes dos treinos de setembro) junta-se ao de 13/09 sem conflitos
 * e sem perder uma unica serie.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { nucleo, RAIZ } from './nucleo.mjs';

const { juntarBackup, LOJAS_BACKUP } = nucleo;

/* O que a IndexedDB faz com put() por id, para ver o resultado de juntar. */
function aplicar(atual, backup) {
  const out = {};
  for (const l of LOJAS_BACKUP) {
    const m = new Map((atual[l] || []).map(r => [r.id, r]));
    for (const r of backup[l] || []) m.set(r.id, r);
    out[l] = [...m.values()];
  }
  return out;
}

test('o que so existe na app fica, o novo entra, o editado atualiza', () => {
  const app = { sessoes: [{ id: 1, data: '2026-09-07' }, { id: 2, data: '2026-09-08' }],
    series: [{ id: 10, data: '2026-09-07', exercicioId: 5, peso: 100 }] };
  const bk = { sessoes: [{ id: 1, data: '2026-09-07' }, { id: 3, data: '2026-09-10' }],
    series: [{ id: 10, data: '2026-09-07', exercicioId: 5, peso: 110 }] };
  const r = juntarBackup(app, bk);
  assert.deepEqual(r.conflitos, []);
  assert.deepEqual(r.contagem.sessoes, { novos: 1, atualizados: 0, iguais: 1 });
  assert.deepEqual(r.contagem.series, { novos: 0, atualizados: 1, iguais: 0 });
  const depois = aplicar(app, bk);
  assert.deepEqual(depois.sessoes.map(s => s.id).sort(), [1, 2, 3]);
  assert.equal(depois.series[0].peso, 110);
});

test('mesmo id com outro dia e conflito, e nao conta como atualizado', () => {
  const app = { sessoes: [{ id: 1255, data: '2026-08-31' }] };
  const bk = { sessoes: [{ id: 1255, data: '2019-01-01' }] };
  const r = juntarBackup(app, bk);
  assert.equal(r.conflitos.length, 1);
  assert.deepEqual(r.conflitos[0], { loja: 'sessoes', id: 1255, atual: '2026-08-31', backup: '2019-01-01' });
  assert.equal(r.contagem.sessoes.atualizados, 0);
});

test('nome de exercicio com maiusculas ou espacos diferentes nao e conflito', () => {
  const r = juntarBackup({ exercicios: [{ id: 1, nome: 'Barbell Squat' }] },
    { exercicios: [{ id: 1, nome: ' barbell squat ' }] });
  assert.deepEqual(r.conflitos, []);
});

test('backup antigo sem lojas de alimentacao nao rebenta', () => {
  const r = juntarBackup({ alimentos: [{ id: 1, nome: 'Arroz' }] }, { series: [] });
  assert.deepEqual(r.conflitos, []);
  assert.deepEqual(r.contagem.alimentos, { novos: 0, atualizados: 0, iguais: 0 });
});

const P_NOVO = path.join(RAIZ, 'dados-reais', 'treinos-2026-09-13.json');
const P_VELHO = path.join(RAIZ, 'dados-reais', 'backup-com-plano.json');
const TEM = fs.existsSync(P_NOVO) && fs.existsSync(P_VELHO);

test('dados reais: juntar o backup de 25/08 ao de 13/09 nao perde nada',
  { skip: TEM ? false : 'faltam treinos-2026-09-13.json e backup-com-plano.json em dados-reais/' }, () => {
    const novo = JSON.parse(fs.readFileSync(P_NOVO, 'utf8'));
    const velho = JSON.parse(fs.readFileSync(P_VELHO, 'utf8'));
    const r = juntarBackup(novo, velho);
    assert.deepEqual(r.conflitos, [], JSON.stringify(r.conflitos.slice(0, 3)));

    // O pior caso de juntar ao contrario: o velho escreve por cima do novo.
    // Todas as series de setembro continuam la (podem voltar a feita:false).
    const depois = aplicar(novo, velho);
    assert.ok(depois.series.length >= novo.series.length);
    const ids = new Set(depois.series.map(s => s.id));
    for (const s of novo.series) assert.ok(ids.has(s.id), 'perdeu a serie ' + s.id);
    assert.equal(depois.pesagens.length >= novo.pesagens.length, true);
  });
