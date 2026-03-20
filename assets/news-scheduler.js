// ========== SISTEMA DE AGENDAMENTO DE NOTÍCIAS ==========

/**
 * Filtra notícias baseado na data de publicação agendada
 * @param {Array} noticias - Array de notícias do JSON
 * @returns {Array} - Notícias que já podem ser publicadas
 */
function filtrarNoticiasPublicadas(noticias) {
  if (!noticias || !Array.isArray(noticias)) return [];
  
  const agora = new Date();
  
  return noticias.filter(noticia => {
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

/**
 * Tenta carregar notícias do Firebase Realtime Database.
 * Retorna null se Firebase não estiver disponível ou sem dados.
 */
async function fetchNoticiasDoFirebase() {
  try {
    if (typeof firebase === 'undefined' || !firebase.apps || firebase.apps.length === 0) return null;
    const db = firebase.database();
    if (!db) return null;

    const snapshot = await db.ref('noticias').once('value');
    const val = snapshot.val();
    if (!val) return null;

    const noticias = Array.isArray(val) ? val : Object.values(val);
    if (!noticias || noticias.length === 0) return null;

    return { noticias };
  } catch (e) {
    return null;
  }
}

/**
 * Aplica filtros de agendamento ao objeto de dados e devolve-o pronto.
 */
function aplicarFiltros(data) {
  if (data.noticias && Array.isArray(data.noticias)) {
    const noticiaSolicitada = obterNoticiaSolicitadaDaURL(data.noticias);
    data.noticias = filtrarNoticiasPublicadas(data.noticias);

    if (noticiaSolicitada && !data.noticias.some((n) => String(n.id) === String(noticiaSolicitada.id))) {
      data.noticias.unshift(noticiaSolicitada);
    }

    data.noticias = ordenarNoticiasPorData(data.noticias);
  }
  return data;
}

/**
 * Wrapper do fetch que aplica filtro de agendamento automaticamente.
 * Tenta Firebase primeiro; se falhar usa o JSON local como fallback.
 * @param {string} url - URL do JSON de notícias (fallback)
 * @returns {Promise} - Promise com as notícias filtradas
 */
async function fetchNoticiasAgendadas(url) {
  // 1. Tentar Firebase
  const dadosFirebase = await fetchNoticiasDoFirebase();
  if (dadosFirebase) {
    return aplicarFiltros(dadosFirebase);
  }

  // 2. Fallback: JSON local
  const cacheBust = `_ts=${Date.now()}`;
  const separator = url.includes('?') ? '&' : '?';
  const requestUrl = `${url}${separator}${cacheBust}`;

  const response = await fetch(requestUrl, { cache: 'no-store' });
  if (!response.ok) throw new Error('Erro ao carregar notícias');

  const data = await response.json();
  return aplicarFiltros(data);
}

// Exporta para uso global
window.filtrarNoticiasPublicadas = filtrarNoticiasPublicadas;
window.parseDataPublicacao = parseDataPublicacao;
window.ordenarNoticiasPorData = ordenarNoticiasPorData;
window.fetchNoticiasAgendadas = fetchNoticiasAgendadas;
