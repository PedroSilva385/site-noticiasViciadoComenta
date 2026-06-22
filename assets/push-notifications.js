(function () {
  var ENGAGEMENT_PROMPTS_ENABLED = window.VC_ENABLE_ENGAGEMENT_PROMPTS === true;
  const STORAGE_KEY_PUSH_PROMPT_DISMISSED = 'vc_push_prompt_dismissed';
  const STORAGE_KEY_PUSH_SUBSCRIBED = 'vc_push_subscribed';
  const DEFAULT_OPTIONS = {
    configUrl: '/data/push-public-config.json'
  };

  let initPromise = null;

  function isPushSupported() {
    return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
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
        width: min(380px, calc(100vw - 24px));
        background: #0f172a;
        color: #fff;
        border-radius: 16px;
        padding: 16px;
        box-shadow: 0 14px 34px rgba(0, 0, 0, .32);
        font-size: 14px;
        line-height: 1.5;
      }
      .vc-push-prompt strong {
        display: block;
        margin-bottom: 6px;
        font-size: 15px;
      }
      .vc-push-prompt small {
        display: block;
        margin-top: 8px;
        color: rgba(226, 232, 240, 0.88);
      }
      .vc-push-prompt-actions {
        margin-top: 12px;
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .vc-push-prompt button {
        border: none;
        border-radius: 10px;
        padding: 10px 12px;
        cursor: pointer;
        font-weight: 700;
      }
      .vc-push-prompt .vc-allow {
        background: #2563eb;
        color: #fff;
      }
      .vc-push-prompt .vc-dismiss,
      .vc-push-prompt .vc-disable {
        background: #334155;
        color: #e2e8f0;
      }
      .vc-push-toast {
        position: fixed;
        top: 18px;
        right: 18px;
        z-index: 9999;
        width: min(340px, calc(100vw - 24px));
        padding: 12px 14px;
        border-radius: 12px;
        background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
        color: #fff;
        box-shadow: 0 12px 30px rgba(0, 0, 0, .28);
        line-height: 1.45;
      }
      .vc-push-toast.vc-error {
        background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
      }
      .vc-push-launcher {
        position: fixed;
        left: 18px;
        bottom: 18px;
        z-index: 9997;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        border: none;
        border-radius: 999px;
        padding: 12px 16px;
        background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
        color: #fff;
        font-weight: 700;
        box-shadow: 0 12px 28px rgba(0, 0, 0, .28);
        cursor: pointer;
      }
      .vc-push-launcher[hidden] {
        display: none;
      }
      @media (max-width: 480px) {
        .vc-push-prompt,
        .vc-push-toast {
          left: 12px;
          right: 12px;
          width: auto;
        }
        .vc-push-launcher {
          left: 12px;
          bottom: 12px;
          right: 12px;
          justify-content: center;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function showToast(message, isError) {
    ensureStyles();

    const toast = document.createElement('div');
    toast.className = `vc-push-toast${isError ? ' vc-error' : ''}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 4500);
  }

  function getLauncherElement() {
    return document.getElementById('vc-push-launcher');
  }

  function removeLauncher() {
    const launcher = getLauncherElement();
    if (launcher) {
      launcher.remove();
    }
  }

  function showLauncher(options) {
    if (localStorage.getItem(STORAGE_KEY_PUSH_SUBSCRIBED) === '1') {
      removeLauncher();
      return;
    }

    ensureStyles();

    let launcher = getLauncherElement();
    if (!launcher) {
      launcher = document.createElement('button');
      launcher.type = 'button';
      launcher.id = 'vc-push-launcher';
      launcher.className = 'vc-push-launcher';
      launcher.setAttribute('data-skip-click-tracking', 'true');
      launcher.innerHTML = '<span aria-hidden="true">🔔</span><span>Ativar notificações</span>';
      document.body.appendChild(launcher);
    }

    launcher.hidden = false;
    launcher.onclick = async () => {
      if (Notification.permission === 'denied') {
        showToast('No Brave, desbloqueia as notificações nas permissões do site e recarrega a página.', true);
        return;
      }

      localStorage.removeItem(STORAGE_KEY_PUSH_PROMPT_DISMISSED);

      if (Notification.permission === 'granted') {
        try {
          await subscribeToPush(options);
          removeLauncher();
        } catch (error) {
          showToast(error && error.message ? error.message : 'Não foi possível ativar as notificações.', true);
        }
        return;
      }

      await showPermissionPrompt(options, true);
    };
  }

  function getDatabaseInstance() {
    if (typeof firebase === 'undefined' || !firebase.apps || !firebase.apps.length || typeof firebase.database !== 'function') {
      throw new Error('Firebase Database não está disponível.');
    }

    return firebase.database();
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let index = 0; index < rawData.length; index += 1) {
      outputArray[index] = rawData.charCodeAt(index);
    }

    return outputArray;
  }

  async function fetchPushConfig(configUrl) {
    const response = await fetch(configUrl, { method: 'GET', cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Falha ao carregar configuração push (${response.status}).`);
    }

    const payload = await response.json();
    if (!payload || !payload.vapidPublicKey) {
      throw new Error('Configuração push inválida.');
    }

    return payload;
  }

  function normalizePushError(error) {
    if (!error || !error.message) {
      return error instanceof Error ? error : new Error('Não foi possível ativar as notificações.');
    }

    const rawMessage = String(error.message || '');
    const message = rawMessage.toLowerCase();

    if (message.includes('push service error')) {
      return new Error('O Brave falhou ao ligar ao serviço de push. Confirma em Brave > Definições > Privacidade e segurança que a opção de serviços Google para notificações push está ativa, e tenta fora de janela privada.');
    }

    if (message.includes('permission denied') && Notification.permission === 'granted') {
      return new Error('O browser bloqueou o registo push. No Brave/Chrome isto acontece muitas vezes em janela privada. Tenta numa janela normal e confirma que as notificações do site não estão bloqueadas.');
    }

    if (message.includes('permission denied')) {
      return new Error('O browser recusou a subscrição push. Confirma que as notificações do site estão permitidas e tenta novamente.');
    }

    return error instanceof Error ? error : new Error(rawMessage);
  }

  async function sha256Hex(value) {
    const encoder = new TextEncoder();
    const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(String(value || '').trim()));
    return Array.from(new Uint8Array(buffer)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  async function registerServiceWorkerIfNeeded() {
    await navigator.serviceWorker.register('/sw-notifications.js', { scope: '/' });
    return navigator.serviceWorker.ready;
  }

  async function getCurrentSubscription() {
    const registration = await registerServiceWorkerIfNeeded();
    return registration.pushManager.getSubscription();
  }

  async function saveSubscriptionRecord(subscription) {
    if (!subscription || !subscription.endpoint || !subscription.keys || !subscription.keys.p256dh || !subscription.keys.auth) {
      throw new Error('Subscription Web Push inválida.');
    }

    const database = getDatabaseInstance();
    const subscriptionId = await sha256Hex(subscription.endpoint);
    const now = Date.now();

    await database.ref(`push_subscriptions/${subscriptionId}`).set({
      subscription: {
        endpoint: String(subscription.endpoint).trim(),
        expirationTime: subscription.expirationTime == null ? null : Number(subscription.expirationTime),
        keys: {
          p256dh: String(subscription.keys.p256dh).trim(),
          auth: String(subscription.keys.auth).trim()
        }
      },
      topic: 'all',
      status: 'active',
      createdAt: now,
      updatedAt: now,
      lastSeenAt: now,
      userAgent: String(navigator.userAgent || '').slice(0, 300),
      language: String(navigator.language || '').slice(0, 32),
      origin: String(window.location.origin || '').slice(0, 120)
    });

    return subscriptionId;
  }

  async function removeSubscriptionRecord(subscription) {
    if (!subscription || !subscription.endpoint) {
      localStorage.removeItem(STORAGE_KEY_PUSH_SUBSCRIBED);
      return null;
    }

    const database = getDatabaseInstance();
    const subscriptionId = await sha256Hex(subscription.endpoint);
    await database.ref(`push_subscriptions/${subscriptionId}`).remove();
    return subscriptionId;
  }

  async function subscribeToPush(options) {
    try {
      const permission = Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission();

      if (permission !== 'granted') {
        throw new Error('Permissão de notificações não concedida.');
      }

      const config = await fetchPushConfig(options.configUrl);
      const registration = await registerServiceWorkerIfNeeded();
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(config.vapidPublicKey)
        });
      }

      await saveSubscriptionRecord(subscription.toJSON());
      localStorage.setItem(STORAGE_KEY_PUSH_SUBSCRIBED, '1');
      localStorage.removeItem(STORAGE_KEY_PUSH_PROMPT_DISMISSED);
      showToast('Notificações ativadas com sucesso.');
    } catch (error) {
      console.warn('Falha ao subscrever notificações push:', error);
      throw normalizePushError(error);
    }
  }

  async function unsubscribeFromPush(options) {
    const subscription = await getCurrentSubscription();
    if (!subscription) {
      localStorage.removeItem(STORAGE_KEY_PUSH_SUBSCRIBED);
      return;
    }

    await removeSubscriptionRecord(subscription.toJSON());
    await subscription.unsubscribe();
    localStorage.removeItem(STORAGE_KEY_PUSH_SUBSCRIBED);
    showToast('Notificações desativadas.');
  }

  function buildPromptMarkup(isStandaloneIos) {
    return `
      <strong>🔔 Notificações de novos artigos</strong>
      <div>Subscreve para receber alertas no teu telemóvel sempre que sair um novo artigo.</div>
      ${isStandaloneIos ? '<small>No iPhone, as notificações web funcionam melhor depois de adicionares o site ao ecrã principal.</small>' : ''}
      <div class="vc-push-prompt-actions">
        <button class="vc-allow">Ativar</button>
        <button class="vc-dismiss">Agora não</button>
      </div>
    `;
  }

  function detectStandaloneIos() {
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    return isIos && !isStandalone;
  }

  async function showPermissionPrompt(options, forceDisplay) {
    if (!forceDisplay && localStorage.getItem(STORAGE_KEY_PUSH_PROMPT_DISMISSED) === '1') return;
    if (Notification.permission !== 'default') return;

    const existingPrompt = document.querySelector('.vc-push-prompt');
    if (existingPrompt) return;

    ensureStyles();

    const prompt = document.createElement('div');
    prompt.className = 'vc-push-prompt';
    prompt.innerHTML = buildPromptMarkup(detectStandaloneIos());

    const allowBtn = prompt.querySelector('.vc-allow');
    const dismissBtn = prompt.querySelector('.vc-dismiss');

    allowBtn.addEventListener('click', async () => {
      allowBtn.disabled = true;
      try {
        await subscribeToPush(options);
        removeLauncher();
        prompt.remove();
      } catch (error) {
        showToast(error && error.message ? error.message : 'Não foi possível ativar as notificações.', true);
        allowBtn.disabled = false;
      }
    });

    dismissBtn.addEventListener('click', () => {
      localStorage.setItem(STORAGE_KEY_PUSH_PROMPT_DISMISSED, '1');
      prompt.remove();
    });

    document.body.appendChild(prompt);
  }

  async function syncExistingSubscription(options) {
    try {
      const subscription = await getCurrentSubscription();
      if (!subscription) {
        localStorage.removeItem(STORAGE_KEY_PUSH_SUBSCRIBED);
        return false;
      }

      await saveSubscriptionRecord(subscription.toJSON());
      localStorage.setItem(STORAGE_KEY_PUSH_SUBSCRIBED, '1');
      return true;
    } catch (error) {
      console.warn('Falha ao sincronizar subscription existente:', error);
      return false;
    }
  }

  async function init(config) {
    if (!ENGAGEMENT_PROMPTS_ENABLED) return;
    if (!isPushSupported()) return;
    if (initPromise) return initPromise;

    const options = { ...DEFAULT_OPTIONS, ...(config || {}) };

    initPromise = (async () => {
      await registerServiceWorkerIfNeeded();
      const alreadySubscribed = await syncExistingSubscription(options);

      if (alreadySubscribed || Notification.permission === 'denied') {
        showLauncher(options);
        return;
      }

      showLauncher(options);

      if (Notification.permission === 'default') {
        await showPermissionPrompt(options);
      }
    })().catch((error) => {
      console.warn('Falha ao inicializar notificações push:', error);
    });

    return initPromise;
  }

  window.PushArticleAlerts = {
    init,
    subscribe: (config) => subscribeToPush({ ...DEFAULT_OPTIONS, ...(config || {}) }),
    unsubscribe: (config) => unsubscribeFromPush({ ...DEFAULT_OPTIONS, ...(config || {}) })
  };
})();
