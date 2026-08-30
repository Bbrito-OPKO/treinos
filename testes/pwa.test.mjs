/**
 * Verifica o que faz de isto uma PWA: o HTML, o manifesto, o service worker
 * e os icones. Sao coisas que so se veem no iPhone, mas cujos erros mais
 * comuns (um ficheiro fora da cache, uma meta tag em falta, um icone com o
 * tamanho errado) dao para apanhar aqui.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { RAIZ } from './nucleo.mjs';

const ler = (nome) => fs.readFileSync(path.join(RAIZ, nome), 'utf8');
const html = ler('index.html');

/* ------------------------------------------------------------------ HTML */

test('o JavaScript todo do index.html compila', () => {
  // Nao chega o nucleo compilar: o resto do ficheiro e que corre no telemovel.
  const inicio = html.indexOf('<script>');
  const fim = html.lastIndexOf('</script>');
  assert.ok(inicio !== -1 && fim > inicio, 'nao encontrei o bloco de script');
  const codigo = html.slice(inicio + 8, fim);
  assert.ok(codigo.length > 50000, 'o bloco parece curto de mais: ' + codigo.length);
  // new vm.Script faz o parse completo sem executar nada.
  assert.doesNotThrow(() => new vm.Script(codigo, { filename: 'index.html' }));
});

test('as meta tags do iOS estao la', () => {
  assert.match(html, /<meta charset="utf-8">/i);
  assert.match(html, /viewport-fit=cover/, 'sem isto o fundo nao chega ao notch');
  assert.match(html, /name="apple-mobile-web-app-capable" content="yes"/,
    'sem isto abre dentro do Safari em vez de ecra inteiro');
  assert.match(html, /name="apple-mobile-web-app-status-bar-style"/);
  assert.match(html, /rel="apple-touch-icon"/, 'sem isto o icone do ecra principal fica feio');
  assert.match(html, /rel="manifest"/);
  assert.match(html, /<html lang="pt-PT">/);
});

test('a barra de separadores respeita a zona do home indicator', () => {
  assert.match(html, /safe-area-inset-bottom/,
    'sem isto os botoes ficam por baixo da barra do iPhone');
  assert.match(html, /safe-area-inset-top/);
});

test('os campos de numero nao fazem o Safari dar zoom', () => {
  // O Safari amplia a pagina sempre que se foca um input com letra abaixo de
  // 16px. A regra tem de existir e ser de 16px para cima.
  const m = html.match(/input,select,textarea,button\{font:inherit;font-size:(\d+)px/);
  assert.ok(m, 'nao encontrei a regra de tamanho de letra dos campos');
  assert.ok(+m[1] >= 16, 'os campos tem ' + m[1] + 'px; abaixo de 16 o Safari da zoom');
});

test('os campos das séries abrem o teclado numérico certo', () => {
  // As séries editam-se nas linhas do treino, e é lá que os campos vivem.
  const linha = html.match(/function linhaEditavel\(([\s\S]*?)\n\}/);
  assert.ok(linha, 'não encontrei a linha editável');

  // O peso precisa de vírgula; as reps e o RIR são inteiros.
  assert.match(linha[1], /caixaComPassos\('peso',[^)]*inputmode="decimal"/,
    'o peso tem de abrir o teclado com vírgula');
  assert.match(linha[1], /caixaComPassos\('reps',[^)]*inputmode="numeric"/,
    'as reps são inteiras');
  assert.match(linha[1], /caixaComPassos\('rir',[\s\S]{0,200}?inputmode="numeric"/,
    'o RIR é inteiro');
});

test('tocar no peso, nas reps ou no RIR selecciona o valor todo', () => {
  // Sem isto, escrever num campo já preenchido junta-se ao que lá estava:
  // um 8 em cima de um 10 dava 108 em vez de 8.
  const ligar = html.match(/function ligarLinhasEditaveis\(\)([\s\S]*?)\n(?:\/\*|function )/);
  assert.ok(ligar, 'não encontrei ligarLinhasEditaveis');
  assert.match(ligar[1], /onfocus[\s\S]{0,160}setTimeout[\s\S]{0,80}\.select\(\)/,
    'a selecção tem de ser feita fora do focus, senão o iOS desfaz-a');
  const lista = ligar[1].match(/\[([^\]]*)\]\.forEach\(seleccionarAoTocar\)/);
  assert.ok(lista, 'não encontrei a lista de campos que seleccionam ao toque');
  for (const campo of ['campoPeso', 'campoReps', 'campoRir']) {
    assert.ok(lista[1].includes(campo), 'o ' + campo + ' não selecciona ao toque');
  }
});

test('os tres tipos de exercicio tem campos proprios', () => {
  // Sem isto, uma ida de bicicleta era tratada como peso e repetições.
  const m = html.match(/var CAMPOS_POR_TIPO = \{([\s\S]*?)\n\};/);
  assert.ok(m, 'nao encontrei CAMPOS_POR_TIPO');
  for (const tipo of ['peso_reps', 'peso_tempo', 'distancia_tempo']) {
    assert.ok(m[1].includes(tipo + ':'), 'falta o tipo ' + tipo);
  }
  assert.match(m[1], /distancia_tempo:\s*\['tempoMin',\s*'distancia'\]/,
    'o cardio nao pode pedir peso nem repeticoes');
});

test('o ecrã só se mantém ligado pela via oficial', () => {
  // Wake Lock, e nada de truques com vídeos escondidos a tocar em loop.
  assert.match(html, /navigator\.wakeLock\.request\('screen'\)/);
  // O bloqueio é largado pelo sistema quando a app sai de vista: sem voltar a
  // pedi-lo, o ecrã apagava-se para sempre a partir da primeira vez.
  assert.match(html, /visibilitychange[\s\S]{0,200}Ecra\.pedir\(\)/);
  // Ao sair de vista esquece-se o bloqueio antigo. Guardá-lo fazia com que o
  // pedido seguinte desistisse à porta, a segurar um objeto que já não segura
  // nada — e o ecrã apagava-se a partir da primeira ida ao background.
  assert.match(html, /if \(document\.hidden\) \{ Ecra\.bloqueio = null;/);
  assert.match(html, /this\.bloqueio\.released !== true/,
    'um bloqueio já largado tem de contar como não ter nenhum');
  assert.ok(!/<video/i.test(html), 'nada de vídeos escondidos para enganar o iOS');
});

test('nao ha nada vindo da rede', () => {
  // Uma unica referencia a um CDN e a app deixa de abrir em modo de aviao.
  const externos = html.match(/(?:src|href)\s*=\s*["'](https?:)?\/\/[^"']+/gi) || [];
  assert.deepEqual(externos, [], 'referencias externas encontradas: ' + externos.join(', '));
  assert.ok(!/cdn\.|unpkg|jsdelivr|googleapis/i.test(html), 'ha uma referencia a um CDN');
});

test('nao se usam alert, confirm nem prompt', () => {
  // Bloqueiam o WebView: enquanto a caixa estiver aberta nada mais responde,
  // e no ecra principal do iOS aparecem com o nome do site por cima.
  // Os comentarios sao tirados primeiro, senao uma frase a explicar porque e
  // que nao se usa confirm() faz o teste falhar.
  const codigo = html.slice(html.indexOf('<script>'))
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

  assert.ok(codigo.length > 40000, 'sobrou pouco codigo depois de tirar os comentarios');
  assert.ok(!/(^|[^.\w])alert\s*\(/.test(codigo), 'ha um alert()');
  assert.ok(!/(^|[^.\w])confirm\s*\(/.test(codigo), 'ha um confirm() nativo');
  assert.ok(!/(^|[^.\w])prompt\s*\(/.test(codigo), 'ha um prompt()');
});

/* -------------------------------------------------------------- manifesto */

test('o manifest.json e valido e completo', () => {
  const m = JSON.parse(ler('manifest.json'));
  assert.equal(m.display, 'standalone', 'sem standalone nao abre como app');
  assert.equal(m.start_url, '.', 'relativo, para funcionar em qualquer subpasta do GitHub Pages');
  assert.equal(m.scope, '.');
  assert.ok(m.name && m.short_name);
  assert.ok(m.short_name.length <= 12, 'o nome curto e o que aparece por baixo do icone');
  assert.equal(m.lang, 'pt-PT');
  assert.ok(Array.isArray(m.icons) && m.icons.length >= 2);
  assert.match(m.background_color, /^#[0-9a-f]{6}$/i);
  assert.match(m.theme_color, /^#[0-9a-f]{6}$/i);
});

test('os icones do manifesto existem mesmo e tem o tamanho declarado', () => {
  const m = JSON.parse(ler('manifest.json'));
  for (const icone of m.icons) {
    const caminho = path.join(RAIZ, icone.src);
    assert.ok(fs.existsSync(caminho), 'falta o ficheiro ' + icone.src);

    // Le a largura e a altura do cabecalho IHDR de um PNG (bytes 16 a 24).
    const bytes = fs.readFileSync(caminho);
    assert.equal(bytes.toString('ascii', 1, 4), 'PNG', icone.src + ' nao e um PNG');
    const largura = bytes.readUInt32BE(16);
    const altura = bytes.readUInt32BE(20);
    const [decLargura, decAltura] = icone.sizes.split('x').map(Number);
    assert.equal(largura, decLargura, icone.src + ': largura real ' + largura);
    assert.equal(altura, decAltura, icone.src + ': altura real ' + altura);
  }
  assert.ok(m.icons.some(i => i.sizes === '512x512'), 'o Android pede um de 512');
  assert.ok(m.icons.some(i => i.purpose && i.purpose.includes('maskable')),
    'sem um maskable o icone fica dentro de um quadrado branco');
});

test('o apple-touch-icon existe e tem 180x180', () => {
  const m = html.match(/rel="apple-touch-icon" href="([^"]+)"/);
  assert.ok(m, 'nao encontrei o apple-touch-icon');
  const bytes = fs.readFileSync(path.join(RAIZ, m[1]));
  assert.equal(bytes.readUInt32BE(16), 180, 'o iOS quer 180x180');
  assert.equal(bytes.readUInt32BE(20), 180);
});

/* --------------------------------------------------------- service worker */

test('o service worker compila e tem versao', () => {
  const sw = ler('sw.js');
  assert.doesNotThrow(() => new vm.Script(sw, { filename: 'sw.js' }));
  assert.match(sw, /const CACHE = '[^']+'/, 'a cache precisa de nome com versao');
  assert.match(sw, /skipWaiting/, 'sem isto uma versao nova fica presa ate fechar todos os separadores');
  assert.match(sw, /clients\.claim/);
});

test('o service worker cacheia todos os ficheiros da app', () => {
  const sw = ler('sw.js');
  const lista = sw.match(/const FICHEIROS = \[([\s\S]*?)\]/);
  assert.ok(lista, 'nao encontrei a lista de ficheiros');
  const nomes = [...lista[1].matchAll(/'([^']+)'/g)].map(m => m[1]);

  // Tudo o que o index.html pede tem de estar na cache, senao a app abre
  // offline mas sem icone, sem manifesto ou sem estilos.
  const pedidos = [...html.matchAll(/(?:src|href)="([^":]+)"/g)]
    .map(m => m[1])
    .filter(u => !u.startsWith('#') && !u.startsWith('data:'));

  for (const pedido of pedidos) {
    assert.ok(nomes.includes(pedido), pedido + ' e pedido pelo index.html mas nao esta na cache');
  }
  assert.ok(nomes.includes('./') || nomes.includes('index.html'), 'falta a propria pagina');

  for (const nome of nomes) {
    if (nome === './') continue;
    assert.ok(fs.existsSync(path.join(RAIZ, nome)), nome + ' esta na cache mas nao existe');
  }
});

test('o service worker nao engole os pedidos que nao sao GET', () => {
  const sw = ler('sw.js');
  assert.match(sw, /method !== 'GET'/, 'so os GET e que se cacheiam');
});

test('nada no repositorio deixa escapar os dados de treino', () => {
  // A pasta dados-reais tem 6 anos de treinos do Bruno e o repositorio e
  // publico: tem de estar no .gitignore.
  const ignore = ler('.gitignore');
  assert.match(ignore, /dados-reais/, 'dados-reais tem de ficar fora do git');
  assert.match(ignore, /_nucleo\.gerado\.mjs/);
});
