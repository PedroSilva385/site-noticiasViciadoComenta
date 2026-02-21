// ✅ CONFIGURAÇÃO FIREBASE SEGURA
// Data: 03/02/2026
// Google Cloud Console: https://console.cloud.google.com/apis/credentials
// Projeto: chat-viciadocomenta
//
// ✅ SEGURANÇA APLICADA:
// - API Key regenerada (chave antiga desativada)
// - HTTP Referrers restritos a: viciadocomenta.pt
// - APIs restritas a: Identity Toolkit, Token Service, Firebase Realtime Database

const firebaseConfig = {
  apiKey: "AIzaSyCrWyoW7qjHHsF2lP9LzLs21AtPEa-r8NI",
  authDomain: "chat-viciadocomenta.firebaseapp.com",
  databaseURL: "https://chat-viciadocomenta-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "chat-viciadocomenta",
  storageBucket: "chat-viciadocomenta.firebasestorage.app",
  messagingSenderId: "183684670526",
  appId: "1:183684670526:web:64b1f62cf80e05d4781d6f"
};

const ANALYTICS_CONFIG = {
  ipEndpoints: [
    'https://api64.ipify.org?format=json',
    'https://api.ipify.org?format=json'
  ]
};

function sanitizeFirebaseKey(rawValue) {
  if (!rawValue) return 'unknown';
  return String(rawValue)
    .replace(/[.#$\[\]/]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 180) || 'unknown';
}

async function hashText(value) {
  const normalized = String(value || 'anonymous');

  try {
    if (window.crypto && window.crypto.subtle && window.TextEncoder) {
      const data = new TextEncoder().encode(normalized);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('');
    }
  } catch (error) {
    console.warn('⚠️ Falha ao criar hash SHA-256, usando fallback:', error);
  }

  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = ((hash << 5) - hash) + normalized.charCodeAt(index);
    hash |= 0;
  }
  return `fallback_${Math.abs(hash)}`;
}

async function getVisitorFingerprint() {
  for (const endpoint of ANALYTICS_CONFIG.ipEndpoints) {
    try {
      const response = await fetch(endpoint, { cache: 'no-store' });
      if (!response.ok) {
        continue;
      }

      const payload = await response.json();
      if (payload && payload.ip) {
        return hashText(payload.ip);
      }
    } catch (error) {
      console.warn(`⚠️ Não foi possível obter IP em ${endpoint}:`, error);
    }
  }

  let localFingerprint = localStorage.getItem('vc_local_fingerprint');
  if (!localFingerprint) {
    localFingerprint = `local_${Math.random().toString(36).slice(2)}_${Date.now()}`;
    localStorage.setItem('vc_local_fingerprint', localFingerprint);
  }

  return hashText(localFingerprint);
}

async function registerUniqueVisit(db, visitorHash) {
  const pagePath = window.location.pathname || '/';
  const pageKey = sanitizeFirebaseKey(pagePath);
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const month = now.toISOString().substring(0, 7);
  const statsRef = db.ref('site_stats');

  const uniqueVisitRef = db.ref(`site_unique_views/daily/${today}/${visitorHash}`);
  let isUniqueForDay = false;

  await uniqueVisitRef.transaction((currentValue) => {
    if (currentValue) {
      return currentValue;
    }

    isUniqueForDay = true;
    return {
      timestamp: firebase.database.ServerValue.TIMESTAMP,
      page: pagePath
    };
  });

  if (!isUniqueForDay) {
    return;
  }

  await statsRef.transaction((data) => {
    if (!data) {
      data = {
        total_visits: 0,
        daily: {},
        monthly: {},
        unique_total: 0,
        unique_daily: {},
        unique_monthly: {},
        pages: {},
        last_updated: new Date().toISOString()
      };
    }

    data.total_visits = (data.total_visits || 0) + 1;

    if (!data.daily) data.daily = {};
    data.daily[today] = (data.daily[today] || 0) + 1;

    if (!data.monthly) data.monthly = {};
    data.monthly[month] = (data.monthly[month] || 0) + 1;

    data.unique_total = (data.unique_total || 0) + 1;

    if (!data.unique_daily) data.unique_daily = {};
    data.unique_daily[today] = (data.unique_daily[today] || 0) + 1;

    if (!data.unique_monthly) data.unique_monthly = {};
    data.unique_monthly[month] = (data.unique_monthly[month] || 0) + 1;

    if (!data.pages) data.pages = {};
    data.pages[pageKey] = (data.pages[pageKey] || 0) + 1;

    data.last_updated = new Date().toISOString();
    return data;
  });
}

function setupClickTracking(db, visitorHash) {
  const debounceMap = new Map();

  document.addEventListener('click', (event) => {
    try {
      const clickable = event.target && event.target.closest
        ? event.target.closest('a, button')
        : null;

      if (!clickable) {
        return;
      }

      const rawLabel = (
        clickable.getAttribute('aria-label') ||
        clickable.getAttribute('title') ||
        clickable.textContent ||
        clickable.id ||
        clickable.className ||
        'click'
      ).trim();

      const label = rawLabel.replace(/\s+/g, ' ').slice(0, 120) || 'click';
      const href = clickable.getAttribute('href') || '';
      const targetDescriptor = href
        ? `${label} -> ${href}`
        : label;

      const pagePath = window.location.pathname || '/';
      const targetKey = sanitizeFirebaseKey(targetDescriptor);
      const pageKey = sanitizeFirebaseKey(pagePath);

      const nowMs = Date.now();
      const debounceKey = `${pageKey}:${targetKey}`;
      const last = debounceMap.get(debounceKey) || 0;
      if (nowMs - last < 800) {
        return;
      }
      debounceMap.set(debounceKey, nowMs);

      const targetRef = db.ref(`click_stats/targets/${targetKey}`);
      targetRef.transaction((data) => {
        if (!data) {
          data = { count: 0, label, href, page: pagePath, last_clicked: null };
        }
        data.count = (data.count || 0) + 1;
        data.label = label;
        data.href = href;
        data.page = pagePath;
        data.last_clicked = new Date().toISOString();
        return data;
      });

      const pageRef = db.ref(`click_stats/pages/${pageKey}`);
      pageRef.transaction((data) => {
        if (!data) {
          data = { count: 0, path: pagePath, last_clicked: null };
        }
        data.count = (data.count || 0) + 1;
        data.path = pagePath;
        data.last_clicked = new Date().toISOString();
        return data;
      });

      const today = new Date().toISOString().split('T')[0];
      const dailyTargetRef = db.ref(`click_stats/daily/${today}/targets/${targetKey}`);
      dailyTargetRef.transaction((data) => {
        if (!data) {
          data = { count: 0, label, href };
        }
        data.count = (data.count || 0) + 1;
        data.label = label;
        data.href = href;
        return data;
      });

      const visitorClickRef = db.ref(`click_stats/visitors/${today}/${visitorHash}`);
      visitorClickRef.transaction((data) => {
        if (!data) {
          data = { total_clicks: 0 };
        }
        data.total_clicks = (data.total_clicks || 0) + 1;
        return data;
      });
    } catch (error) {
      console.error('❌ Erro ao registar clique:', error);
    }
  }, { passive: true });
}

function ensureFirebaseInitialized() {
  if (typeof firebase === 'undefined') {
    return Promise.reject(new Error('Firebase SDK nao carregado.'));
  }

  if (window.firebaseInitialized && firebase.apps && firebase.apps.length) {
    return Promise.resolve(true);
  }

  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  window.firebaseInitialized = true;
  return Promise.resolve(true);
}

// Inicializar Firebase
function initializeFirebaseApp() {
  if (typeof firebase === 'undefined') {
    console.log('⏳ Aguardando Firebase SDK carregar...');
    setTimeout(initializeFirebaseApp, 50);
    return;
  }

  if (window.firebaseInitialized) {
    return;
  }

  ensureFirebaseInitialized().then(() => {
    try {
      if (!window.firebaseInitialized) {
        return;
      }

      console.log('✓ Firebase inicializado com sucesso');

      // Analytics de visitas após inicialização
      try {
        const db = firebase.database();
        getVisitorFingerprint()
          .then((visitorHash) => {
            registerUniqueVisit(db, visitorHash)
              .then(() => {
                console.log('✓ Visita única (IP hash) registada');
              })
              .catch((error) => {
                console.error('❌ Erro ao registar visita única:', error);
              });

            setupClickTracking(db, visitorHash);
            console.log('✓ Tracking de cliques ativo');
          })
          .catch((error) => {
            console.error('❌ Erro ao obter fingerprint de visitante:', error);
          });

        const userId = 'user_' + Math.random().toString(36).substr(2,9);
        const activeUserRef = db.ref('active_users/' + userId);
        activeUserRef.set({
          timestamp: firebase.database.ServerValue.TIMESTAMP,
          page: window.location.pathname
        });
        activeUserRef.onDisconnect().remove();
        window.addEventListener('beforeunload', () => activeUserRef.remove());

        // Histórico de sessões ativas (um registo por sessão)
        const sessionKey = 'vc_active_session_id';
        const historyWrittenKey = 'vc_active_history_written';
        let sessionId = sessionStorage.getItem(sessionKey);
        if (!sessionId) {
          sessionId = 'sess_' + Math.random().toString(36).substr(2, 9);
          sessionStorage.setItem(sessionKey, sessionId);
        }

        if (!sessionStorage.getItem(historyWrittenKey)) {
          const historyRef = db.ref('active_users_history/' + sessionId);
          historyRef.set({
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            page: window.location.pathname
          }).then(() => {
            sessionStorage.setItem(historyWrittenKey, '1');
          }).catch((err) => console.error('❌ Erro no histórico de ativos:', err));
        }

        console.log('✓ Analytics configurado');
      } catch (analyticsError) {
        console.error('❌ Erro no analytics:', analyticsError);
      }
    } catch (error) {
      console.error('Erro ao inicializar Firebase:', error);
    }
  }).catch((error) => {
    console.error('Erro ao inicializar Firebase:', error);
  });
}

// Iniciar processo de inicialização
initializeFirebaseApp();

window.ensureFirebaseInitialized = ensureFirebaseInitialized;
