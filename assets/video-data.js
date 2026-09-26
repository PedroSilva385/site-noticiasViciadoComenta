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

  function getAppList(fbScope) {
    try {
      return fbScope && Array.isArray(fbScope.apps) ? fbScope.apps : [];
    } catch (_) {
      return [];
    }
  }

  async function ensureFirebaseReady() {
    // 1) Garantir o SDK e a app default inicializados (comportamento original).
    if (typeof window.ensureFirebaseInitialized === 'function') {
      await window.ensureFirebaseInitialized();
    } else {
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
    }

    // 2) Detetar sempre a app 'adminPanel' (mesma sessão do painel admin),
    //    inclusive quando ensureFirebaseInitialized já inicializou a app default.
    window._vcRemoteFirebase = null;
    window._vcFirebaseApp = null;
    window._vcUsingParent = false;

    try {
      const parentWin = window.parent && window.parent !== window ? window.parent : null;
      if (parentWin && parentWin.firebase) {
        window._vcRemoteFirebase = parentWin.firebase;
        window._vcUsingParent = true;
      }
    } catch (_) {
      // cross-origin or no access
    }

    const fbScope = window._vcRemoteFirebase || (typeof firebase !== 'undefined' ? firebase : null);
    window._vcFirebaseApp = getAppList(fbScope).find((a) => a && a.name === 'adminPanel') || null;

    return true;
  }

  async function waitForAuthUser(timeoutMs = 5000, preferredAuth = null) {
    const auths = [];
    if (preferredAuth) auths.push(preferredAuth);

    const remote = window._vcRemoteFirebase || null;
    try { if (remote && typeof remote.auth === 'function') auths.push(remote.auth()); } catch (_) {}
    try { if (typeof firebase !== 'undefined' && typeof firebase.auth === 'function') auths.push(firebase.auth()); } catch (_) {}

    const authWithUser = auths.find((instance) => instance && instance.currentUser);
    if (authWithUser) return authWithUser.currentUser;

    return new Promise((resolve) => {
      let resolved = false;
      let timer = null;
      const unsubscribers = [];

      const finish = (user) => {
        if (resolved) return;
        resolved = true;
        unsubscribers.forEach((unsubscribe) => {
          try { unsubscribe(); } catch (_) {}
        });
        try { window.clearTimeout(timer); } catch (_) {}
        resolve(user || null);
      };

      // Só resolve com um utilizador real; sem sessão resolvemos por timeout.
      auths.forEach((instance) => {
        try {
          if (instance && typeof instance.onAuthStateChanged === 'function') {
            unsubscribers.push(instance.onAuthStateChanged((user) => {
              if (user) finish(user);
            }, () => {}));
          }
        } catch (_) {}
      });

      timer = window.setTimeout(() => finish(null), timeoutMs);
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

  function resolveWriteContext(createAdminApp = true) {
    const remote = window._vcRemoteFirebase || null;
    const localFirebase = (typeof firebase !== 'undefined') ? firebase : null;

    // Preferir a app 'adminPanel' (mesma sessão do painel admin) para a escrita,
    // começando pela janela-mãe quando a ferramenta corre dentro do painel (iframe).
    let app = window._vcFirebaseApp
      || getAppList(remote).find((a) => a && a.name === 'adminPanel')
      || getAppList(localFirebase).find((a) => a && a.name === 'adminPanel')
      || null;

    // Numa aba autónoma ainda não existe a app 'adminPanel';
    // criá-la reutiliza a sessão admin persistida (a persistência é por nome de app).
    if (!app && createAdminApp && localFirebase && typeof localFirebase.initializeApp === 'function' && typeof firebaseConfig !== 'undefined') {
      try {
        app = localFirebase.initializeApp(firebaseConfig, 'adminPanel');
      } catch (_) {
        app = null;
      }
    }

    const fbScope = remote || localFirebase;

    let auth = null;
    let db = null;

    try {
      auth = (app && typeof app.auth === 'function')
        ? app.auth()
        : (fbScope && typeof fbScope.auth === 'function' ? fbScope.auth() : null);
    } catch (_) {
      auth = null;
    }

    try {
      db = (app && typeof app.database === 'function')
        ? app.database()
        : (fbScope && typeof fbScope.database === 'function' ? fbScope.database() : null);
    } catch (_) {
      db = null;
    }

    return { app, auth, db, remote };
  }

  async function saveTarget(target, data) {
    await ensureFirebaseReady();
    const { app, auth, db } = resolveWriteContext();

    if (!db) throw new Error('Firebase Realtime Database indisponível.');

    let user = (auth && auth.currentUser) ? auth.currentUser : null;
    const hasUsableAdminSession = !!(user && !user.isAnonymous);

    if (!hasUsableAdminSession) {
      user = await waitForAuthUser(5000, auth);
    }

    if (!user || user.isAnonymous) {
      // Fallback: pedir credenciais para ferramentas abertas fora do painel admin.
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
        user = (credential && credential.user) ? credential.user : auth.currentUser;
        if (!user) throw new Error('Falha ao iniciar sessão com as credenciais fornecidas.');
        console.info('[VCVideoData] sign-in successful, user:', user.email || '(sem-email)');
      } catch (signInError) {
        console.warn('[VCVideoData] fallback sign-in failed:', signInError && signInError.message ? signInError.message : signInError);
        throw signInError;
      }
    }

    try {
      const used = app && app.name ? `app:${app.name}` : 'default-firebase';
      console.info('[VCVideoData] saveTarget using:', used, 'currentUser:', user.email || (user.isAnonymous ? '(anonimo)' : '(sem-email)'), 'target:', target);
      await db.ref(getTargetPath(target)).set(normalizeByTarget(target, data));
    } catch (error) {
      if (typeof window.isFirebasePermissionDenied === 'function' && window.isFirebasePermissionDenied(error)) {
        throw new Error('Sem permissão para guardar (PERMISSION_DENIED). Confirme que a conta autenticada está na lista /admins do Realtime Database.');
      }
      throw error;
    }

    return true;
  }

  // Helper para inspeção no console: `VCVideoData.debugContext()`
  function debugContext() {
    const { app, auth, remote } = resolveWriteContext(false);
    return {
      usingParentFirebase: !!remote,
      appName: app && app.name ? app.name : null,
      hasAuth: !!auth,
      currentUser: auth && auth.currentUser ? { uid: auth.currentUser.uid, email: auth.currentUser.email || null, isAnonymous: !!auth.currentUser.isAnonymous } : null
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