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
 * Wrapper do fetch que aplica filtro de agendamento automaticamente
 * @param {string} url - URL do JSON de notícias
 * @returns {Promise} - Promise com as notícias filtradas
 */
async function fetchNoticiasAgendadas(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Erro ao carregar notícias');
  
  const data = await response.json();
  
  if (data.noticias && Array.isArray(data.noticias)) {
    data.noticias = filtrarNoticiasPublicadas(data.noticias);
    data.noticias = ordenarNoticiasPorData(data.noticias);
  }
  
  return data;
}

// Exporta para uso global
window.filtrarNoticiasPublicadas = filtrarNoticiasPublicadas;
window.parseDataPublicacao = parseDataPublicacao;
window.ordenarNoticiasPorData = ordenarNoticiasPorData;
window.fetchNoticiasAgendadas = fetchNoticiasAgendadas;
