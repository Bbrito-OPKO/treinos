/**
 * Ponte entre a app de Treinos (iPhone) e o Hermes no Vostro.
 *
 * A app pede a revisao por IA; isto corre `hermes -z` (a subscricao do Claude
 * do Bruno, sem chave da API) e devolve o texto. A app e que le e confere a
 * resposta, com as mesmas regras de sempre.
 *
 * Seguranca, por camadas:
 * - so escuta em 127.0.0.1; chega de fora so pelo `tailscale serve` (tailnet, nunca funnel);
 * - so aceita pedidos com Origin da app (o GitHub Pages) — um site qualquer aberto
 *   no telemovel nao consegue usar isto;
 * - o Hermes corre em --safe-mode com um unico toolset inofensivo (clarify): sem
 *   terminal, ficheiros, browser nem MCP. A revisao do treino nao pode mexer em nada.
 * - um pedido de cada vez, com teto de tempo e de tamanho.
 *
 * Sem dependencias: node ia_hermes.js
 */
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawn, execFile } = require('node:child_process');

const PORTA = Number(process.env.TREINOS_IA_PORTA || 8813);
const HERMES = process.env.TREINOS_IA_HERMES ||
  path.join(process.env.LOCALAPPDATA || '', 'hermes', 'bin', 'hermes.exe');
const ORIGENS = (process.env.TREINOS_IA_ORIGENS || 'https://bbrito-opko.github.io').split(',');
const TETO_MS = 240000;
// O pedido vai como argumento: a linha de comando do Windows aguenta 32 767 caracteres.
const TETO_CHARS = 30000;
const PASTA_LOG = path.join(process.env.LOCALAPPDATA || '.', 'TreinosIA');
const LOG = path.join(PASTA_LOG, 'ia_hermes.log');

function log(linha) {
  try {
    fs.mkdirSync(PASTA_LOG, { recursive: true });
    fs.appendFileSync(LOG, new Date().toISOString() + ' ' + linha + '\n');
  } catch (e) { /* o log nunca pode derrubar o servidor */ }
}

let ocupado = false;

function responder(res, estado, corpo, origem) {
  const h = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', vary: 'Origin' };
  if (origem) {
    h['access-control-allow-origin'] = origem;
    h['access-control-allow-methods'] = 'GET, POST, OPTIONS';
    h['access-control-allow-headers'] = 'content-type';
    h['access-control-max-age'] = '600';
  }
  res.writeHead(estado, h);
  res.end(corpo === null ? '' : JSON.stringify(corpo));
}

function correrHermes(prompt) {
  return new Promise((resolve) => {
    const args = ['-z', prompt, '--safe-mode', '-t', 'clarify', '--provider', 'anthropic', '-m', 'claude-opus-5'];
    const p = spawn(HERMES, args, { windowsHide: true });
    let out = '', err = '', acabou = false;
    const relogio = setTimeout(() => {
      if (acabou) return;
      acabou = true;
      // matar a arvore toda: o hermes.exe lanca um python por baixo
      execFile('taskkill', ['/PID', String(p.pid), '/T', '/F'], () => {});
      resolve({ erro: 'O Hermes demorou mais de ' + TETO_MS / 1000 + ' s.' });
    }, TETO_MS);
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', (e) => {
      if (acabou) return;
      acabou = true; clearTimeout(relogio);
      resolve({ erro: 'Não consegui lançar o Hermes: ' + e.message });
    });
    p.on('close', (codigo) => {
      if (acabou) return;
      acabou = true; clearTimeout(relogio);
      if (codigo !== 0 || !out.trim()) {
        const ultima = err.trim().split('\n').pop() || ('saiu com ' + codigo);
        resolve({ erro: 'O Hermes falhou: ' + ultima.slice(0, 300) });
      } else {
        resolve({ texto: out });
      }
    });
  });
}

const servidor = http.createServer((req, res) => {
  const origem = req.headers.origin || '';
  const permitida = ORIGENS.includes(origem) ? origem : '';
  // aceita o caminho com ou sem o prefixo do tailscale serve
  const rota = req.url.split('?')[0].replace(/^\/treinos-ia/, '') || '/';

  if (!permitida) {
    log('recusado origem=' + JSON.stringify(origem) + ' ' + req.method + ' ' + rota);
    return responder(res, 403, { erro: 'Origem não autorizada.' }, '');
  }
  if (req.method === 'OPTIONS') return responder(res, 204, null, permitida);

  if (req.method === 'GET' && rota === '/saude') {
    return responder(res, 200, { ok: true, ocupado, hermes: fs.existsSync(HERMES) }, permitida);
  }

  if (req.method === 'POST' && rota === '/rever') {
    if (ocupado) return responder(res, 429, { erro: 'Já há uma revisão a correr. Espera que acabe.' }, permitida);
    let corpo = '';
    req.setEncoding('utf8');
    req.on('data', (d) => {
      corpo += d;
      if (corpo.length > TETO_CHARS * 2) req.destroy();
    });
    req.on('end', () => {
      let prompt;
      try { prompt = JSON.parse(corpo).prompt; } catch (e) { prompt = null; }
      if (typeof prompt !== 'string' || !prompt.trim()) {
        return responder(res, 400, { erro: 'Pedido sem texto.' }, permitida);
      }
      if (prompt.length > TETO_CHARS) {
        return responder(res, 413, { erro: 'Pedido grande demais (' + prompt.length + ' caracteres).' }, permitida);
      }
      ocupado = true;
      const t0 = Date.now();
      correrHermes(prompt).then((r) => {
        ocupado = false;
        const s = ((Date.now() - t0) / 1000).toFixed(1);
        log('rever ' + prompt.length + ' chars em ' + s + ' s' + (r.erro ? ' ERRO ' + r.erro : ' ok ' + r.texto.length + ' chars'));
        responder(res, r.erro ? 502 : 200, r, permitida);
      });
    });
    return;
  }

  responder(res, 404, { erro: 'Não existe.' }, permitida);
});

servidor.on('error', (e) => {
  // Porta ocupada = ja ha uma instancia viva (a vigia volta a lancar isto de 5 em 5 min).
  if (e.code === 'EADDRINUSE') { process.exit(0); }
  log('erro do servidor ' + e.message);
  process.exit(1);
});

servidor.listen(PORTA, '127.0.0.1', () => log('a escutar em 127.0.0.1:' + PORTA + ' hermes=' + HERMES));
