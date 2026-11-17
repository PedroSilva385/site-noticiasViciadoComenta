/* ==========================================================================
   VICIADO COMENTA — Fórum do podcast

   Arquitetura leve (plano Spark):
   - /forum_index  → índice mínimo de cada tópico (título, autor, preview,
     contadores). É o ÚNICO nó lido ao abrir a página.
   - /comentarios/podcast → dados completos (texto integral e respostas).
     Só é lido quando alguém abre uma discussão.

   Antes, um único listener em /comentarios/podcast reenviava o fórum inteiro
   a todos os visitantes a cada resposta publicada. Agora cada alteração custa
   apenas o tópico alterado (~400 bytes) e o texto completo é carregado sob
   demanda. O painel admin continua a moderação a partir de /comentarios.
   ========================================================================== */
(function () {
  'use strict';

  var FORUM_PATH = 'comentarios/podcast';
  var INDEX_PATH = 'forum_index';
  var PAGE_SIZE = 8;
  // Quantos tópicos recentes são mantidos em memória. Com 60 muito dificilmente
  // se chega ao limite; o listener passa a receber apenas eventos incrementais.
  var LIMITE_TOPICOS = 60;
  var MAX_TITULO = 100;
  var MAX_AUTOR = 50;
  // SecurityUtils.sanitizeComment corta em 1000 caracteres; manter o limite
  // do formulário igual ao da sanitização evita texto cortado em silêncio.
  var MAX_TEXTO = 1000;
  // Pré-visualização guardada no índice para a listagem não precisar do texto todo.
  var MAX_PREVIEW = 180;
  var NAME_STORAGE_KEY = 'vc-forum-name';
  var MAX_PROFUNDIDADE = 4;

  var root = document.getElementById('forum');
  if (!root) return;

  var form = document.getElementById('forumForm');
  var formTitulo = document.getElementById('forumTitulo');
  var formAutor = document.getElementById('forumAutor');
  var formTexto = document.getElementById('forumTexto');
  var formStatus = document.getElementById('forumFormStatus');
  var formCancel = document.getElementById('forumCancelBtn');
  var newBtn = document.getElementById('forumNewBtn');
  var statusEl = document.getElementById('forumStatus');
  var listEl = document.getElementById('forumTopicos');
  var moreWrap = document.getElementById('forumMoreWrap');
  var moreBtn = document.getElementById('forumMoreBtn');
  var filters = root.querySelectorAll('.forum-filter');

  var db = null;
  var authReady = false;
  var authFailed = false;
  var currentUserId = null;
  var topicos = [];
  var ordenacao = 'recent';
  var visiveis = PAGE_SIZE;
  var ligado = false;
  var arranqueConcluido = false;
  var arranqueTimer = null;
  // Chaves presentes na janela de tópicos recentes. Necessário para saber se
  // um tópico desafixado continua visível ou deve sair da lista.
  var recentesIds = {};
  // Verdadeiro quando /forum_index ainda não existe nas regras publicadas.
  var modoCompativel = false;

  /* ---------- utilidades ---------- */

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>'"]/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character];
    });
  }

  function sanitizeName(value) {
    if (window.SecurityUtils && typeof window.SecurityUtils.sanitizeName === 'function') {
      return window.SecurityUtils.sanitizeName(value);
    }
    return String(value || '').trim().replace(/[<>"'`]/g, '').slice(0, MAX_AUTOR);
  }

  // sanitizeName corta em 50 caracteres (limite das regras para "nome"),
  // mas o título do tópico pode ir até MAX_TITULO.
  function sanitizeTitulo(value) {
    return String(value || '').trim().replace(/[<>"'`]/g, '').slice(0, MAX_TITULO);
  }

  function sanitizeComment(value) {
    if (window.SecurityUtils && typeof window.SecurityUtils.sanitizeComment === 'function') {
      return window.SecurityUtils.sanitizeComment(value);
    }
    return String(value || '').trim().replace(/</g, '&lt;').replace(/>/g, '&gt;').slice(0, MAX_TEXTO);
  }

  function containsMaliciousCode(value) {
    if (window.SecurityUtils && typeof window.SecurityUtils.containsMaliciousCode === 'function') {
      return window.SecurityUtils.containsMaliciousCode(value);
    }
    return /<script|javascript:|onerror=|onclick=|onload=|<iframe|eval\(/i.test(String(value || ''));
  }

  function checkRateLimit() {
    if (window.SecurityUtils && typeof window.SecurityUtils.checkRateLimit === 'function') {
      return window.SecurityUtils.checkRateLimit('forum-post', 3, 60000);
    }
    return { allowed: true };
  }

  function decodeEntities(value) {
    return String(value || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  }

  function dataLegivel() {
    var agora = new Date();
    return agora.toLocaleDateString('pt-PT') + ' às ' +
      agora.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  }

  // O índice guarda apenas timestamps; a data legível é formatada aqui.
  function formatarData(timestamp) {
    var valor = Number(timestamp || 0);
    if (!valor) return '';
    var data = new Date(valor);
    if (isNaN(data.getTime())) return '';
    return data.toLocaleDateString('pt-PT') + ' às ' +
      data.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  }

  function setStatus(element, message, tone) {
    if (!element) return;
    element.textContent = message || '';
    element.classList.remove('forum-status--error', 'forum-status--ok');
    if (tone === 'error') element.classList.add('forum-status--error');
    if (tone === 'ok') element.classList.add('forum-status--ok');
  }

  /* ---------- Firebase ---------- */

  function iniciarFirebase(tentativa) {
    tentativa = tentativa || 0;

    if (typeof firebase === 'undefined') {
      if (tentativa < 50) {
        window.setTimeout(function () { iniciarFirebase(tentativa + 1); }, 100);
      } else {
        falharLigacao('O fórum não conseguiu ligar-se. Recarrega a página.');
      }
      return;
    }

    var pronto = firebase.apps && firebase.apps.length;
    if (!pronto && typeof window.ensureFirebaseInitialized === 'function') {
      window.ensureFirebaseInitialized()
        .then(function () { iniciarFirebase(tentativa + 1); })
        .catch(function () { falharLigacao('O fórum não conseguiu ligar-se. Recarrega a página.'); });
      return;
    }

    if (!pronto) {
      if (tentativa < 50) {
        window.setTimeout(function () { iniciarFirebase(tentativa + 1); }, 100);
      } else {
        falharLigacao('O fórum não conseguiu ligar-se. Recarrega a página.');
      }
      return;
    }

    try {
      db = firebase.database();
    } catch (error) {
      falharLigacao('O fórum está indisponível neste momento.');
      return;
    }

    if (firebase.auth) {
      var auth = firebase.auth();
      auth.onAuthStateChanged(function (user) {
        if (user) {
          currentUserId = user.uid;
          authReady = true;
          authFailed = false;
          atualizarEstadoEscrita();
        }
      });

      auth.signInAnonymously()
        .then(function () {
          authReady = true;
          atualizarEstadoEscrita();
        })
        .catch(function () {
          authFailed = true;
          authReady = true;
          atualizarEstadoEscrita();
        });
    } else {
      authFailed = true;
      authReady = true;
    }

    ligarTopicos();
  }

  function falharLigacao(mensagem) {
    arranqueConcluido = true;
    setStatus(statusEl, mensagem, 'error');
    if (newBtn) newBtn.disabled = true;
  }

  function atualizarEstadoEscrita() {
    if (!newBtn) return;
    var disponivel = Boolean(currentUserId) && !authFailed && Boolean(db);
    newBtn.disabled = !disponivel;
    newBtn.title = disponivel ? '' : 'A preparar a ligação ao fórum…';
  }

  /* ---------- índice (leve) ---------- */

  function mapearIndice(chave, item) {
    item = item || {};
    var criado = Number(item.criado || 0);
    return {
      id: chave,
      titulo: String(item.titulo || 'Tópico sem título'),
      autor: String(item.autor || 'Anónimo'),
      preview: decodeEntities(item.preview || ''),
      timestamp: criado,
      ultima: Number(item.ultima || criado || 0),
      totalRespostas: Math.max(0, Number(item.total || 0)),
      data: formatarData(criado),
      fechado: item.fechado === true,
      fixado: item.fixado === true
    };
  }

  function indicePorId(chave) {
    for (var i = 0; i < topicos.length; i += 1) {
      if (topicos[i].id === chave) return topicos[i];
    }
    return null;
  }

  function absorverTopico(chave, item, renderizarAgora) {
    if (!chave) return;
    var mapeado = mapearIndice(chave, item);
    var existente = indicePorId(chave);
    if (existente) {
      // Preserva estado local de leitura já resolvido no painel.
      existente.titulo = mapeado.titulo;
      existente.autor = mapeado.autor;
      existente.preview = mapeado.preview;
      existente.timestamp = mapeado.timestamp;
      existente.ultima = mapeado.ultima;
      existente.totalRespostas = mapeado.totalRespostas;
      existente.data = mapeado.data;
      existente.fechado = mapeado.fechado;
      existente.fixado = mapeado.fixado;
    } else {
      topicos.push(mapeado);
    }
    if (renderizarAgora !== false) renderizar();
  }

  function removerTopico(chave) {
    var antes = topicos.length;
    topicos = topicos.filter(function (topico) { return topico.id !== chave; });
    if (topicos.length !== antes) renderizar();
  }

  function concluirArranque() {
    if (arranqueConcluido) return;
    arranqueConcluido = true;
    if (arranqueTimer) {
      window.clearTimeout(arranqueTimer);
      arranqueTimer = null;
    }
    renderizar();
  }

  function ligarTopicos() {
    if (ligado || !db) return;
    ligado = true;

    setStatus(statusEl, 'A carregar tópicos…');
    // O child_added só dispara quando existe pelo menos um tópico; se nada
    // chegar neste intervalo, assume-se fórum vazio em vez de ficar a carregar.
    arranqueTimer = window.setTimeout(concluirArranque, 1500);

    var falha = function (error) {
      if (modoCompativel) return;
      // As regras do Firebase são aplicadas manualmente. Se /forum_index ainda
      // não estiver publicado, o fórum recua para o modelo antigo em vez de
      // ficar vazio para todos os visitantes.
      console.warn('Índice do fórum indisponível; a usar o modo compatível.', error && error.message);
      ligarTopicosCompativel();
    };

    var recentes = db.ref(INDEX_PATH)
      .orderByChild('criado')
      .limitToLast(LIMITE_TOPICOS);

    // Tópicos recentes: apenas os mais recentes, com eventos incrementais.
    recentes.on('child_added', function (snapshot) {
      recentesIds[snapshot.key] = true;
      absorverTopico(snapshot.key, snapshot.val(), true);
      concluirArranque();
    }, falha);

    recentes.on('child_changed', function (snapshot) {
      absorverTopico(snapshot.key, snapshot.val(), true);
    }, falha);

    recentes.on('child_removed', function (snapshot) {
      delete recentesIds[snapshot.key];
      // Se continua fixado, mantém-se visível através da consulta de fixados.
      var item = indicePorId(snapshot.key);
      if (item && item.fixado) return;
      removerTopico(snapshot.key);
    }, falha);

    // Fixados podem ser mais antigos do que a janela recente; são carregados
    // numa consulta própria (normalmente zero ou poucos nós).
    var fixados = db.ref(INDEX_PATH)
      .orderByChild('fixado')
      .equalTo(true);

    fixados.on('child_added', function (snapshot) {
      absorverTopico(snapshot.key, snapshot.val(), true);
    }, falha);

    fixados.on('child_changed', function (snapshot) {
      absorverTopico(snapshot.key, snapshot.val(), true);
    }, falha);

    fixados.on('child_removed', function (snapshot) {
      // Um tópico desafixado continua visível se ainda estiver na janela recente.
      if (recentesIds[snapshot.key]) return;
      removerTopico(snapshot.key);
    }, falha);
  }

  /* ---------- modo compatível (regras antigas) ---------- */

  // Leitura única de /comentarios/podcast, usada apenas enquanto as regras do
  // Firebase não incluírem /forum_index. Mantém o fórum operacional durante a
  // janela entre publicar o site e aplicar as regras.
  function ligarTopicosCompativel() {
    if (!db || modoCompativel && topicos.length) return;
    modoCompativel = true;
    setStatus(statusEl, 'A carregar tópicos…');

    db.ref(FORUM_PATH).once('value').then(function (snapshot) {
      var valor = snapshot.val() || {};
      topicos = Object.keys(valor).map(function (chave) {
        var item = valor[chave] || {};
        var respostas = item.respostas && typeof item.respostas === 'object' ? item.respostas : {};
        var ultima = Number(item.timestamp || 0);
        Object.keys(respostas).forEach(function (respKey) {
          var ts = Number((respostas[respKey] || {}).timestamp || 0);
          if (ts > ultima) ultima = ts;
        });
        return {
          id: chave,
          titulo: String(item.titulo || item.nome || 'Tópico sem título'),
          autor: String(item.nome || 'Anónimo'),
          preview: decodeEntities(item.texto || ''),
          timestamp: Number(item.timestamp || 0),
          ultima: ultima,
          totalRespostas: contarRespostas(respostas),
          data: String(item.data || ''),
          fechado: item.fechado === true,
          fixado: item.fixado === true
        };
      });
      arranqueConcluido = true;
      if (arranqueTimer) {
        window.clearTimeout(arranqueTimer);
        arranqueTimer = null;
      }
      renderizar();
    }).catch(function () {
      arranqueConcluido = true;
      setStatus(statusEl, 'Não foi possível carregar os tópicos. Tenta novamente mais tarde.', 'error');
    });
  }

  /* ---------- render ---------- */

  function obterTermoPesquisa() {
    var campo = document.getElementById('forumSearch');
    return campo ? campo.value.trim().toLowerCase() : '';
  }

  function normalizar(value) {
    return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function listaFiltrada() {
    var termo = normalizar(obterTermoPesquisa());
    var lista = topicos.filter(function (topico) {
      if (!termo) return true;
      return normalizar(topico.titulo).indexOf(termo) !== -1 ||
        normalizar(topico.autor).indexOf(termo) !== -1 ||
        normalizar(topico.preview).indexOf(termo) !== -1;
    });

    var comparador;
    if (ordenacao === 'active') {
      comparador = function (a, b) { return b.ultima - a.ultima; };
    } else if (ordenacao === 'replies') {
      comparador = function (a, b) {
        var diff = b.totalRespostas - a.totalRespostas;
        return diff !== 0 ? diff : b.timestamp - a.timestamp;
      };
    } else {
      comparador = function (a, b) { return b.timestamp - a.timestamp; };
    }

    lista.sort(function (a, b) {
      // Tópicos fixados pela moderação aparecem sempre no topo.
      if (a.fixado !== b.fixado) return a.fixado ? -1 : 1;
      return comparador(a, b);
    });

    return lista;
  }

  function renderizar() {
    if (!listEl) return;

    var lista = listaFiltrada();
    listEl.innerHTML = '';

    if (!topicos.length) {
      if (!arranqueConcluido) return;
      listEl.innerHTML = '<p class="forum-empty">Ainda não existem tópicos. Sê o primeiro a abrir a discussão.</p>';
      setStatus(statusEl, '');
      if (moreWrap) moreWrap.hidden = true;
      return;
    }

    if (!lista.length) {
      listEl.innerHTML = '<p class="forum-empty">Nenhum tópico corresponde à pesquisa.</p>';
      setStatus(statusEl, '');
      if (moreWrap) moreWrap.hidden = true;
      return;
    }

    var aMostrar = lista.slice(0, visiveis);
    aMostrar.forEach(function (topico) {
      listEl.appendChild(criarTopico(topico));
    });

    var total = lista.length;
    var sufixo = topicos.length >= LIMITE_TOPICOS ? ' A mostrar os mais recentes.' : '';
    setStatus(statusEl, (total === 1 ? '1 tópico.' : total + ' tópicos.') + sufixo);

    if (moreWrap && moreBtn) {
      moreWrap.hidden = visiveis >= total;
      moreBtn.textContent = 'Mostrar mais tópicos (' + Math.max(total - visiveis, 0) + ')';
    }
  }

  function criarBadge(texto, tipo) {
    var badge = document.createElement('span');
    badge.className = 'forum-badge forum-badge--' + tipo;
    badge.textContent = texto;
    return badge;
  }

  function criarTopico(topico) {
    var artigo = document.createElement('article');
    artigo.className = 'forum-topico';
    artigo.dataset.topicoId = topico.id;

    var head = document.createElement('div');
    head.className = 'forum-topico-head';

    var titulo = document.createElement('h3');
    titulo.className = 'forum-topico-titulo';
    titulo.textContent = topico.titulo;
    head.appendChild(titulo);

    if (topico.fixado || topico.fechado) {
      var badges = document.createElement('div');
      badges.className = 'forum-badges';
      if (topico.fixado) badges.appendChild(criarBadge('Fixado', 'pinned'));
      if (topico.fechado) badges.appendChild(criarBadge('Fechado', 'closed'));
      head.appendChild(badges);
    }

    var meta = document.createElement('div');
    meta.className = 'forum-topico-meta';
    var autor = document.createElement('span');
    var autorForte = document.createElement('strong');
    autorForte.textContent = topico.autor;
    autor.appendChild(document.createTextNode('Por '));
    autor.appendChild(autorForte);
    meta.appendChild(autor);
    if (topico.data) {
      var dataEl = document.createElement('span');
      dataEl.textContent = topico.data;
      meta.appendChild(dataEl);
    }
    var respostasEl = document.createElement('span');
    respostasEl.textContent = topico.totalRespostas === 1 ? '1 resposta' : topico.totalRespostas + ' respostas';
    meta.appendChild(respostasEl);
    head.appendChild(meta);
    artigo.appendChild(head);

    var texto = document.createElement('p');
    texto.className = 'forum-topico-texto';
    texto.textContent = topico.preview;
    artigo.appendChild(texto);

    var actions = document.createElement('div');
    actions.className = 'forum-topico-actions';
    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'forum-action forum-toggle';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.textContent = 'Ver discussão (' + topico.totalRespostas + ')';
    actions.appendChild(toggle);
    artigo.appendChild(actions);

    var painel = document.createElement('div');
    painel.className = 'forum-respostas';
    painel.hidden = true;

    var listaRespostas = document.createElement('div');
    listaRespostas.className = 'forum-respostas-lista';
    painel.appendChild(listaRespostas);

    artigo.appendChild(painel);

    toggle.addEventListener('click', function () {
      var vaiAbrir = painel.hidden;
      painel.hidden = !vaiAbrir;
      toggle.setAttribute('aria-expanded', vaiAbrir ? 'true' : 'false');
      if (vaiAbrir) {
        abrirDiscussao(topico, painel, listaRespostas, toggle);
      } else {
        fecharDiscussao(topico);
      }
    });

    return artigo;
  }

  /* ---------- discussão (carregada sob demanda) ---------- */

  // Lê o tópico completo apenas quando é aberto. Antes, o texto integral e
  // todas as respostas vinham no snapshot da listagem.
  function abrirDiscussao(topico, painel, listaRespostas, toggle) {
    if (!db) return;
    if (topico.aCarregar) return;
    topico.aCarregar = true;

    listaRespostas.innerHTML = '<p class="forum-respostas-vazio">A carregar discussão…</p>';

    db.ref(FORUM_PATH + '/' + topico.id).once('value').then(function (snapshot) {
      topico.aCarregar = false;

      var valor = snapshot.val();
      if (!valor) {
        listaRespostas.innerHTML = '<p class="forum-respostas-vazio">Este tópico já não existe.</p>';
        return;
      }

      topico.respostasCache = valor.respostas || {};
      topico.fechado = valor.fechado === true;
      topico.textoIntegral = decodeEntities(valor.texto || '');
      if (!topico.preview) {
        textoPreview(topico);
      }

      desenharDiscussao(topico, painel, listaRespostas, toggle);
      // Se entretanto o painel foi fechado, não vale a pena subscrever.
      if (!painel.hidden) ligarRespostas(topico, painel, listaRespostas, toggle);
    }).catch(function (error) {
      topico.aCarregar = false;
      console.error('Erro ao abrir discussão do fórum:', error);
      listaRespostas.innerHTML = '<p class="forum-respostas-vazio">Não foi possível carregar a discussão.</p>';
    });
  }

  function textoPreview(topico) {
    var elemento = listEl ? listEl.querySelector('[data-topico-id="' + topico.id + '"] .forum-topico-texto') : null;
    if (!elemento) return;
    var valor = String(topico.textoIntegral || topico.preview || '').slice(0, MAX_PREVIEW);
    if (!valor) return;
    topico.preview = valor;
    elemento.textContent = valor;
  }

  // Mantém o painel aberto sincronizado recebendo apenas as respostas novas.
  function ligarRespostas(topico, painel, listaRespostas, toggle) {
    if (!db || topico.respostasRef) return;

    topico.respostasRef = db.ref(FORUM_PATH + '/' + topico.id + '/respostas');
    topico.respostasRef.on('child_added', function (snapshot) {
      if (!topico.respostasCache) topico.respostasCache = {};
      if (topico.respostasCache[snapshot.key]) return;
      topico.respostasCache[snapshot.key] = snapshot.val();
      desenharListaRespostas(topico, listaRespostas, toggle);
    });
    topico.respostasRef.on('child_removed', function (snapshot) {
      if (!topico.respostasCache) return;
      delete topico.respostasCache[snapshot.key];
      desenharListaRespostas(topico, listaRespostas, toggle);
    });
  }

  function fecharDiscussao(topico) {
    if (!topico.respostasRef) return;
    topico.respostasRef.off();
    topico.respostasRef = null;
  }

  function desenharDiscussao(topico, painel, listaRespostas, toggle) {
    desenharListaRespostas(topico, listaRespostas, toggle);

    var antigo = painel.querySelector('.forum-resposta-form, .forum-closed-note');
    if (antigo) antigo.remove();

    if (topico.fechado) {
      var nota = document.createElement('p');
      nota.className = 'forum-closed-note';
      nota.textContent = 'Tópico fechado pela moderação. Já não aceita novas respostas.';
      painel.appendChild(nota);
    } else {
      painel.appendChild(criarFormResposta(topico.id, ''));
    }
  }

  function desenharListaRespostas(topico, listaRespostas, toggle) {
    var arvore = normalizarRespostas(topico.respostasCache);
    listaRespostas.innerHTML = '';

    if (!arvore.length) {
      var vazio = document.createElement('p');
      vazio.className = 'forum-respostas-vazio';
      vazio.textContent = 'Ainda sem respostas. Diz o que pensas.';
      listaRespostas.appendChild(vazio);
    } else {
      arvore.forEach(function (no) {
        listaRespostas.appendChild(criarResposta(no, topico.id, 1, topico.fechado));
      });
    }

    if (toggle) {
      toggle.textContent = 'Ver discussão (' + contarRespostas(topico.respostasCache) + ')';
    }
  }

  function contarRespostas(respostas) {
    if (!respostas || typeof respostas !== 'object') return 0;
    return Object.keys(respostas).length;
  }

  function normalizarRespostas(respostas) {
    if (!respostas || typeof respostas !== 'object') return [];

    var mapa = {};
    Object.keys(respostas).forEach(function (chave) {
      var item = respostas[chave] || {};
      mapa[chave] = {
        id: chave,
        autor: String(item.nome || 'Anónimo'),
        texto: decodeEntities(item.texto || ''),
        timestamp: Number(item.timestamp || 0),
        data: String(item.data || ''),
        parentId: item.parentId ? String(item.parentId) : '',
        filhos: []
      };
    });

    var raizes = [];
    Object.keys(mapa).forEach(function (chave) {
      var no = mapa[chave];
      if (no.parentId && mapa[no.parentId]) {
        mapa[no.parentId].filhos.push(no);
      } else {
        raizes.push(no);
      }
    });

    var ordenar = function (lista) {
      lista.sort(function (a, b) { return a.timestamp - b.timestamp; });
      lista.forEach(function (no) { ordenar(no.filhos); });
    };
    ordenar(raizes);

    return raizes;
  }

  function criarResposta(no, topicoId, profundidade, fechado) {
    var item = document.createElement('div');
    item.className = 'forum-resposta';
    item.dataset.profundidade = String(Math.min(profundidade, MAX_PROFUNDIDADE));

    var head = document.createElement('div');
    head.className = 'forum-resposta-head';
    var autor = document.createElement('strong');
    autor.textContent = no.autor;
    head.appendChild(autor);
    if (no.data) {
      var dataEl = document.createElement('span');
      dataEl.textContent = no.data;
      head.appendChild(dataEl);
    }
    item.appendChild(head);

    var texto = document.createElement('p');
    texto.className = 'forum-resposta-texto';
    texto.textContent = no.texto;
    item.appendChild(texto);

    if (!fechado) {
      var acoes = document.createElement('div');
      acoes.className = 'forum-resposta-acoes';
      var responder = document.createElement('button');
      responder.type = 'button';
      responder.textContent = 'Responder';
      acoes.appendChild(responder);
      item.appendChild(acoes);

      var subForm = criarFormResposta(topicoId, no.id);
      subForm.hidden = true;
      item.appendChild(subForm);

      responder.addEventListener('click', function () {
        subForm.hidden = !subForm.hidden;
        if (!subForm.hidden) {
          var primeiro = subForm.querySelector('input, textarea');
          if (primeiro) primeiro.focus();
        }
      });
    }

    no.filhos.forEach(function (filho) {
      item.appendChild(criarResposta(filho, topicoId, profundidade + 1, fechado));
    });

    return item;
  }

  function criarFormResposta(topicoId, parentId) {
    var wrapper = document.createElement('form');
    wrapper.className = 'forum-resposta-form';
    wrapper.setAttribute('novalidate', 'novalidate');

    var nomeId = 'forumRespNome-' + topicoId + '-' + (parentId || 'topo');
    var textoId = 'forumRespTexto-' + topicoId + '-' + (parentId || 'topo');

    wrapper.innerHTML =
      '<div class="forum-field">' +
        '<label for="' + escapeHtml(nomeId) + '">O teu nome</label>' +
        '<input type="text" id="' + escapeHtml(nomeId) + '" maxlength="' + MAX_AUTOR + '" placeholder="Como queres aparecer" required>' +
      '</div>' +
      '<div class="forum-field">' +
        '<label for="' + escapeHtml(textoId) + '">Resposta</label>' +
        '<textarea id="' + escapeHtml(textoId) + '" rows="3" maxlength="' + MAX_TEXTO + '" placeholder="Escreve a tua resposta" required></textarea>' +
      '</div>' +
      '<div class="forum-form-actions">' +
        '<button type="submit" class="forum-btn forum-btn--primary">Enviar resposta</button>' +
      '</div>' +
      '<p class="forum-status" role="status" aria-live="polite"></p>';

    var nomeInput = wrapper.querySelector('input');
    var textoInput = wrapper.querySelector('textarea');
    var status = wrapper.querySelector('.forum-status');
    var nomeGuardado = obterNomeGuardado();
    if (nomeGuardado && nomeInput) nomeInput.value = nomeGuardado;

    wrapper.addEventListener('submit', function (event) {
      event.preventDefault();
      publicarResposta(topicoId, parentId, nomeInput, textoInput, status, wrapper);
    });

    return wrapper;
  }

  /* ---------- escrita ---------- */

  function obterNomeGuardado() {
    try { return localStorage.getItem(NAME_STORAGE_KEY) || ''; } catch (error) { return ''; }
  }

  function guardarNome(nome) {
    try { localStorage.setItem(NAME_STORAGE_KEY, nome); } catch (error) { /* ignorar */ }
  }

  function validarLigacao(status) {
    if (!db) {
      setStatus(status, 'O fórum ainda não está ligado. Aguarda um instante.', 'error');
      return false;
    }
    if (authFailed || !currentUserId) {
      setStatus(status, 'Não foi possível ligar ao fórum. Recarrega a página.', 'error');
      return false;
    }
    return true;
  }

  function publicarResposta(topicoId, parentId, nomeInput, textoInput, status, wrapper) {
    if (!validarLigacao(status)) return;

    // O tópico pode ter sido fechado ou apagado pela moderação entretanto.
    var topicoAtual = indicePorId(topicoId);
    if (!topicoAtual) {
      setStatus(status, 'Este tópico já não existe.', 'error');
      return;
    }
    if (topicoAtual.fechado) {
      setStatus(status, 'Este tópico está fechado e não aceita novas respostas.', 'error');
      return;
    }

    var nome = nomeInput ? nomeInput.value.trim() : '';
    var texto = textoInput ? textoInput.value.trim() : '';

    if (!nome || !texto) {
      setStatus(status, 'Preenche o nome e a resposta.', 'error');
      return;
    }

    var limite = checkRateLimit();
    if (!limite.allowed) {
      setStatus(status, 'Aguarda ' + limite.waitTime + ' segundos antes de publicar novamente.', 'error');
      return;
    }

    if (containsMaliciousCode(nome) || containsMaliciousCode(texto)) {
      setStatus(status, 'Conteúdo inválido detectado.', 'error');
      return;
    }

    var nomeLimpo = sanitizeName(nome);
    var textoLimpo = sanitizeComment(texto);

    if (!nomeLimpo || !textoLimpo) {
      setStatus(status, 'Nome ou resposta inválidos.', 'error');
      return;
    }

    guardarNome(nomeLimpo);
    setStatus(status, 'A enviar…');

    var payload = {
      uid: currentUserId,
      nome: nomeLimpo,
      texto: textoLimpo,
      data: dataLegivel(),
      timestamp: firebase.database.ServerValue.TIMESTAMP
    };
    if (parentId) payload.parentId = parentId;

    var respostaId = db.ref(FORUM_PATH + '/' + topicoId + '/respostas').push().key;

    if (modoCompativel) {
      // Sem índice publicado: grava só no nó antigo, como antes.
      db.ref(FORUM_PATH + '/' + topicoId + '/respostas/' + respostaId).set(payload)
        .then(function () {
          setStatus(status, 'Resposta publicada.', 'ok');
          if (textoInput) textoInput.value = '';
          if (wrapper) wrapper.hidden = true;
        })
        .catch(function (error) {
          console.error('Erro ao publicar resposta do fórum:', error);
          setStatus(status, 'Não foi possível publicar. Tenta novamente.', 'error');
        });
      return;
    }

    var updates = {};
    updates[FORUM_PATH + '/' + topicoId + '/respostas/' + respostaId] = payload;
    // Marca a atividade no índice para a listagem reordenar sem ler o tópico.
    updates[INDEX_PATH + '/' + topicoId + '/ultima'] = firebase.database.ServerValue.TIMESTAMP;

    db.ref().update(updates)
      .then(function () {
        // Transação evita perder contagens se duas pessoas responderem juntas.
        return db.ref(INDEX_PATH + '/' + topicoId + '/total').transaction(function (atual) {
          return (Math.max(0, Number(atual) || 0)) + 1;
        });
      })
      .then(function () {
        setStatus(status, 'Resposta publicada.', 'ok');
        if (textoInput) textoInput.value = '';
        if (wrapper) wrapper.hidden = true;
      })
      .catch(function (error) {
        console.error('Erro ao publicar resposta do fórum:', error);
        setStatus(status, 'Não foi possível publicar. Tenta novamente.', 'error');
      });
  }

  function publicarTopico(event) {
    event.preventDefault();
    if (!validarLigacao(formStatus)) return;

    var honeypot = document.getElementById('forumWebsite');
    if (honeypot && honeypot.value) return;

    var titulo = formTitulo ? formTitulo.value.trim() : '';
    var nome = formAutor ? formAutor.value.trim() : '';
    var texto = formTexto ? formTexto.value.trim() : '';

    if (!titulo || !nome || !texto) {
      setStatus(formStatus, 'Preenche o título, o nome e a mensagem.', 'error');
      return;
    }

    var limite = checkRateLimit();
    if (!limite.allowed) {
      setStatus(formStatus, 'Aguarda ' + limite.waitTime + ' segundos antes de publicar novamente.', 'error');
      return;
    }

    if (containsMaliciousCode(titulo) || containsMaliciousCode(nome) || containsMaliciousCode(texto)) {
      setStatus(formStatus, 'Conteúdo inválido detectado.', 'error');
      return;
    }

    var tituloLimpo = sanitizeTitulo(titulo);
    var nomeLimpo = sanitizeName(nome);
    var textoLimpo = sanitizeComment(texto);

    if (!tituloLimpo || !nomeLimpo || !textoLimpo) {
      setStatus(formStatus, 'Título, nome ou mensagem inválidos.', 'error');
      return;
    }

    guardarNome(nomeLimpo);
    setStatus(formStatus, 'A publicar…');

    if (modoCompativel) {
      // Sem índice publicado: grava só no nó antigo, como antes.
      db.ref(FORUM_PATH).push({
        nome: nomeLimpo,
        titulo: tituloLimpo,
        texto: textoLimpo,
        uid: currentUserId,
        data: dataLegivel(),
        timestamp: firebase.database.ServerValue.TIMESTAMP
      })
        .then(function () {
          setStatus(formStatus, 'Tópico publicado.');
          if (formTitulo) formTitulo.value = '';
          if (formTexto) formTexto.value = '';
          if (form) form.hidden = true;
          if (newBtn) newBtn.setAttribute('aria-expanded', 'false');
          visiveis = PAGE_SIZE;
          topicos = [];
          ligarTopicosCompativel();
        })
        .catch(function (error) {
          console.error('Erro ao publicar tópico no fórum:', error);
          setStatus(formStatus, 'Não foi possível publicar o tópico. Tenta novamente.', 'error');
        });
      return;
    }

    var agora = firebase.database.ServerValue.TIMESTAMP;
    var topicoId = db.ref(FORUM_PATH).push().key;

    // Escrita única (multi-path): conteúdo completo + índice leve.
    var updates = {};
    updates[FORUM_PATH + '/' + topicoId] = {
      // "nome" e "texto" são exigidos pelas regras já publicadas; o título
      // segue num campo próprio lido apenas pelo fórum.
      nome: nomeLimpo,
      titulo: tituloLimpo,
      texto: textoLimpo,
      uid: currentUserId,
      data: dataLegivel(),
      timestamp: agora
    };
    updates[INDEX_PATH + '/' + topicoId] = {
      titulo: tituloLimpo,
      autor: nomeLimpo,
      preview: textoLimpo.slice(0, MAX_PREVIEW),
      uid: currentUserId,
      criado: agora,
      ultima: agora,
      total: 0
    };

    db.ref().update(updates)
      .then(function () {
        setStatus(formStatus, 'Tópico publicado.');
        if (formTitulo) formTitulo.value = '';
        if (formTexto) formTexto.value = '';
        if (form) form.hidden = true;
        if (newBtn) newBtn.setAttribute('aria-expanded', 'false');
        visiveis = PAGE_SIZE;
      })
      .catch(function (error) {
        console.error('Erro ao publicar tópico no fórum:', error);
        setStatus(formStatus, 'Não foi possível publicar o tópico. Tenta novamente.', 'error');
      });
  }

  /* ---------- eventos ---------- */

  if (form) form.addEventListener('submit', publicarTopico);

  if (newBtn) {
    newBtn.setAttribute('aria-controls', 'forumForm');
    newBtn.setAttribute('aria-expanded', 'false');
    newBtn.addEventListener('click', function () {
      if (!form) return;
      form.hidden = !form.hidden;
      newBtn.setAttribute('aria-expanded', form.hidden ? 'false' : 'true');
      if (!form.hidden) {
        if (formAutor && !formAutor.value) formAutor.value = obterNomeGuardado();
        if (formTitulo) formTitulo.focus();
      } else {
        setStatus(formStatus, '');
      }
    });
  }

  if (formCancel) {
    formCancel.addEventListener('click', function () {
      if (form) form.hidden = true;
      if (newBtn) {
        newBtn.setAttribute('aria-expanded', 'false');
        newBtn.focus();
      }
      setStatus(formStatus, '');
    });
  }

  if (moreBtn) {
    moreBtn.addEventListener('click', function () {
      visiveis += PAGE_SIZE;
      renderizar();
    });
  }

  filters.forEach(function (botao) {
    botao.addEventListener('click', function () {
      ordenacao = botao.getAttribute('data-sort') || 'recent';
      filters.forEach(function (outro) {
        outro.setAttribute('aria-pressed', outro === botao ? 'true' : 'false');
      });
      visiveis = PAGE_SIZE;
      renderizar();
    });
  });

  var searchInput = document.getElementById('forumSearch');
  var searchTimer = null;
  if (searchInput) {
    searchInput.addEventListener('input', function () {
      if (searchTimer) window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(function () {
        visiveis = PAGE_SIZE;
        renderizar();
      }, 180);
    });
  }

  /* ---------- arranque ---------- */

  if (formAutor) {
    var guardado = obterNomeGuardado();
    if (guardado) formAutor.value = guardado;
  }

  atualizarEstadoEscrita();
  iniciarFirebase(0);
})();
