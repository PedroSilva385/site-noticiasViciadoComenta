/* ==========================================================================
   VICIADO COMENTA — Fórum do podcast
   Tópicos + respostas guardados em /comentarios/podcast no Firebase Realtime
   Database. Usar este nó (em vez de uma raiz nova) mantém as regras de
   segurança já publicadas e faz com que a moderação do painel admin cubra
   automaticamente o fórum.
   ========================================================================== */
(function () {
  'use strict';

  var FORUM_PATH = 'comentarios/podcast';
  var PAGE_SIZE = 8;
  var MAX_TITULO = 100;
  var MAX_AUTOR = 50;
  // SecurityUtils.sanitizeComment corta em 1000 caracteres; manter o limite
  // do formulário igual ao da sanitização evita texto cortado em silêncio.
  var MAX_TEXTO = 1000;
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

  function setStatus(element, message, tone) {
    if (!element) return;
    element.textContent = message || '';
    element.classList.remove('forum-status--error', 'forum-status--ok');
    if (tone === 'error') element.classList.add('forum-status--error');
    if (tone === 'ok') element.classList.add('forum-status--ok');
  }

  function contarRespostas(respostas) {
    if (!respostas || typeof respostas !== 'object') return 0;
    return Object.keys(respostas).length;
  }

  function ultimaAtividade(topico) {
    var maior = Number(topico.timestamp || 0);
    var respostas = topico.respostas || {};
    Object.keys(respostas).forEach(function (chave) {
      var valor = Number((respostas[chave] || {}).timestamp || 0);
      if (valor > maior) maior = valor;
    });
    return maior;
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

    ligarTópicos();
  }

  function falharLigacao(mensagem) {
    setStatus(statusEl, mensagem, 'error');
    if (newBtn) newBtn.disabled = true;
  }

  function atualizarEstadoEscrita() {
    if (!newBtn) return;
    var disponivel = Boolean(currentUserId) && !authFailed && Boolean(db);
    newBtn.disabled = !disponivel;
    newBtn.title = disponivel ? '' : 'A preparar a ligação ao fórum…';
  }

  function ligarTópicos() {
    if (ligado || !db) return;
    ligado = true;

    setStatus(statusEl, 'A carregar tópicos…');

    db.ref(FORUM_PATH).on('value', function (snapshot) {
      var valor = snapshot.val() || {};
      topicos = Object.keys(valor).map(function (chave) {
        var item = valor[chave] || {};
        return {
          id: chave,
          titulo: String(item.titulo || item.nome || 'Tópico sem título'),
          autor: String(item.nome || 'Anónimo'),
          texto: decodeEntities(item.texto || ''),
          timestamp: Number(item.timestamp || 0),
          data: String(item.data || ''),
          // Campos de moderação escritos pelo painel admin.
          fechado: item.fechado === true,
          fixado: item.fixado === true,
          respostas: item.respostas || {}
        };
      });
      visiveis = PAGE_SIZE;
      renderizar();
    }, function () {
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
        normalizar(topico.texto).indexOf(termo) !== -1;
    });

    var comparador;
    if (ordenacao === 'active') {
      comparador = function (a, b) { return ultimaAtividade(b) - ultimaAtividade(a); };
    } else if (ordenacao === 'replies') {
      comparador = function (a, b) {
        var diff = contarRespostas(b.respostas) - contarRespostas(a.respostas);
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
    setStatus(statusEl, total === 1 ? '1 tópico.' : total + ' tópicos.');

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

    var totalRespostas = contarRespostas(topico.respostas);

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
    respostasEl.textContent = totalRespostas === 1 ? '1 resposta' : totalRespostas + ' respostas';
    meta.appendChild(respostasEl);
    head.appendChild(meta);
    artigo.appendChild(head);

    var texto = document.createElement('p');
    texto.className = 'forum-topico-texto';
    texto.textContent = topico.texto;
    artigo.appendChild(texto);

    var actions = document.createElement('div');
    actions.className = 'forum-topico-actions';
    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'forum-action forum-toggle';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.textContent = 'Ver discussão (' + totalRespostas + ')';
    actions.appendChild(toggle);
    artigo.appendChild(actions);

    var painel = document.createElement('div');
    painel.className = 'forum-respostas';
    painel.hidden = true;

    var listaRespostas = document.createElement('div');
    listaRespostas.className = 'forum-respostas-lista';
    var arvore = normalizarRespostas(topico.respostas);
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
    painel.appendChild(listaRespostas);

    if (topico.fechado) {
      var nota = document.createElement('p');
      nota.className = 'forum-closed-note';
      nota.textContent = 'Tópico fechado pela moderação. Já não aceita novas respostas.';
      painel.appendChild(nota);
    } else {
      painel.appendChild(criarFormResposta(topico.id, ''));
    }
    artigo.appendChild(painel);

    toggle.addEventListener('click', function () {
      var aberto = painel.hidden;
      painel.hidden = !aberto;
      toggle.setAttribute('aria-expanded', aberto ? 'true' : 'false');
    });

    return artigo;
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
    var topicoAtual = null;
    topicos.forEach(function (topico) {
      if (topico.id === topicoId) topicoAtual = topico;
    });
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

    db.ref(FORUM_PATH + '/' + topicoId + '/respostas').push(payload)
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

    db.ref(FORUM_PATH).push({
      // "nome" e "texto" são exigidos pelas regras já publicadas; o título
      // segue num campo próprio lido apenas pelo fórum.
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
        renderizar();
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
