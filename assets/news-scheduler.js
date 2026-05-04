// ========== SISTEMA DE AGENDAMENTO DE NOTÍCIAS ==========

/**
 * Filtra notícias baseado na data de publicação agendada
 * @param {Array} noticias - Array de notícias
 * @returns {Array} - Notícias que já podem ser publicadas
 */
function filtrarNoticiasPublicadas(noticias) {
  if (!noticias || !Array.isArray(noticias)) return [];
  
  const agora = new Date();
  
  return noticias.filter(noticia => {
    if (!noticia || typeof noticia !== 'object') return false;

    // Se não tem dataPublicacao definida, mostra imediatamente
    if (!noticia.dataPublicacao) return true;
    
    // Converte a dataPublicacao (formato: "DD/MM/YYYY HH:MM") para Date
    const dataPublicacao = parseDataPublicacao(noticia.dataPublicacao);
    
    // Se a data for inválida, mostra a notícia (fallback seguro)
    if (!dataPublicacao) return true;
    
    // Mostra apenas se a data de publicação já passou
    return dataPublicacao <= agora;
  });
}

function sanitizeNoticiasList(noticias) {
  if (!Array.isArray(noticias)) return [];

  return noticias.filter((noticia) => noticia && typeof noticia === 'object');
}

function normalizarSlug(valor) {
  if (!valor || typeof valor !== 'string') return '';

  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function getArticleSlug(noticia) {
  if (!noticia || typeof noticia !== 'object') return '';

  if (typeof noticia.slug === 'string' && noticia.slug.trim()) {
    return normalizarSlug(noticia.slug.trim());
  }

  return normalizarSlug(noticia.titulo || '');
}

function obterNoticiaSolicitadaDaURL(noticias) {
  if (!Array.isArray(noticias) || typeof window === 'undefined') return null;

  const pathname = window.location && typeof window.location.pathname === 'string'
    ? window.location.pathname
    : '';

  if (!/\/artigos\/[^/]+\.html$/i.test(pathname)) {
    return null;
  }

  const searchParams = new URLSearchParams(window.location.search || '');
  const id = searchParams.get('id');
  const slug = normalizarSlug(searchParams.get('slug') || '');

  if (!id && !slug) {
    return null;
  }

  return noticias.find((noticia) => {
    const idMatch = id && String(noticia.id) === String(id);
    const slugMatch = slug && getArticleSlug(noticia) === slug;
    return idMatch || slugMatch;
  }) || null;
}

/**
 * Converte string de data para objeto Date
 * Formatos aceites: "DD/MM/YYYY HH:MM" ou "DD/MM/YYYY"
 * @param {string} dataStr - String da data
 * @returns {Date|null} - Objeto Date ou null se inválido
 */
function parseDataPublicacao(dataStr) {
  if (!dataStr || typeof dataStr !== 'string') return null;
  
  try {
    // Formato: "DD/MM/YYYY HH:MM" ou "DD/MM/YYYY"
    const partes = dataStr.trim().split(' ');
    const data = partes[0].split('/');
    const hora = partes[1] ? partes[1].split(':') : ['00', '00'];
    
    if (data.length !== 3) return null;
    
    const dia = parseInt(data[0], 10);
    const mes = parseInt(data[1], 10) - 1; // Mês começa em 0
    const ano = parseInt(data[2], 10);
    const horas = parseInt(hora[0], 10) || 0;
    const minutos = parseInt(hora[1], 10) || 0;
    
    const dateObj = new Date(ano, mes, dia, horas, minutos);
    
    // Verifica se a data é válida
    if (isNaN(dateObj.getTime())) return null;
    
    return dateObj;
  } catch (e) {
    console.error('Erro ao parsear data:', dataStr, e);
    return null;
  }
}

/**
 * Ordena notícias por data de publicação (mais recente primeiro)
 * @param {Array} noticias - Array de notícias
 * @returns {Array} - Notícias ordenadas
 */
function ordenarNoticiasPorData(noticias) {
  return noticias.sort((a, b) => {
    const dataA = parseDataPublicacao(a.dataPublicacao || a.data);
    const dataB = parseDataPublicacao(b.dataPublicacao || b.data);
    
    if (!dataA && !dataB) return 0;
    if (!dataA) return 1;
    if (!dataB) return -1;
    
    return dataB - dataA; // Mais recente primeiro
  });
}

function deduplicarNoticias(noticias) {
  if (!Array.isArray(noticias)) return [];

  const vistos = new Set();
  const resultado = [];

  for (const noticia of noticias) {
    if (!noticia || typeof noticia !== 'object') continue;

    const slug = getArticleSlug(noticia);
    const id = String(noticia.id || '').trim();
    const titulo = String(noticia.titulo || '').trim().toLowerCase();
    const data = String(noticia.data || '').trim();

    const chave = id
      ? `id:${id}`
      : (slug
        ? `slug:${slug}`
        : `title:${titulo}|date:${data}`);

    if (vistos.has(chave)) continue;
    vistos.add(chave);
    resultado.push(noticia);
  }

  return resultado;
}

const NEWS_CACHE_KEY = 'vc_noticias_cache_v1';
const NEWS_CACHE_TTL_MS = 5 * 60 * 1000;

function readNoticiasCache() {
  try {
    const rawValue = localStorage.getItem(NEWS_CACHE_KEY);
    if (!rawValue) return null;

    const parsed = JSON.parse(rawValue);
    const isFresh = parsed && Number.isFinite(parsed.timestamp) && (Date.now() - parsed.timestamp) < NEWS_CACHE_TTL_MS;
    const noticias = parsed && Array.isArray(parsed.noticias) ? parsed.noticias : null;

    if (!isFresh || !noticias) {
      localStorage.removeItem(NEWS_CACHE_KEY);
      return null;
    }

    return { noticias };
  } catch (error) {
    return null;
  }
}

function writeNoticiasCache(noticias) {
  if (!Array.isArray(noticias)) return;

  try {
    localStorage.setItem(NEWS_CACHE_KEY, JSON.stringify({
      timestamp: Date.now(),
      noticias
    }));
  } catch (error) {
    // ignore cache write errors
  }
}

function normalizeNoticiasResponse(data) {
  const noticias = sanitizeNoticiasList(Array.isArray(data && data.noticias) ? data.noticias : []);
  const noticiaSolicitada = obterNoticiaSolicitadaDaURL(noticias);
  const publicadas = ordenarNoticiasPorData(deduplicarNoticias(filtrarNoticiasPublicadas(noticias)));

  if (noticiaSolicitada && !publicadas.some((noticia) => noticia && String(noticia.id) === String(noticiaSolicitada.id))) {
    publicadas.unshift(noticiaSolicitada);
  }

  return {
    noticias: ordenarNoticiasPorData(deduplicarNoticias(sanitizeNoticiasList(publicadas)))
  };
}

async function garantirAcessoNoticiasFirebase() {
  if (typeof window.ensureFirebaseInitialized === 'function') {
    await window.ensureFirebaseInitialized();
  }

  if (typeof firebase === 'undefined' || !firebase.database) {
    throw new Error('Firebase indisponível para carregar notícias.');
  }
}

async function lerNoticiasDoFirebase() {
  const snapshot = await firebase.database().ref('noticias').once('value');
  const rawNoticias = snapshot.val();

  return {
    noticias: Array.isArray(rawNoticias)
      ? rawNoticias
      : Object.values(rawNoticias || {})
  };
}

async function lerNoticiasDoJsonLocal() {
  const jsonUrl = new URL('data/noticias.json', `${window.location.origin}/`);
  const response = await fetch(jsonUrl.toString(), {
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`Falha ao carregar noticias.json local (${response.status}).`);
  }

  return response.json();
}

function mergeNoticiasSources(primaryNoticias, secondaryNoticias) {
  return deduplicarNoticias([
    ...sanitizeNoticiasList(primaryNoticias),
    ...sanitizeNoticiasList(secondaryNoticias)
  ]);
}

function isLocalNoticiasPreviewHost() {
  if (typeof window === 'undefined' || !window.location) return false;

  const host = String(window.location.hostname || '').toLowerCase();
  return host === '127.0.0.1' || host === 'localhost';
}

function loadArticleVideoFromContainer(container) {
  if (!container || container.dataset.videoLoaded === 'true') return;

  const videoId = String(container.dataset.videoId || '').trim();
  if (!videoId) return;

  const iframe = document.createElement('iframe');
  iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}?modestbranding=1&rel=0`;
  iframe.title = container.dataset.videoTitle || 'Vídeo do artigo';
  iframe.loading = 'lazy';
  iframe.allowFullscreen = true;
  iframe.referrerPolicy = 'strict-origin-when-cross-origin';
  iframe.setAttribute('frameborder', '0');
  iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');

  container.appendChild(iframe);
  container.dataset.videoLoaded = 'true';
  container.classList.add('is-loaded');
}

function initDelegatedArticleVideoEmbeds() {
  if (typeof document === 'undefined' || document.documentElement.dataset.articleVideoDelegated === 'true') {
    return;
  }

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const container = target.closest('.artigo-video[data-video-id]');
    if (!container) return;

    const matchedTarget = target.closest('[data-video-trigger], .artigo-video-poster, .artigo-video');
    if (!matchedTarget) return;

    event.preventDefault();
    loadArticleVideoFromContainer(container);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;

    const target = event.target;
    if (!(target instanceof Element)) return;

    const trigger = target.closest('[data-video-trigger]');
    if (!trigger) return;

    const container = trigger.closest('.artigo-video[data-video-id]');
    if (!container) return;

    event.preventDefault();
    loadArticleVideoFromContainer(container);
  });

  document.documentElement.dataset.articleVideoDelegated = 'true';
}

/**
 * Wrapper do fetch que aplica filtro de agendamento automaticamente.
 * Junta o JSON estático com o Firebase e dá prioridade ao Firebase para
 * refletir artigos acabados de guardar antes da regeneração estática.
 * @param {string} url - Ignorado (mantido por compatibilidade)
 * @returns {Promise} - Promise com as notícias filtradas e ordenadas
 */
async function fetchNoticiasAgendadas(url) {
  const [localJsonResult, firebaseResult] = await Promise.allSettled([
    lerNoticiasDoJsonLocal(),
    (async () => {
      await garantirAcessoNoticiasFirebase();
      return lerNoticiasDoFirebase();
    })()
  ]);

  const localJsonData = localJsonResult.status === 'fulfilled' ? localJsonResult.value : null;
  const firebaseData = firebaseResult.status === 'fulfilled' ? firebaseResult.value : null;
  const lastError = firebaseResult.status === 'rejected'
    ? firebaseResult.reason
    : (localJsonResult.status === 'rejected' ? localJsonResult.reason : null);

  if (firebaseData || localJsonData) {
    const mergedNoticias = mergeNoticiasSources(
      firebaseData && firebaseData.noticias,
      localJsonData && localJsonData.noticias
    );
    const normalizedMergedData = normalizeNoticiasResponse({ noticias: mergedNoticias });

    if (normalizedMergedData.noticias.length > 0) {
      writeNoticiasCache(mergedNoticias);
    }

    return normalizedMergedData;
  }

  const cachedData = readNoticiasCache();
  if (cachedData) {
    return normalizeNoticiasResponse(cachedData);
  }

  throw lastError || new Error('Nao foi possivel carregar as noticias.');
}

// Exporta para uso global
window.filtrarNoticiasPublicadas = filtrarNoticiasPublicadas;
window.parseDataPublicacao = parseDataPublicacao;
window.ordenarNoticiasPorData = ordenarNoticiasPorData;
window.fetchNoticiasAgendadas = fetchNoticiasAgendadas;
window.loadArticleVideoFromContainer = loadArticleVideoFromContainer;

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDelegatedArticleVideoEmbeds, { once: true });
  } else {
    initDelegatedArticleVideoEmbeds();
  }
}
