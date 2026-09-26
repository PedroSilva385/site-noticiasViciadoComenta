/* ==========================================================================
   VICIADO COMENTA — Site Shell JS
   1. Tema claro/escuro unificado: aplica o tema guardado e cria o botão
      .theme-toggle quando a página ainda não tem um (sem duplicar handlers).
   2. Menu mobile unificado: injeta um botão hambúrguer antes da <nav> e
      alterna a gaveta (.shell-open). Em desktop o botão fica oculto por CSS.
   Carregado com defer em todas as páginas públicas + template dos artigos.
   ========================================================================== */
(function () {
  'use strict';

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
    initTheme();
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
