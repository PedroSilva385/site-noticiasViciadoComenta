(function () {
  const STORAGE_KEY_LAST_PUSH_TS = 'vc_push_last_seen_article_ts';
  const STORAGE_KEY_PUSH_PROMPT_DISMISSED = 'vc_push_prompt_dismissed';

  const DEFAULT_OPTIONS = {
    pollIntervalMs: 120000,
    fetchUrl: 'data/noticias.json'
  };

  function slugifyTitulo(titulo) {
    if (!titulo || typeof titulo !== 'string') return '';
    return titulo
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-');
  }

  function parseDataPublicacao(valor) {
    if (!valor || typeof valor !== 'string') return 0;

    const [datePart, timePart = '00:00'] = valor.trim().split(' ');
    const [dia, mes, ano] = (datePart || '').split('/').map(Number);
    const [hora, minuto] = (timePart || '00:00').split(':').map(Number);

    if (!dia || !mes || !ano) return 0;

    return new Date(
      ano,
      mes - 1,
      dia,
      Number.isFinite(hora) ? hora : 0,
      Number.isFinite(minuto) ? minuto : 0,
      0,
      0
    ).getTime();
  }

  function getArticleTimestamp(noticia) {
    const dataPublicacaoTs = parseDataPublicacao(noticia.dataPublicacao);
    if (dataPublicacaoTs > 0) return dataPublicacaoTs;

    const dataTs = parseDataPublicacao(noticia.data);
    return dataTs > 0 ? dataTs : 0;
  }

  function getArticleUrl(noticia) {
    const slug = noticia && noticia.slug
      ? slugifyTitulo(String(noticia.slug).trim())
      : slugifyTitulo((noticia && noticia.titulo) || '');

    if (slug) {
      return `${window.location.origin}/artigos/${encodeURIComponent(slug)}.html`;
    }

    return `${window.location.origin}/noticias.html?id=${encodeURIComponent(String((noticia && noticia.id) || ''))}`;
  }

  function isPushSupported() {
    return (
      'Notification' in window &&
      'serviceWorker' in navigator
    );
  }

  function ensureStyles() {
    if (document.getElementById('vc-push-style')) return;

    const style = document.createElement('style');
    style.id = 'vc-push-style';
    style.textContent = `
      .vc-push-prompt {
        position: fixed;
        bottom: 18px;
        right: 18px;
        z-index: 9998;
        max-width: 360px;
        background: #0f172a;
        color: #fff;
        border-radius: 12px;
        padding: 14px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, .3);
        font-size: 14px;
      }
      .vc-push-prompt-actions {
        margin-top: 10px;
        display: flex;
        gap: 8px;
      }
      .vc-push-prompt button {
        border: none;
        border-radius: 8px;
        padding: 8px 10px;
        cursor: pointer;
        font-weight: 700;
      }
      .vc-push-prompt .vc-allow {
        background: #2563eb;
        color: #fff;
      }
      .vc-push-prompt .vc-dismiss {
        background: #334155;
        color: #e2e8f0;
      }
    `;

    document.head.appendChild(style);
  }

  function showPermissionPrompt(onAllow) {
    if (localStorage.getItem(STORAGE_KEY_PUSH_PROMPT_DISMISSED) === '1') return;
    if (Notification.permission !== 'default') return;

    ensureStyles();

    const prompt = document.createElement('div');
    prompt.className = 'vc-push-prompt';
    prompt.innerHTML = `
      <strong>🔔 Notificações de novos artigos</strong>
      <div>Recebe um alerta no browser sempre que sair um novo artigo.</div>
      <div class="vc-push-prompt-actions">
        <button class="vc-allow">Ativar</button>
        <button class="vc-dismiss">Agora não</button>
      </div>
    `;

    const allowBtn = prompt.querySelector('.vc-allow');
    const dismissBtn = prompt.querySelector('.vc-dismiss');

    allowBtn.addEventListener('click', async () => {
      prompt.remove();
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          onAllow();
        }
      } catch (error) {
        console.warn('Falha ao pedir permissão de notificações:', error);
      }
    });

    dismissBtn.addEventListener('click', () => {
      localStorage.setItem(STORAGE_KEY_PUSH_PROMPT_DISMISSED, '1');
      prompt.remove();
    });

    document.body.appendChild(prompt);
  }

  async function showSystemNotification(article) {
    const title = '📰 Novo artigo publicado';
    const body = article && article.titulo ? article.titulo : 'Já saiu um novo artigo no VICIADO COMENTA.';
    const targetUrl = getArticleUrl(article);

    try {
      const registration = await navigator.serviceWorker.getRegistration('/');

      if (registration && registration.showNotification) {
        await registration.showNotification(title, {
          body,
          icon: '/assets/favicon.svg',
          badge: '/assets/favicon.svg',
          data: { url: targetUrl }
        });
        return;
      }
    } catch (error) {
      console.warn('Falha em showNotification via Service Worker:', error);
    }

    try {
      const notification = new Notification(title, {
        body,
        icon: '/assets/favicon.svg'
      });
      notification.onclick = () => {
        window.focus();
        window.location.href = targetUrl;
      };
    } catch (error) {
      console.warn('Falha em Notification fallback:', error);
    }
  }

  async function registerServiceWorkerIfNeeded() {
    try {
      await navigator.serviceWorker.register('/sw-notifications.js', { scope: '/' });
    } catch (error) {
      console.warn('Falha ao registar Service Worker de notificações:', error);
    }
  }

  function getLastSeenTimestamp(initialNoticias) {
    const stored = Number(localStorage.getItem(STORAGE_KEY_LAST_PUSH_TS));
    if (Number.isFinite(stored) && stored > 0) {
      return stored;
    }

    const initialMax = (Array.isArray(initialNoticias) ? initialNoticias : [])
      .map((item) => getArticleTimestamp(item))
      .reduce((max, value) => (value > max ? value : max), 0);

    const baseline = initialMax || Date.now();
    localStorage.setItem(STORAGE_KEY_LAST_PUSH_TS, String(baseline));
    return baseline;
  }

  async function pollNewArticles(options, state) {
    try {
      const response = await fetch(options.fetchUrl, { cache: 'no-store' });
      if (!response.ok) return;

      const data = await response.json();
      const noticias = Array.isArray(data.noticias) ? data.noticias : [];

      const now = Date.now();
      const newArticles = noticias
        .map((noticia) => ({ noticia, ts: getArticleTimestamp(noticia) }))
        .filter((item) => item.ts > state.lastSeenTs && item.ts <= now)
        .sort((a, b) => a.ts - b.ts);

      if (newArticles.length > 0 && Notification.permission === 'granted') {
        await showSystemNotification(newArticles[newArticles.length - 1].noticia);
      }

      const newestTs = noticias
        .map((item) => getArticleTimestamp(item))
        .reduce((max, value) => (value > max ? value : max), state.lastSeenTs);

      if (newestTs > state.lastSeenTs) {
        state.lastSeenTs = newestTs;
        localStorage.setItem(STORAGE_KEY_LAST_PUSH_TS, String(newestTs));
      }
    } catch (error) {
      console.warn('Erro no polling de novos artigos:', error);
    }
  }

  async function init(config) {
    if (!isPushSupported()) return;

    const options = { ...DEFAULT_OPTIONS, ...(config || {}) };
    const initialNoticias = Array.isArray(options.initialNoticias) ? options.initialNoticias : [];

    await registerServiceWorkerIfNeeded();

    const state = {
      lastSeenTs: getLastSeenTimestamp(initialNoticias)
    };

    const startPolling = () => {
      pollNewArticles(options, state);
      setInterval(() => {
        pollNewArticles(options, state);
      }, options.pollIntervalMs);
    };

    if (Notification.permission === 'granted') {
      startPolling();
    } else if (Notification.permission === 'default') {
      showPermissionPrompt(() => startPolling());
    }
  }

  window.PushArticleAlerts = {
    init
  };
})();
