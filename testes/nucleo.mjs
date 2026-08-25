/**
 * Extrai o bloco de logica pura do index.html e devolve-o como modulo.
 *
 * A app e um ficheiro unico de proposito, mas a logica critica tem de poder
 * ser testada fora do browser. O bloco entre os marcadores NUCLEO:INICIO e
 * NUCLEO:FIM nao toca no DOM nem na base de dados, por isso corre tal e qual
 * em Node — basta acrescentar-lhe a lista de exportacoes.
 *
 * O ficheiro gerado fica em testes/_nucleo.gerado.mjs para se poder abrir e
 * ver o que e que foi mesmo testado.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const NOMES = [
  'LIMITE_FIAVEL', 'epley', 'brzycki', 'estimar1RM',
  'segundaDaSemana', 'chaveSemanaIso', 'chaveMes', 'diasEntre',
  'detetarSeparador', 'analisarCsv', 'normalizarCabecalho', 'ALTERNATIVAS',
  'detetarColunas', 'pareceCabecalho', 'COLUNAS_POR_DEFEITO',
  'analisarData', 'detetarOrdemDatas', 'analisarTempo', 'analisarNumero',
  'LBS_PARA_KG', 'traduzirGrupo', 'GRUPOS_APP', 'GRUPOS_CONHECIDOS',
  'serieFeita', 'importarFitNotes', 'detetarRecordes', 'melhoresPorExercicio',
  'curvaRepMax', 'melhorPesoParaReps', 'recordesPorReps',
  'agregarPorPeriodo', 'mediaRir', 'progressaoExercicio', 'pesoPorDiaParaReps',
  'recuarDias', 'PERIODOS', 'intervaloDoPeriodo', 'filtrarPorIntervalo',
  'progressoDeObjetivo'
];

function extrair() {
  const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');

  const marcaInicio = html.indexOf('NÚCLEO:INÍCIO');
  const marcaFim = html.indexOf('NÚCLEO:FIM');
  if (marcaInicio === -1 || marcaFim === -1 || marcaFim < marcaInicio) {
    throw new Error('Nao encontrei os marcadores do nucleo no index.html');
  }
  // O marcador de inicio esta dentro de um comentario: o codigo comeca a
  // seguir ao fecho desse comentario.
  const inicio = html.indexOf('*/', marcaInicio) + 2;
  // O marcador de fim tambem: o codigo acaba onde esse comentario abre.
  const fim = html.lastIndexOf('/*', marcaFim);
  const codigo = html.slice(inicio, fim);

  if (codigo.length < 2000) throw new Error('O bloco extraido e pequeno demais: ' + codigo.length);

  const cabecalho = '// GERADO AUTOMATICAMENTE a partir de index.html. Nao editar.\n';
  return cabecalho + codigo + '\nexport {\n  ' + NOMES.join(',\n  ') + '\n};\n';
}

const destino = path.join(RAIZ, 'testes', '_nucleo.gerado.mjs');
const gerado = extrair();
// So reescreve se mudou, para nao invalidar a cache de modulos sem motivo.
let atual = null;
try { atual = fs.readFileSync(destino, 'utf8'); } catch { /* ainda nao existe */ }
if (atual !== gerado) fs.writeFileSync(destino, gerado, 'utf8');

export const nucleo = await import('./_nucleo.gerado.mjs');
export default nucleo;
