(function () {
  const TARGET_PATHS = {
    'featured': 'videos/featured',
    'viciado-comenta': 'videos/viciado-comenta',
    'viciado-ponto-critico': 'videos/viciado-ponto-critico',
    'metin2': 'videos/metin2',
    'content-links': 'content-links/main'
  };

  const DEFAULT_CONTENT_LINKS = {
    'viciado-comenta': {
      playlistUrl: 'https://www.youtube.com/playlist?list=PL6kuAId83nkJllMUGSCHki6Z8B18cydqD'
    },
    'viciado-ponto-critico': {
      playlistUrl: 'https://www.youtube.com/playlist?list=PL6kuAId83nkJ8jH6G8CK46lzu_oGDi9nf'
    },
    'metin2': {
      serieRl2PlaylistUrl: 'https://www.youtube.com/playlist?list=PL6kuAId83nkL--AvGu2iN7tX6r9bjyXI2',
      analisePlaylistUrl: 'https://www.youtube.com/playlist?list=PL6kuAId83nkIN_BBOgyyPCH4W8tO2hAoK'
    },
    'livestreams': {
      primaryUrl: 'https://www.twitch.tv/theviciado13'
    }
  };

  function cloneDefaultContentLinks() {
    return JSON.parse(JSON.stringify(DEFAULT_CONTENT_LINKS));
  }

  function getTargetPath(target) {
    const path = TARGET_PATHS[String(target || '').trim()];
    if (!path) {
      throw new Error('Destino de videos invalido.');
    }
    return path;
  }

  async function ensureFirebaseReady() {
    if (typeof window.ensureFirebaseInitialized === 'function') {
      await window.ensureFirebaseInitialized();
      return true;
    }

    if (typeof firebase === 'undefined') {
      throw new Error('Firebase SDK nao carregado.');
    }

    if (!firebase.apps || !firebase.apps.length) {
      if (typeof firebaseConfig === 'undefined') {
        throw new Error('Configuracao Firebase indisponivel.');
      }
      firebase.initializeApp(firebaseConfig);
    }

    window.firebaseInitialized = true;

    // If the tool is running inside an iframe from the same origin, prefer parent's Firebase
    try {
      const parentWin = window.parent && window.parent !== window ? window.parent : null;
      if (parentWin) {
        try {
          if (parentWin.firebase) {
            window._vcRemoteFirebase = parentWin.firebase;
            // Prefer adminPanel named app in parent when present
            const parentApps = Array.isArray(parentWin.firebase.apps) ? parentWin.firebase.apps : [];
            const parentAdminApp = parentApps.find((a) => a && a.name === 'adminPanel');
            window._vcFirebaseApp = parentWin._vcFirebaseApp || parentAdminApp || (parentApps.length ? parentApps[0] : null) || null;
            window._vcUsingParent = true;
            return true;
          }
        } catch (e) {
          // cross-origin or no access
        }
      }

      // Prefer a named admin app in the current window when available.
      if (Array.isArray(firebase.apps) && firebase.apps.length) {
        const adminApp = (firebase.apps || []).find((a) => a && a.name === 'adminPanel');
        window._vcFirebaseApp = adminApp || (firebase.apps.length ? firebase.apps[0] : null) || null;
      } else if (typeof firebase.app === 'function') {
        window._vcFirebaseApp = firebase.app();
      }
      window._vcUsingParent = false;
    } catch (_) {
      window._vcFirebaseApp = null;
      window._vcUsingParent = false;
    }
    return true;
  }

  async function waitForAuthUser(timeoutMs = 5000) {
    // Prefer remote (parent) firebase auth when available
    const remote = window._vcRemoteFirebase || null;
    const localFirebase = (typeof firebase !== 'undefined') ? firebase : null;

    const authFromRemote = remote && typeof remote.auth === 'function' ? remote.auth() : null;
    const authFromLocal = localFirebase && typeof localFirebase.auth === 'function' ? localFirebase.auth() : null;

    const checkAuth = (auth) => {
      if (!auth) return null;
      if (auth.currentUser) return auth.currentUser;
      return null;
    };

    const immediate = checkAuth(authFromRemote) || checkAuth(authFromLocal);
    if (immediate) return immediate;

    if (typeof window.waitForFirebaseAuthUser === 'function') {
      try {
        const res = await window.waitForFirebaseAuthUser(timeoutMs);
        if (res) return res;
      } catch (_) {}
    }

    return new Promise((resolve) => {
      let resolved = false;
      const finish = (user) => {
        if (resolved) return;
        resolved = true;
        try { if (timer) window.clearTimeout(timer); } catch(_) {}
        try { if (unsubLocal) unsubLocal(); } catch(_) {}
        try { if (unsubRemote) unsubRemote(); } catch(_) {}
        resolve(user || null);
      };

      let unsubLocal = null;
      let unsubRemote = null;

      try {
        if (authFromRemote && typeof authFromRemote.onAuthStateChanged === 'function') {
          unsubRemote = authFromRemote.onAuthStateChanged((user) => finish(user || null), () => finish(null));
        }
      } catch (_) {}

      try {
        if (authFromLocal && typeof authFromLocal.onAuthStateChanged === 'function') {
          unsubLocal = authFromLocal.onAuthStateChanged((user) => finish(user || null), () => finish(null));
        }
      } catch (_) {}

      const timer = window.setTimeout(() => finish((authFromRemote && authFromRemote.currentUser) || (authFromLocal && authFromLocal.currentUser) || null), timeoutMs);
    });
  }

  function normalizeArrayLike(value) {
    if (Array.isArray(value)) {
      return value;
    }

    if (value && typeof value === 'object') {
      const keys = Object.keys(value);
      if (keys.length && keys.every((key) => /^\d+$/.test(key))) {
        return keys
          .sort((a, b) => Number(a) - Number(b))
          .map((key) => value[key]);
      }
    }

    return value;
  }

  function normalizeByTarget(target, raw) {
    if (target === 'featured') {
      const featured = (raw && typeof raw === 'object') ? raw : {};
      return {
        url: String(featured.url || '').trim(),
        titulo: String(featured.titulo || '').trim(),
        descricao: String(featured.descricao || '').trim(),
        cta: String(featured.cta || 'Ver no YouTube').trim() || 'Ver no YouTube'
      };
    }

    if (target === 'content-links') {
      const source = (raw && typeof raw === 'object') ? raw : {};
      const normalized = cloneDefaultContentLinks();

      normalized['viciado-comenta'].playlistUrl = String(
        source['viciado-comenta'] && source['viciado-comenta'].playlistUrl
          ? source['viciado-comenta'].playlistUrl
          : normalized['viciado-comenta'].playlistUrl
      ).trim();

      normalized['viciado-ponto-critico'].playlistUrl = String(
        source['viciado-ponto-critico'] && source['viciado-ponto-critico'].playlistUrl
          ? source['viciado-ponto-critico'].playlistUrl
          : normalized['viciado-ponto-critico'].playlistUrl
      ).trim();

      normalized['metin2'].serieRl2PlaylistUrl = String(
        source.metin2 && source.metin2.serieRl2PlaylistUrl
          ? source.metin2.serieRl2PlaylistUrl
          : normalized.metin2.serieRl2PlaylistUrl
      ).trim();

      normalized['metin2'].analisePlaylistUrl = String(
        source.metin2 && source.metin2.analisePlaylistUrl
          ? source.metin2.analisePlaylistUrl
          : normalized.metin2.analisePlaylistUrl
      ).trim();

      normalized.livestreams.primaryUrl = String(
        source.livestreams && source.livestreams.primaryUrl
          ? source.livestreams.primaryUrl
          : normalized.livestreams.primaryUrl
      ).trim();

      return normalized;
    }

    if (target === 'metin2') {
      const source = (raw && typeof raw === 'object') ? raw : {};
      const normalized = {};

      Object.keys(source).forEach((serie) => {
        const values = normalizeArrayLike(source[serie]);
        normalized[serie] = Array.isArray(values)
          ? values.map((item) => String(item || '').trim()).filter(Boolean)
          : [];
      });

      if (!Object.keys(normalized).length) {
        normalized.serie_rl2 = [];
      }

      return normalized;
    }

    const value = normalizeArrayLike(raw);
    if (!Array.isArray(value)) {
      return [];
    }

    return value.map((item) => {
      if (typeof item === 'string') {
        return { url: item.trim(), data: '' };
      }

      return {
        url: String((item && item.url) || '').trim(),
        data: String((item && item.data) || '').trim()
      };
    }).filter((item) => item.url);
  }

  async function readTargetFromFirebase(target) {
    await ensureFirebaseReady();
    const remote = window._vcRemoteFirebase || null;
    const app = window._vcFirebaseApp || (remote && remote.apps && remote.apps[0]) || (typeof firebase !== 'undefined' && firebase.apps && firebase.apps[0]) || null;
    const db = remote ? (remote.database ? remote.database() : null) : (app && typeof app.database === 'function' ? app.database() : (typeof firebase !== 'undefined' && firebase.database ? firebase.database() : null));
    if (!db) throw new Error('Firebase Realtime Database indisponível.');
    try {
      const used = remote ? 'parent.firebase' : (app && app.name ? `app:${app.name}` : 'default-firebase');
      const auth = remote ? (remote.auth ? remote.auth() : null) : (app && typeof app.auth === 'function' ? app.auth() : (typeof firebase !== 'undefined' && firebase.auth ? firebase.auth() : null));
      const email = auth && auth.currentUser ? (auth.currentUser.email || '(sem-email)') : '(sem-sessao)';
      console.info('[VCVideoData] readTargetFromFirebase using:', used, 'currentUser:', email, 'target:', target);
    } catch (e) {}
    const snapshot = await db.ref(getTargetPath(target)).once('value');
    if (!snapshot.exists()) {
      return { exists: false, data: normalizeByTarget(target, null) };
    }
    return { exists: true, data: normalizeByTarget(target, snapshot.val()) };
  }

  async function readTargetFromFallback(target, fallbackUrl) {
    if (!fallbackUrl) {
      return normalizeByTarget(target, null);
    }

    const response = await fetch(fallbackUrl, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Falha ao carregar fallback ${fallbackUrl} (${response.status}).`);
    }

    return normalizeByTarget(target, await response.json());
  }

  async function loadTarget(target, options) {
    const fallbackUrl = options && options.fallbackUrl ? options.fallbackUrl : '';
    let lastError = null;

    try {
      const firebaseResult = await readTargetFromFirebase(target);
      if (firebaseResult.exists) {
        return firebaseResult.data;
      }
    } catch (error) {
      lastError = error;
      console.warn('Leitura de videos via Firebase falhou, a usar fallback.', error);
    }

    if (fallbackUrl) {
      return readTargetFromFallback(target, fallbackUrl);
    }

    if (lastError) {
      throw lastError;
    }

    return normalizeByTarget(target, null);
  }

  async function saveTarget(target, data) {
    await ensureFirebaseReady();
    const remote = window._vcRemoteFirebase || null;
    const app = window._vcFirebaseApp || (remote && remote.apps && remote.apps[0]) || (typeof firebase !== 'undefined' && firebase.apps && firebase.apps[0]) || null;
    const auth = remote ? (remote.auth ? remote.auth() : null) : (app && typeof app.auth === 'function' ? app.auth() : (typeof firebase !== 'undefined' && firebase.auth ? firebase.auth() : null));
    const user = auth && auth.currentUser ? auth.currentUser : await waitForAuthUser(5000);
    // Diagnostic log
    try {
      const used = remote ? 'parent.firebase' : (app && app.name ? `app:${app.name}` : 'default-firebase');
      const email = user ? (user.email || '(sem-email)') : '(sem-sessao)';
      console.info('[VCVideoData] saveTarget using:', used, 'currentUser:', email, 'target:', target);
    } catch (e) {}
    if (!user) {
      // Fallback: prompt for admin credentials so tools can sign in when opened standalone.
      try {
        if (typeof window.confirm === 'function' && !window.confirm('Sessão admin não detectada. Pretende iniciar sessão agora?')) {
          throw new Error('Inicie sessao no painel admin para guardar videos.');
        }

        const email = typeof window.prompt === 'function' ? window.prompt('Email (admin):') : null;
        const password = typeof window.prompt === 'function' ? window.prompt('Password:') : null;
        if (!email || !password) throw new Error('Credenciais não fornecidas.');

        if (!auth || typeof auth.signInWithEmailAndPassword !== 'function') {
          throw new Error('Autenticação indisponível para signInWithEmailAndPassword. Abra o painel admin e inicie sessão.');
        }

        console.info('[VCVideoData] attempting signInWithEmailAndPassword for', email);
        const credential = await auth.signInWithEmailAndPassword(email, password);
        const newUser = (credential && credential.user) ? credential.user : auth.currentUser;
        if (!newUser) throw new Error('Falha ao iniciar sessão com as credenciais fornecidas.');
        // update local user variable
        user = newUser;
        console.info('[VCVideoData] sign-in successful, user:', user.email || '(sem-email)');
      } catch (e) {
        console.warn('[VCVideoData] fallback sign-in failed:', e && e.message ? e.message : e);
        throw e;
      }
    }

    const db = remote ? (remote.database ? remote.database() : null) : (app && typeof app.database === 'function' ? app.database() : (firebase.database ? firebase.database() : null));
    if (!db) throw new Error('Firebase Realtime Database indisponível.');

    await db.ref(getTargetPath(target)).set(normalizeByTarget(target, data));
    return true;
  }

  // Helper para inspeção no console: `VCVideoData.debugContext()`
  function debugContext() {
    const remote = window._vcRemoteFirebase || null;
    const app = window._vcFirebaseApp || (remote && remote.apps && remote.apps[0]) || (typeof firebase !== 'undefined' && firebase.apps && firebase.apps[0]) || null;
    const auth = remote ? (remote.auth ? remote.auth() : null) : (app && typeof app.auth === 'function' ? app.auth() : (typeof firebase !== 'undefined' && firebase.auth ? firebase.auth() : null));
    return {
      usingParentFirebase: !!remote,
      appName: app && app.name ? app.name : null,
      hasAuth: !!auth,
      currentUser: auth && auth.currentUser ? { uid: auth.currentUser.uid, email: auth.currentUser.email || null } : null
    };
  }

  window.VCVideoData = {
    DEFAULT_CONTENT_LINKS,
    ensureFirebaseReady,
    normalizeByTarget,
    loadTarget,
    saveTarget,
    debugContext
  };
})();