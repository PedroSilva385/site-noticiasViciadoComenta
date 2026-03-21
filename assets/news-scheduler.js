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

/**
 * Wrapper do fetch que aplica filtro de agendamento automaticamente
 * @param {string} url - Mantido por compatibilidade (ignorado)
 * @returns {Promise} - Promise com as notícias filtradas
 */
async function fetchNoticiasAgendadas(url) {
  await garantirAcessoNoticiasFirebase();
  const data = await lerNoticiasDoFirebase();
  
  if (data.noticias && Array.isArray(data.noticias)) {
    const noticiaSolicitada = obterNoticiaSolicitadaDaURL(data.noticias);
    data.noticias = deduplicarNoticias(filtrarNoticiasPublicadas(data.noticias));

    if (noticiaSolicitada && !data.noticias.some((noticia) => String(noticia.id) === String(noticiaSolicitada.id))) {
      data.noticias.unshift(noticiaSolicitada);
    }

    data.noticias = ordenarNoticiasPorData(deduplicarNoticias(data.noticias));
  }
  
  return data;
}

// Exporta para uso global
window.filtrarNoticiasPublicadas = filtrarNoticiasPublicadas;
window.parseDataPublicacao = parseDataPublicacao;
window.ordenarNoticiasPorData = ordenarNoticiasPorData;
window.fetchNoticiasAgendadas = fetchNoticiasAgendadas;
