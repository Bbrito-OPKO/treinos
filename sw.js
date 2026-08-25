/* ===========================================================================
   Service worker: e ele que faz a app abrir com o telemovel em modo de aviao.

   Duas estrategias diferentes, de proposito:

   - A PAGINA (index.html) e servida da cache e, ao mesmo tempo, pedida a rede
     em segundo plano para a copia guardada ficar actualizada. Assim a app abre
     de imediato, mesmo sem rede, e apanha uma versao nova na abertura
     seguinte. Ir a rede primeiro faria a app demorar a abrir num ginasio com
     mau sinal, que e exactamente onde ela e usada.

   - OS FICHEIROS FIXOS (manifesto e icones) vem da cache e pronto.

   O que NAO se faz: guardar em cache tudo o que passa. Um service worker que
   guarda tudo acaba a servir versoes velhas de ficheiros que nunca mais se
   conseguem actualizar.

   Os dados do utilizador nao passam por aqui: vivem na IndexedDB do telemovel.
   ======================================================================== */

const CACHE = 'treinos-v3';

/* Vai buscar a pagina IGNORANDO a cache do browser.

   O GitHub Pages manda Cache-Control: max-age=600 em tudo. Sem isto, o pedido
   que devia trazer a versao nova era servido pela cache do proprio browser
   durante 10 minutos — e a comparacao dava sempre "igual", porque estava a
   comparar a copia velha com ela propria. Num iPhone, com a app no ecra
   principal, isso podia arrastar-se muito mais.

   Usa-se um parametro na URL em vez de {cache:'reload'} porque o suporte
   dessa opcao no WebKit nunca foi de confianca, e isto funciona em todo o
   lado. A resposta e guardada na cache com a chave 'index.html', por isso o
   parametro nao fica agarrado a nada. */
function irBuscarPaginaFresca(url) {
  const separador = url.indexOf('?') === -1 ? '?' : '&';
  return fetch(url + separador + '_atualizacao=' + Date.now(), { cache: 'no-store' });
}

/* Diz as paginas abertas que ha uma versao nova guardada e pronta a entrar. */
function avisarQueHaVersaoNova() {
  return self.clients.matchAll({ type: 'window' }).then((janelas) => {
    janelas.forEach((j) => j.postMessage({ tipo: 'nova-versao' }));
  });
}

const FICHEIROS = [
  './',
  'index.html',
  'manifest.json',
  'icon-180.png',
  'icon-192.png',
  'icon-512.png',
  'icon-512-maskable.png'
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(FICHEIROS))
      // skipWaiting: sem isto, uma versao nova so entra depois de fechar
      // todos os separadores abertos — e uma app no ecra principal do iPhone
      // pode ficar semanas sem isso acontecer.
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(
        nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

/* A pagina pode pedir uma verificacao a qualquer momento (botao "Procurar
   atualização"). Responde sempre, mesmo quando nao ha nada de novo, para o
   botao poder dizer o que encontrou em vez de ficar calado. */
self.addEventListener('message', (evento) => {
  if (!evento.data || evento.data.tipo !== 'procurar-atualizacao') return;
  const responder = (r) => {
    if (evento.ports && evento.ports[0]) evento.ports[0].postMessage(r);
  };

  evento.waitUntil(
    caches.open(CACHE).then((cache) =>
      irBuscarPaginaFresca(evento.data.url).then((resposta) => {
        if (!resposta || !resposta.ok) return responder({ estado: 'sem-rede' });
        return Promise.all([
          cache.match('index.html').then((a) => (a ? a.text() : null)),
          resposta.clone().text()
        ]).then(([velha, nova]) => {
          if (velha === nova) return responder({ estado: 'ja-atualizada' });
          return cache.put('index.html', resposta).then(() => responder({ estado: 'nova' }));
        });
      })
    ).catch(() => responder({ estado: 'sem-rede' }))
  );
});

self.addEventListener('fetch', (evento) => {
  const pedido = evento.request;

  // Guardar um backup e um download, nao um pedido a cachear. E qualquer coisa
  // que nao seja GET nao tem lugar nenhum numa cache.
  if (pedido.method !== 'GET') return;

  // Pedidos para fora desta origem tambem nao: a app nao faz nenhum, mas se um
  // dia fizer, nao e a cache que os deve servir.
  const url = new URL(pedido.url);
  if (url.origin !== self.location.origin) return;

  // Abrir a app: serve-se o que esta guardado e vai-se buscar o novo por tras.
  // So a propria app leva este tratamento: responder index.html a QUALQUER
  // navegacao da origem faria desaparecer qualquer outra pagina que estivesse
  // na mesma pasta.
  const caminho = url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname;
  if (pedido.mode === 'navigate' && caminho.endsWith('/index.html')) {
    evento.respondWith(
      caches.open(CACHE).then((cache) => {
        const doServidor = irBuscarPaginaFresca(pedido.url).then((resposta) => {
          if (!resposta || !resposta.ok) return resposta;

          // Comparar com o que estava guardado. Se mudou, avisa-se a pagina
          // que ja esta aberta — senao a versao nova so aparecia na abertura
          // seguinte, e quem esta a usar a app nem sabia que havia uma.
          const paraComparar = resposta.clone();
          cache.match('index.html').then((antiga) => {
            if (!antiga) return null;
            return Promise.all([antiga.text(), paraComparar.text()])
              .then(([velha, nova]) => { if (velha !== nova) avisarQueHaVersaoNova(); });
          }).catch(() => { /* comparar e um extra, nunca pode partir nada */ });

          cache.put('index.html', resposta.clone());
          return resposta;
        }).catch(() => null);

        // waitUntil para o service worker nao ser morto antes de acabar de
        // ir buscar e guardar a versao nova.
        evento.waitUntil(doServidor);

        return cache.match('index.html').then((guardado) => {
          // Sem copia guardada (primeira abertura) espera-se pela rede.
          return guardado || doServidor;
        });
      })
    );
    return;
  }

  // Ficheiros fixos: so os que foram postos na cache de proposito.
  evento.respondWith(
    caches.match(pedido).then((guardado) => guardado || fetch(pedido))
  );
});
