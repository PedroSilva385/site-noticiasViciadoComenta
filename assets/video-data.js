(function () {
  const TARGET_PATHS = {
    'featured': 'videos/featured',
    'viciado-comenta': 'videos/viciado-comenta',
    'viciado-ponto-critico': 'videos/viciado-ponto-critico',
    'metin2': 'videos/metin2'
  };

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
    return true;
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
    const snapshot = await firebase.database().ref(getTargetPath(target)).once('value');
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

    if (typeof firebase.auth === 'function' && !firebase.auth().currentUser) {
      throw new Error('Inicie sessao no painel admin para guardar videos.');
    }

    await firebase.database().ref(getTargetPath(target)).set(normalizeByTarget(target, data));
    return true;
  }

  window.VCVideoData = {
    ensureFirebaseReady,
    normalizeByTarget,
    loadTarget,
    saveTarget
  };
})();