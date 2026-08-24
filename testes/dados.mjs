/**
 * Onde estao os dados reais para os testes que valem mais.
 *
 * O historico do Bruno NAO entra no repositorio: sao 6 anos de treinos dele e
 * o repositorio e publico. A pasta dados-reais/ esta no .gitignore.
 *
 * Sem esses ficheiros os testes continuam a correr — os que dependem deles
 * dizem que foram saltados, em vez de passarem em silencio a testar nada.
 */
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ } from './nucleo.mjs';

const PASTA = process.env.TREINOS_DADOS_REAIS || path.join(RAIZ, 'dados-reais');

function ler(nome) {
  const p = path.join(PASTA, nome);
  return fs.existsSync(p) ? p : null;
}

export const CAMINHO_CSV = ler('fitnotes.csv');
export const CAMINHO_BACKUP = ler('backup-fitnotes.json');
export const TEM_DADOS = Boolean(CAMINHO_CSV && CAMINHO_BACKUP);

export const SEM_DADOS = {
  skip: TEM_DADOS ? false
    : 'faltam os dados reais em dados-reais/ (fitnotes.csv e backup-fitnotes.json)'
};

export function csv() { return fs.readFileSync(CAMINHO_CSV, 'utf8'); }
export function backup() { return JSON.parse(fs.readFileSync(CAMINHO_BACKUP, 'utf8')); }

/**
 * Os numeros do historico real, medidos directamente no ficheiro exportado e
 * na base do FitNotes. Servem de rede: se um dia o parser passar a perder
 * linhas, e aqui que rebenta.
 */
export const ESPERADO = {
  series: 28747,
  sessoes: 1130,
  exercicios: 131,
  de: '2020-01-13',
  ate: '2026-08-07',
  notasMultiLinha: 64,
  recordesMarcadosPelaApp: 1187,
  seriesComRir: 0,
  categorias: ['Abdominais', 'Bíceps', 'Cardio', 'Costas', 'Ombros', 'Peito', 'Pernas', 'Tríceps']
};
