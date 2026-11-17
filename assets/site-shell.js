/* ==========================================================================
   VICIADO COMENTA — Site Shell JS
   1. Tema claro/escuro unificado: aplica o tema guardado e cria o botão
      .theme-toggle quando a página ainda não tem um (sem duplicar handlers).
   2. Menu mobile unificado: injeta um botão hambúrguer antes da <nav> e
      alterna a gaveta (.shell-open). Em desktop o botão fica oculto por CSS.
   3. Logo do topo clicável: envolve o <h1> do <header> num link para a
      página inicial (respeita a <base href> usada pelos artigos espelho).
   4. PWA: injeta manifest, theme-color e apple-touch-icon e registra o
      service worker existente (push-notifications.js continua a funcionar).
   5. Acessibilidade: skip-link, aria-current no menu e aria-label nos ícones
      sociais.
   6. Pesquisa: acrescenta a entrada "Pesquisar" ao menu de todas as páginas.
   Carregado com defer em todas as páginas públicas + template dos artigos.
   ========================================================================== */
(function () {
  'use strict';

  // Guardar a referência ao próprio <script> para resolver a raiz do site,
  // mesmo quando a página usa <base href> (artigos espelho em /artigos/).
  var scriptTag = document.currentScript || null;

  function readStoredTheme() {
    try {
      return localStorage.getItem('theme') || 'light';
    } catch (error) {
      return 'light';
    }
  }

  function writeStoredTheme(value) {
    try {
      localStorage.setItem('theme', value);
    } catch (error) {
      /* ignora erros de storage */
    }
  }

  function setThemeIcon(btn, isDark) {
    if (!btn) return;
    btn.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
  }

  function applyTheme(theme) {
    var isDark = theme === 'dark';
    document.body.classList.toggle('dark', isDark);
    setThemeIcon(document.getElementById('themeToggle'), isDark);
  }

  // Aplicar o tema o mais cedo possível para reduzir o flash de tema claro
  try {
    document.body.classList.toggle('dark', readStoredTheme() === 'dark');
  } catch (error) {
    /* ignora */
  }

  function initTheme() {
    applyTheme(readStoredTheme());

    // Se a página já tem botão (com handler próprio), não duplicar
    var existing = document.getElementById('themeToggle');
    if (existing) return;

    var btn = document.createElement('button');
    btn.id = 'themeToggle';
    btn.className = 'theme-toggle';
    btn.type = 'button';
    btn.title = 'Alternar tema';
    btn.setAttribute('aria-label', 'Alternar tema claro/escuro');
    btn.innerHTML = document.body.classList.contains('dark')
      ? '<i class="fas fa-sun"></i>'
      : '<i class="fas fa-moon"></i>';

    var headerEl = document.querySelector('header');
    if (headerEl) {
      headerEl.appendChild(btn);
    } else {
      btn.classList.add('theme-toggle--fixed');
      document.body.appendChild(btn);
    }

    btn.addEventListener('click', function () {
      var next = document.body.classList.contains('dark') ? 'light' : 'dark';
      writeStoredTheme(next);
      applyTheme(next);
    });
  }

  function getSiteRoot() {
    // O site-shell.js vive sempre em <raiz>/assets/site-shell.js, por isso o
    // URL resolvido do script identifica a raiz do site em qualquer página,
    // subpasta ou <base href> (usada pelos artigos espelho em /artigos/).
    var src = '';
    if (scriptTag) {
      src = scriptTag.src || scriptTag.getAttribute('src') || '';
    }
    var root = src.split('?')[0].replace(/assets\/site-shell\.js$/, '');
    if (!root) {
      // Sem referência ao <script>: usar a <base href> quando existir.
      var baseEl = document.querySelector('base[href]');
      root = baseEl ? baseEl.href : '';
    }
    return root;
  }

  function getHomeHref() {
    return getSiteRoot() + 'index.html';
  }

  function appendHeadTag(tagName, attributes) {
    var head = document.head;
    if (!head) return null;

    var existing = head.querySelector(tagName + '[data-shell-pwa]');
    if (existing) return existing;

    var el = document.createElement(tagName);
    for (var key in attributes) {
      if (Object.prototype.hasOwnProperty.call(attributes, key)) {
        el.setAttribute(key, attributes[key]);
      }
    }
    el.setAttribute('data-shell-pwa', '1');
    head.appendChild(el);
    return el;
  }

  function initPwa() {
    var root = getSiteRoot();

    appendHeadTag('link', { rel: 'manifest', href: root + 'assets/manifest.webmanifest' });
    appendHeadTag('link', { rel: 'apple-touch-icon', sizes: '180x180', href: root + 'assets/icons/apple-touch-icon.png' });
    appendHeadTag('meta', { name: 'theme-color', content: '#0066cc' });

    if ('serviceWorker' in navigator) {
      try {
        navigator.serviceWorker.register(root + 'sw-notifications.js', { scope: root }).catch(function () {
          /* registo já feito por push-notifications.js ou bloqueado */
        });
      } catch (error) {
        /* ignora ambientes sem suporte */
      }
    }
  }

  function initSkipLink() {
    var main = document.querySelector('main');
    if (!main || document.querySelector('.skip-link')) return;

    if (!main.id) main.id = 'conteudo';
    if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');

    var link = document.createElement('a');
    link.className = 'skip-link';
    link.href = '#' + main.id;
    link.textContent = 'Saltar para o conteúdo';

    document.body.insertBefore(link, document.body.firstChild);
  }

  function initNavSearch() {
    var nav = document.querySelector('nav');
    if (!nav || nav.querySelector('.shell-nav-search')) return;

    var link = document.createElement('a');
    link.className = 'shell-nav-search';
    link.href = getSiteRoot() + 'pesquisa.html';
    link.textContent = 'Pesquisar';

    nav.appendChild(link);
  }

  function initNavState() {
    var nav = document.querySelector('nav');
    if (!nav) return;

    var current = window.location.pathname;
    if (/\/$/.test(current)) current += 'index.html';

    // paginas de artigos (espelhos em /artigos/, artigos.html e noticias.html)
    // contam como "Artigos", que no nav aponta para todas-noticias.html
    var secaoAtual = current.replace(/\/(?:artigos\/[^/]*|artigos|noticias)\.html$/, '/todas-noticias.html');

    var links = nav.querySelectorAll('a[href]');
    for (var i = 0; i < links.length; i++) {
      var link = links[i];
      var target = '';
      try {
        target = new URL(link.href, window.location.href).pathname;
      } catch (error) {
        target = link.getAttribute('href') || '';
      }
      if (target && target === secaoAtual) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    }
  }

  function initSocialLabels() {
    var links = document.querySelectorAll('.social-media a');
    for (var i = 0; i < links.length; i++) {
      var link = links[i];
      if (!link.getAttribute('aria-label')) {
        var label = link.getAttribute('title') || (link.textContent || '').trim();
        if (label) link.setAttribute('aria-label', label);
      }
      var icon = link.querySelector('i');
      if (icon) icon.setAttribute('aria-hidden', 'true');
    }
  }

  function initLogoLink() {
    var headerEl = document.querySelector('header');
    if (!headerEl) return;

    var title = headerEl.querySelector('h1');
    if (!title || (title.closest && title.closest('a'))) return;

    var link = document.createElement('a');
    link.className = 'logo-link';
    link.href = getHomeHref();
    link.setAttribute('aria-label', 'Viciado Comenta — ir para a página inicial');

    title.parentNode.insertBefore(link, title);
    link.appendChild(title);
  }

  function initBurger() {
    var nav = document.querySelector('nav');
    if (!nav || nav.dataset.shellInit) return;
    nav.dataset.shellInit = '1';
    nav.classList.add('shell-nav');
    if (!nav.id) nav.id = 'shellNav';

    var burger = document.createElement('button');
    burger.className = 'shell-burger';
    burger.type = 'button';
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-controls', nav.id);
    burger.innerHTML = '<span class="shell-burger__bars" aria-hidden="true"><i></i><i></i><i></i></span><span class="shell-burger__label">Menu</span>';

    nav.parentNode.insertBefore(burger, nav);

    function close() {
      nav.classList.remove('shell-open');
      burger.setAttribute('aria-expanded', 'false');
    }

    burger.addEventListener('click', function () {
      var open = nav.classList.toggle('shell-open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    // Fechar a gaveta ao navegar
    nav.addEventListener('click', function (event) {
      var link = event.target && event.target.closest ? event.target.closest('a') : null;
      if (link) close();
    });

    // Fechar com Escape ou clique fora
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') close();
    });

    document.addEventListener('click', function (event) {
      if (!nav.classList.contains('shell-open')) return;
      if (nav.contains(event.target) || burger.contains(event.target)) return;
      close();
    });
  }

  function init() {
    initPwa();
    initTheme();
    initSkipLink();
    initLogoLink();
    initNavSearch();
    initNavState();
    initSocialLabels();
    initBurger();

    // Proteção contra botões de tema duplicados criados por scripts antigos
    window.setTimeout(function () {
      var toggles = document.querySelectorAll('#themeToggle');
      for (var i = 1; i < toggles.length; i++) {
        toggles[i].parentNode && toggles[i].parentNode.removeChild(toggles[i]);
      }
    }, 0);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
