/**
 * Prova a migracao da base num Chrome a serio, com os dados reais.
 *
 * A IndexedDB nao existe em Node, e o que interessa e o que acontece no
 * telemovel: a app velha tem os treinos dele, chega a app nova e abre a base
 * numa versao acima. Isto faz exatamente isso:
 *
 *   1. abre a versao que esta no ramo main (a que o iPhone tem hoje)
 *   2. escreve la o backup real, loja a loja, e tira uma impressao digital
 *   3. abre a versao do disco, na mesma origem e no mesmo perfil
 *   4. volta a tirar a impressao digital e compara
 *
 * Chrome sem janela e com perfil proprio numa pasta temporaria: nao toca no
 * Chrome do Bruno. No fim mata so esse processo.
 *
 * Uso: node ferramentas/provar_migracao.mjs dados-reais/treinos-2026-09-13.json
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const BACKUP = path.resolve(process.argv[2] || path.join(RAIZ, 'dados-reais', 'treinos-2026-09-13.json'));
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORTA_HTTP = 8791, PORTA_CDP = 9335;
const REF_VELHA = process.env.REF_VELHA || 'main';

const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'treinos-migracao-'));
fs.writeFileSync(path.join(pasta, 'velha.html'),
  execFileSync('git', ['show', REF_VELHA + ':index.html'], { cwd: RAIZ, maxBuffer: 64e6 }));
fs.copyFileSync(path.join(RAIZ, 'index.html'), path.join(pasta, 'nova.html'));
fs.copyFileSync(BACKUP, path.join(pasta, 'backup.json'));

const servidor = http.createServer((req, res) => {
  const f = path.join(pasta, path.basename(req.url.split('?')[0]));
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/json' });
  fs.createReadStream(f).pipe(res);
}).listen(PORTA_HTTP, '127.0.0.1');

const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + PORTA_CDP,
  '--user-data-dir=' + path.join(pasta, 'perfil'), '--no-first-run', 'about:blank'], { stdio: 'ignore' });

const espera = ms => new Promise(r => setTimeout(r, ms));

async function ligar() {
  for (let i = 0; i < 50; i++) {
    try {
      const lista = await (await fetch(`http://127.0.0.1:${PORTA_CDP}/json/list`)).json();
      const pag = lista.find(t => t.type === 'page');
      if (pag) return pag.webSocketDebuggerUrl;
    } catch { /* ainda a arrancar */ }
    await espera(200);
  }
  throw new Error('o Chrome nao abriu a porta de depuracao');
}

let ws, seq = 0;
const pendentes = new Map();
function cdp(metodo, params = {}) {
  const id = ++seq;
  ws.send(JSON.stringify({ id, method: metodo, params }));
  return new Promise((ok, falha) => pendentes.set(id, { ok, falha }));
}
async function avaliar(expr) {
  const r = await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 600));
  return r.result.value;
}
async function abrir(pagina) {
  await cdp('Page.navigate', { url: `http://127.0.0.1:${PORTA_HTTP}/${pagina}` });
  for (let i = 0; i < 100; i++) {
    await espera(100);
    try { if (await avaliar('typeof BD === "object" && document.readyState === "complete"')) break; } catch { }
  }
  await espera(1500); // a app acaba de arrancar (carregarTudo, exercicios de partida)
}

/* Impressao digital de cada loja: quantos registos e um hash do conteudo
   ordenado por id. Se um unico campo de uma unica serie mudar, o hash muda. */
const IMPRESSAO = `(async () => {
  const bd = await BD.abrir();
  const lojas = [...bd.objectStoreNames];
  const out = { versao: bd.version, lojas: {} };
  for (const l of lojas) {
    const todos = await BD.todos(l);
    todos.sort((a, b) => String(a.id ?? a.chave) < String(b.id ?? b.chave) ? -1 : 1);
    const texto = JSON.stringify(todos);
    const dig = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
    out.lojas[l] = { n: todos.length, hash: [...new Uint8Array(dig)].slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('') };
  }
  return out;
})()`;

try {
  ws = new WebSocket(await ligar());
  await new Promise((ok, falha) => { ws.onopen = ok; ws.onerror = falha; });
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && pendentes.has(m.id)) {
      const p = pendentes.get(m.id); pendentes.delete(m.id);
      m.error ? p.falha(new Error(m.error.message)) : p.ok(m.result);
    }
  };
  await cdp('Runtime.enable');

  await abrir('velha.html');
  const escritos = await avaliar(`(async () => {
    const b = await (await fetch('backup.json')).json();
    const r = {};
    for (const l of ['exercicios', 'sessoes', 'series', 'pesagens']) r[l] = await BD.guardarMuitos(l, b[l] || []);
    await BD.guardar('definicoes', { chave: 'provaMigracao', valor: 42 });
    return r;
  })()`);
  const antes = await avaliar(IMPRESSAO);

  await abrir('nova.html');
  const depois = await avaliar(IMPRESSAO);
  const naApp = await avaliar('({ series: Estado.series.length, sessoes: Estado.sessoes.length, pesagens: Estado.pesagens.length, prova: Estado.definicoes.provaMigracao })');

  console.log('escritos na velha:', JSON.stringify(escritos));
  console.log('versao antes -> depois:', antes.versao, '->', depois.versao);
  let falhou = false;
  for (const [l, a] of Object.entries(antes.lojas)) {
    const d = depois.lojas[l];
    const igual = d && d.n === a.n && d.hash === a.hash;
    if (!igual) falhou = true;
    console.log((igual ? 'IGUAL ' : 'MUDOU ') + l.padEnd(11), a.n, '->', d ? d.n : 'SUMIU', a.hash, d && d.hash);
  }
  for (const l of Object.keys(depois.lojas)) {
    if (!antes.lojas[l]) console.log('NOVA  ' + l.padEnd(11), depois.lojas[l].n);
  }
  console.log('carregado na app nova:', JSON.stringify(naApp));
  if (naApp.prova !== 42) falhou = true;

  // 5. O botao Juntar, pelo ecra, com um backup mais antigo por cima.
  const VELHO = path.join(RAIZ, 'dados-reais', 'backup-com-plano.json');
  if (fs.existsSync(VELHO)) {
    fs.copyFileSync(VELHO, path.join(pasta, 'velho.json'));
    const juntar = await avaliar(`(async () => {
      const antes = new Set(Estado.series.map(s => s.id));
      const texto = await (await fetch('velho.json')).text();
      importarBackupFicheiro(texto, 'velho.json');
      document.querySelector('#bJuntar').click();
      let depois;
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 250));
        depois = new Set((await BD.todos('series')).map(s => s.id));
        if (depois.size !== antes.size && Estado.series.length === depois.size) break;
      }
      let perdidas = 0; antes.forEach(id => { if (!depois.has(id)) perdidas++; });
      return { antes: antes.size, depois: depois.size, perdidas, emMemoria: Estado.series.length };
    })()`);
    console.log('botao Juntar com o backup de 25/08:', JSON.stringify(juntar));
    if (juntar.perdidas !== 0 || juntar.depois < juntar.antes) falhou = true;
  }
  console.log(falhou ? 'RESULTADO: FALHOU' : 'RESULTADO: migracao sem perdas');
  process.exitCode = falhou ? 1 : 0;
} finally {
  try { ws && ws.close(); } catch { }
  chrome.kill();
  servidor.close();
  await espera(800);
  try { fs.rmSync(pasta, { recursive: true, force: true }); } catch { /* o Chrome ainda larga ficheiros */ }
}
