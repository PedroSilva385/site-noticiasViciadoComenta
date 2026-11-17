/* ==========================================================================
   VICIADO COMENTA — Pesquisa interna
   Carrega assets/search-index.json (gerado por tools/gerar-artigos-espelho.ps1)
   e filtra localmente por título, resumo, categoria e autor.
   ========================================================================== */
(function () {
  'use strict';

  var PAGE_SIZE = 20;

  var form = document.getElementById('searchForm');
  var input = document.getElementById('searchInput');
  var statusEl = document.getElementById('searchStatus');
  var resultsEl = document.getElementById('searchResults');
  var chipsEl = document.getElementById('searchChips');
  var moreWrap = document.getElementById('searchMore');
  var moreBtn = document.getElementById('searchMoreBtn');

  if (!form || !input || !resultsEl) return;

  var items = [];
  var filtered = [];
  var shown = 0;
  var categoriaAtiva = 'todas';
  var ready = false;
  var urlTimer = null;

  function normalize(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeRegExp(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function highlight(text, termos) {
    var safe = escapeHtml(text);
    if (!termos.length) return safe;

    termos.forEach(function (termo) {
      var pattern = new RegExp('(' + escapeRegExp(escapeHtml(termo)) + ')', 'gi');
      safe = safe.replace(pattern, '<mark>$1</mark>');
    });

    return safe;
  }

  function parseDate(value) {
    var parts = String(value || '').trim().split(' ')[0].split('/');
    if (parts.length !== 3) return 0;
    var day = parseInt(parts[0], 10);
    var month = parseInt(parts[1], 10);
    var year = parseInt(parts[2], 10);
    if (!day || !month || !year) return 0;
    return new Date(year, month - 1, day).getTime();
  }

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text;
  }

  function updateUrl() {
    if (urlTimer) window.clearTimeout(urlTimer);
    urlTimer = window.setTimeout(function () {
      var params = new URLSearchParams(window.location.search);
      var termo = input.value.trim();

      if (termo) params.set('q', termo);
      else params.delete('q');

      if (categoriaAtiva && categoriaAtiva !== 'todas') params.set('c', categoriaAtiva);
      else params.delete('c');

      var query = params.toString();
      var nextUrl = window.location.pathname + (query ? '?' + query : '');
      window.history.replaceState(null, '', nextUrl);
    }, 250);
  }

  function getTermos() {
    return normalize(input.value)
      .split(/\s+/)
      .filter(function (termo) { return termo.length > 0; });
  }

  function scoreItem(item, termos) {
    if (!termos.length) return 0;

    var titulo = normalize(item.titulo);
    var score = 0;

    termos.forEach(function (termo) {
      if (titulo.indexOf(termo) === 0) score += 4;
      else if (titulo.indexOf(termo) !== -1) score += 3;
      else score += 1;
    });

    return score;
  }

  function applyFilter() {
    if (!ready) return;

    var termos = getTermos();
    var query = termos.join(' ');

    filtered = items.filter(function (item) {
      if (categoriaAtiva !== 'todas' && item.categoria !== categoriaAtiva) return false;
      if (!termos.length) return true;

      var haystack = normalize([
        item.titulo,
        item.resumo,
        item.categoria,
        item.autor,
        item.data
      ].join(' '));

      return termos.every(function (termo) { return haystack.indexOf(termo) !== -1; });
    });

    if (termos.length) {
      filtered.sort(function (a, b) {
        var diff = scoreItem(b, termos) - scoreItem(a, termos);
        if (diff !== 0) return diff;
        return parseDate(b.data) - parseDate(a.data);
      });
    } else {
      filtered.sort(function (a, b) {
        return parseDate(b.data) - parseDate(a.data);
      });
    }

    shown = 0;
    resultsEl.innerHTML = '';

    if (!filtered.length) {
      var termoTexto = input.value.trim();
      setStatus(termoTexto ? 'Sem resultados para «' + termoTexto + '».' : 'Sem artigos nesta categoria.');
      resultsEl.innerHTML = '<p class="search-empty">Não encontrámos artigos para <strong>' +
        escapeHtml(termoTexto || categoriaAtiva) +
        '</strong>. Tenta outra palavra, o nome de uma operadora ou uma categoria.</p>';
      if (moreWrap) moreWrap.hidden = true;
      updateUrl();
      return;
    }

    setStatus(query
      ? filtered.length + ' ' + (filtered.length === 1 ? 'artigo encontrado' : 'artigos encontrados') + '.'
      : 'A mostrar os artigos mais recentes.');

    renderChunk(termos);
    updateUrl();
  }

  function renderChunk(termos) {
    var next = filtered.slice(shown, shown + PAGE_SIZE);

    next.forEach(function (item) {
      var article = document.createElement('article');
      article.className = 'search-result';

      var meta = document.createElement('div');
      meta.className = 'search-result-meta';
      meta.innerHTML = '<span>' + escapeHtml(item.categoria || 'Artigo') + '</span>' +
        '<span>' + escapeHtml(item.data || '') + '</span>' +
        (item.autor ? '<span>' + escapeHtml(item.autor) + '</span>' : '');

      var title = document.createElement('h2');
      title.innerHTML = '<a href="' + escapeHtml(item.url || 'artigos.html') + '">' +
        highlight(item.titulo, termos) + '</a>';

      var resumo = document.createElement('p');
      resumo.innerHTML = highlight(item.resumo, termos);

      article.appendChild(meta);
      article.appendChild(title);
      article.appendChild(resumo);
      resultsEl.appendChild(article);
    });

    shown += next.length;

    if (moreWrap) {
      moreWrap.hidden = shown >= filtered.length;
    }
    if (moreBtn) {
      moreBtn.textContent = 'Mostrar mais (' + Math.max(filtered.length - shown, 0) + ')';
    }
  }

  function buildChips() {
    if (!chipsEl) return;

    var categorias = [];
    items.forEach(function (item) {
      if (item.categoria && categorias.indexOf(item.categoria) === -1) {
        categorias.push(item.categoria);
      }
    });
    categorias.sort();

    chipsEl.innerHTML = '';

    var todas = document.createElement('button');
    todas.type = 'button';
    todas.className = 'search-chip';
    todas.textContent = 'Todas';
    todas.setAttribute('aria-pressed', categoriaAtiva === 'todas' ? 'true' : 'false');
    todas.addEventListener('click', function () {
      categoriaAtiva = 'todas';
      syncChips();
      applyFilter();
    });
    chipsEl.appendChild(todas);

    categorias.forEach(function (categoria) {
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'search-chip';
      chip.textContent = categoria;
      chip.setAttribute('aria-pressed', categoriaAtiva === categoria ? 'true' : 'false');
      chip.addEventListener('click', function () {
        categoriaAtiva = categoria;
        syncChips();
        applyFilter();
      });
      chipsEl.appendChild(chip);
    });
  }

  function syncChips() {
    if (!chipsEl) return;
    var chips = chipsEl.querySelectorAll('.search-chip');
    for (var i = 0; i < chips.length; i++) {
      var label = (chips[i].textContent || '').trim();
      var active = label === 'Todas' ? categoriaAtiva === 'todas' : label === categoriaAtiva;
      chips[i].setAttribute('aria-pressed', active ? 'true' : 'false');
    }
  }

  function loadIndex() {
    setStatus('A carregar o índice de artigos…');

    return fetch('assets/search-index.json', { cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) throw new Error('Falha ao carregar o índice');
        return response.json();
      })
      .then(function (data) {
        items = Array.isArray(data) ? data : (data.itens || []);
        ready = true;
        buildChips();
      })
      .catch(function () {
        setStatus('Não foi possível carregar o índice de artigos.');
        resultsEl.innerHTML = '<p class="search-empty">O índice de pesquisa está indisponível neste momento. Tenta novamente ou consulta <a href="todas-noticias.html">todos os artigos</a>.</p>';
      });
  }

  function initFromUrl() {
    var params = new URLSearchParams(window.location.search);
    var termo = params.get('q') || '';
    var categoria = params.get('c') || 'todas';

    if (termo) input.value = termo;
    categoriaAtiva = categoria;
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    applyFilter();
  });

  input.addEventListener('input', applyFilter);

  if (moreBtn) {
    moreBtn.addEventListener('click', function () {
      renderChunk(getTermos());
    });
  }

  initFromUrl();
  loadIndex().then(function () {
    if (ready) applyFilter();
  });
})();
