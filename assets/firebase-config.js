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
  ],
  optOutStorageKey: 'vc_analytics_opt_out'
};

function readAnalyticsPreferenceFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search || '');

    if (params.has('naoContarAcessos')) {
      const raw = (params.get('naoContarAcessos') || '').toLowerCase();
      const shouldDisable = raw === '1' || raw === 'true' || raw === 'sim' || raw === 'on';
      localStorage.setItem(ANALYTICS_CONFIG.optOutStorageKey, shouldDisable ? '1' : '0');
    }
  } catch (error) {
    console.warn('⚠️ Não foi possível ler preferência de analytics da URL:', error);
  }
}

function shouldSkipAnalyticsTracking() {
  readAnalyticsPreferenceFromUrl();

  const hostname = (window.location.hostname || '').toLowerCase();
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return true;
  }

  const path = (window.location.pathname || '').toLowerCase();
  if (path.endsWith('/estatisticas.html') || path.endsWith('estatisticas.html')) {
    return true;
  }

  return localStorage.getItem(ANALYTICS_CONFIG.optOutStorageKey) === '1';
}

function isFirebasePermissionDenied(error) {
  if (!error) return false;

  const code = String(error.code || '').toLowerCase();
  const message = String(error.message || '').toLowerCase();
  return code.includes('permission_denied') || message.includes('permission_denied');
}

function sanitizeFirebaseKey(rawValue) {
  if (!rawValue) return 'unknown';
  return String(rawValue)
    .replace(/[.#$\[\]/]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 180) || 'unknown';
}

function normalizeCount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getLocalMonthKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function shouldRegisterVisitForSession() {
  const visitCountedKey = 'vc_visit_metrics_recorded';

  if (sessionStorage.getItem(visitCountedKey) === '1') {
    return false;
  }

  sessionStorage.setItem(visitCountedKey, '1');
  return true;
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

async function registerVisitMetrics(db, visitorHash, countSessionVisit = true) {
  const pagePath = window.location.pathname || '/';
  const pageKey = sanitizeFirebaseKey(pagePath);
  const now = new Date();
  const today = getLocalDateKey(now);
  const month = getLocalMonthKey(now);
  const hour = String(now.getHours()).padStart(2, '0');
  const statsRef = db.ref('site_stats');

  // Referrer / fonte de tráfego
  const rawReferrer = document.referrer || '';
  let referrerKey = 'direct';
  if (rawReferrer) {
    try {
      const refHost = new URL(rawReferrer).hostname || rawReferrer.slice(0, 60);
      referrerKey = sanitizeFirebaseKey(refHost);
    } catch (_) {
      referrerKey = sanitizeFirebaseKey(rawReferrer.slice(0, 60));
    }
  }

  await statsRef.transaction((data) => {
    if (!data) {
      data = {
        total_visits: 0,
        daily: {},
        monthly: {},
        hourly: {},
        unique_total: 0,
        unique_daily: {},
        unique_monthly: {},
        unique_hourly: {},
        pages: {},
        referrers: {},
        last_updated: new Date().toISOString()
      };
    }

    if (countSessionVisit) {
      data.total_visits = normalizeCount(data.total_visits) + 1;

      if (!data.daily) data.daily = {};
      data.daily[today] = normalizeCount(data.daily[today]) + 1;

      if (!data.monthly) data.monthly = {};
      data.monthly[month] = normalizeCount(data.monthly[month]) + 1;

      if (!data.hourly) data.hourly = {};
      if (!data.hourly[today]) data.hourly[today] = {};
      data.hourly[today][hour] = normalizeCount(data.hourly[today][hour]) + 1;
    }

    if (!data.pages) data.pages = {};
    data.pages[pageKey] = normalizeCount(data.pages[pageKey]) + 1;

    if (!data.referrers) data.referrers = {};
    data.referrers[referrerKey] = normalizeCount(data.referrers[referrerKey]) + 1;

    data.last_updated = new Date().toISOString();
    return data;
  });

  if (!countSessionVisit) {
    return;
  }

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

  const uniqueAllRef = db.ref(`site_unique_views/all/${visitorHash}`);
  let isUniqueGlobal = false;

  await uniqueAllRef.transaction((currentValue) => {
    if (currentValue) {
      return currentValue;
    }

    isUniqueGlobal = true;
    return {
      first_seen: firebase.database.ServerValue.TIMESTAMP,
      last_page: pagePath
    };
  });

  if (!isUniqueForDay && !isUniqueGlobal) {
    return;
  }

  await statsRef.transaction((data) => {
    if (!data) {
      data = {
        total_visits: 0,
        daily: {},
        monthly: {},
        hourly: {},
        unique_total: 0,
        unique_daily: {},
        unique_monthly: {},
        unique_hourly: {},
        pages: {},
        last_updated: new Date().toISOString()
      };
    }

    if (isUniqueGlobal) {
      data.unique_total = normalizeCount(data.unique_total) + 1;
    }

    if (!data.unique_daily) data.unique_daily = {};
    if (isUniqueForDay) {
      data.unique_daily[today] = normalizeCount(data.unique_daily[today]) + 1;
    }

    if (!data.unique_monthly) data.unique_monthly = {};
    if (isUniqueForDay) {
      data.unique_monthly[month] = normalizeCount(data.unique_monthly[month]) + 1;
    }

    if (!data.unique_hourly) data.unique_hourly = {};
    if (!data.unique_hourly[today]) data.unique_hourly[today] = {};
    if (isUniqueForDay) {
      data.unique_hourly[today][hour] = normalizeCount(data.unique_hourly[today][hour]) + 1;
    }

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
        data.count = normalizeCount(data.count) + 1;
        data.label = label;
        data.href = href;
        data.page = pagePath;
        data.last_clicked = new Date().toISOString();
        return data;
      }).catch(() => {});

      const pageRef = db.ref(`click_stats/pages/${pageKey}`);
      pageRef.transaction((data) => {
        if (!data) {
          data = { count: 0, path: pagePath, last_clicked: null };
        }
        data.count = normalizeCount(data.count) + 1;
        data.path = pagePath;
        data.last_clicked = new Date().toISOString();
        return data;
      }).catch(() => {});

      const today = getLocalDateKey(new Date());
      const dailyTargetRef = db.ref(`click_stats/daily/${today}/targets/${targetKey}`);
      dailyTargetRef.transaction((data) => {
        if (!data) {
          data = { count: 0, label, href };
        }
        data.count = normalizeCount(data.count) + 1;
        data.label = label;
        data.href = href;
        return data;
      }).catch(() => {});

      const visitorClickRef = db.ref(`click_stats/visitors/${today}/${visitorHash}`);
      visitorClickRef.transaction((data) => {
        if (!data) {
          data = { total_clicks: 0 };
        }
        data.total_clicks = normalizeCount(data.total_clicks) + 1;
        return data;
      }).catch(() => {});

      // Fallback compatível com regras atuais
      const siteStatsTargetRef = db.ref(`site_stats/click_targets/${targetKey}`);
      siteStatsTargetRef.transaction((data) => {
        if (!data) {
          data = { count: 0, label, href, page: pagePath, last_clicked: null };
        }
        data.count = normalizeCount(data.count) + 1;
        data.label = label;
        data.href = href;
        data.page = pagePath;
        data.last_clicked = new Date().toISOString();
        return data;
      }).catch((error) => {
        console.error('❌ Erro fallback click_targets em site_stats:', error);
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

let deferredFirebaseWorkStarted = false;

function scheduleDeferredFirebaseWork(callback) {
  const runCallback = () => {
    window.setTimeout(callback, 0);
  };

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(runCallback, { timeout: 2000 });
    return;
  }

  if (document.readyState === 'complete') {
    runCallback();
    return;
  }

  window.addEventListener('load', runCallback, { once: true });
}

let trustBoxPlacementQueued = false;

function isArticleLikePage() {
  const path = (window.location.pathname || '').toLowerCase();
  return path.includes('/artigos/') || path.endsWith('/artigos.html') || path.endsWith('/noticias.html');
}

function placeEditorialTrustBoxAtPageEnd() {
  if (!isArticleLikePage()) {
    return false;
  }

  const main = document.querySelector('main');
  if (!main) {
    return false;
  }

  const trustBox = main.querySelector('.article-trust-box');
  if (!trustBox) {
    return false;
  }

  const commentsSection = document.getElementById('comentariosSection');
  let mount = document.getElementById('articleTrustBoxMount');

  if (!mount) {
    mount = document.createElement('div');
    mount.id = 'articleTrustBoxMount';
  }

  if (mount.parentElement !== main) {
    if (commentsSection && commentsSection.parentElement === main) {
      main.insertBefore(mount, commentsSection.nextSibling);
    } else {
      main.appendChild(mount);
    }
  } else if (commentsSection && mount.previousElementSibling !== commentsSection) {
    main.insertBefore(mount, commentsSection.nextSibling);
  } else if (!commentsSection && main.lastElementChild !== mount) {
    main.appendChild(mount);
  }

  if (trustBox.parentElement === mount && mount.firstElementChild === trustBox && mount.childElementCount === 1) {
    return true;
  }

  mount.replaceChildren(trustBox);
  return true;
}

function queueEditorialTrustBoxPlacement() {
  if (trustBoxPlacementQueued) {
    return;
  }

  trustBoxPlacementQueued = true;
  window.requestAnimationFrame(() => {
    trustBoxPlacementQueued = false;
    placeEditorialTrustBoxAtPageEnd();
  });
}

function setupEditorialTrustBoxPlacement() {
  if (!isArticleLikePage()) {
    return;
  }

  const startObserver = () => {
    const main = document.querySelector('main');
    if (!main) {
      return;
    }

    const observer = new MutationObserver(() => {
      queueEditorialTrustBoxPlacement();
    });

    observer.observe(main, { childList: true, subtree: true });
    queueEditorialTrustBoxPlacement();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserver, { once: true });
  } else {
    startObserver();
  }

  window.addEventListener('hashchange', queueEditorialTrustBoxPlacement);
  window.addEventListener('popstate', queueEditorialTrustBoxPlacement);
}

function initializeDeferredFirebaseWork() {
  if (deferredFirebaseWorkStarted) {
    return;
  }

  deferredFirebaseWorkStarted = true;

  try {
    if (shouldSkipAnalyticsTracking()) {
      console.log('ℹ️ Tracking de analytics desativado para este navegador/dispositivo');
      return;
    }

    const db = firebase.database();
    getVisitorFingerprint()
      .then((visitorHash) => {
        const shouldCountSessionVisit = shouldRegisterVisitForSession();
        registerVisitMetrics(db, visitorHash, shouldCountSessionVisit)
          .then(() => {
            if (shouldCountSessionVisit) {
              console.log('✓ Métricas de visita registadas (entrada na sessão)');
            } else {
              console.log('ℹ️ Navegação interna: sessão não recontada, página registada');
            }
          })
          .catch((error) => {
            if (isFirebasePermissionDenied(error)) {
              console.info('ℹ️ Métricas de visita indisponíveis neste ambiente Firebase');
              return;
            }

            console.error('❌ Erro ao registar métricas de visita:', error);
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
    }).catch((error) => {
      if (!isFirebasePermissionDenied(error)) {
        console.error('❌ Erro ao registar utilizador ativo:', error);
      }
    });
    activeUserRef.onDisconnect().remove().catch(() => {});
    window.addEventListener('beforeunload', () => {
      activeUserRef.remove().catch(() => {});
    });

    const sessionKey = 'vc_active_session_id';
    let sessionId = sessionStorage.getItem(sessionKey);
    if (!sessionId) {
      sessionId = 'sess_' + Math.random().toString(36).substr(2, 9);
      sessionStorage.setItem(sessionKey, sessionId);
    }

    const historyEntryId = sessionId + '_' + Date.now();
    db.ref('active_users_history/' + historyEntryId).set({
      sessionId,
      page: window.location.pathname,
      timestamp: firebase.database.ServerValue.TIMESTAMP
    }).catch((err) => {
      if (!isFirebasePermissionDenied(err)) {
        console.error('❌ Erro no histórico de visitas:', err);
      }
    });

    console.log('✓ Analytics configurado');
  } catch (analyticsError) {
    console.error('❌ Erro no analytics:', analyticsError);
  }
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
      scheduleDeferredFirebaseWork(initializeDeferredFirebaseWork);
    } catch (error) {
      console.error('Erro ao inicializar Firebase:', error);
    }
  }).catch((error) => {
    console.error('Erro ao inicializar Firebase:', error);
  });
}

// Iniciar processo de inicialização
initializeFirebaseApp();
setupEditorialTrustBoxPlacement();

window.ensureFirebaseInitialized = ensureFirebaseInitialized;
window.isFirebasePermissionDenied = isFirebasePermissionDenied;
