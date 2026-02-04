// ========== FUNÇÕES DE SEGURANÇA ==========

/**
 * Sanitiza HTML para prevenir XSS
 * Remove tags perigosas e scripts
 */
function sanitizeHTML(str) {
  if (!str) return '';
  
  const temp = document.createElement('div');
  temp.textContent = str;
  return temp.innerHTML;
}

/**
 * Valida e sanitiza nome de utilizador
 * Apenas permite letras, números, espaços e acentos portugueses
 */
function sanitizeName(name) {
  if (!name || typeof name !== 'string') return '';
  
  // Remove caracteres perigosos mas mantém acentos portugueses
  const sanitized = name
    .trim()
    .replace(/[<>\"'`]/g, '') // Remove caracteres HTML perigosos
    .substring(0, 50); // Limite de 50 caracteres
  
  return sanitized;
}

/**
 * Valida e sanitiza texto de comentário
 * Permite quebras de linha mas remove HTML
 */
function sanitizeComment(text) {
  if (!text || typeof text !== 'string') return '';
  
  // Remove HTML mas preserva quebras de linha
  const sanitized = text
    .trim()
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .substring(0, 1000); // Limite de 1000 caracteres
  
  return sanitized;
}

/**
 * Rate limiting simples usando localStorage
 * Previne spam de comentários/likes
 */
function checkRateLimit(action, maxAttempts = 5, windowMs = 60000) {
  const key = `ratelimit_${action}`;
  const now = Date.now();
  
  // Obter tentativas anteriores
  let attempts = JSON.parse(localStorage.getItem(key) || '[]');
  
  // Remover tentativas antigas (fora da janela de tempo)
  attempts = attempts.filter(timestamp => now - timestamp < windowMs);
  
  // Verificar se excedeu o limite
  if (attempts.length >= maxAttempts) {
    const oldestAttempt = Math.min(...attempts);
    const waitTime = Math.ceil((windowMs - (now - oldestAttempt)) / 1000);
    return {
      allowed: false,
      waitTime: waitTime
    };
  }
  
  // Adicionar nova tentativa
  attempts.push(now);
  localStorage.setItem(key, JSON.stringify(attempts));
  
  return {
    allowed: true,
    remaining: maxAttempts - attempts.length
  };
}

/**
 * Valida URL de vídeo do YouTube
 */
function isValidYouTubeURL(url) {
  if (!url || typeof url !== 'string') return false;
  
  const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})$/;
  return youtubeRegex.test(url);
}

/**
 * Valida formato de data DD/MM/YYYY
 */
function isValidDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return false;
  
  const regex = /^\d{2}\/\d{2}\/\d{4}$/;
  if (!regex.test(dateStr)) return false;
  
  const [day, month, year] = dateStr.split('/').map(Number);
  
  if (year < 2000 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  
  return true;
}

/**
 * Sanitiza ID do Firebase para prevenir injeção
 */
function sanitizeFirebaseKey(key) {
  if (!key) return '';
  
  // Firebase não permite: . $ # [ ] /
  return String(key).replace(/[.$#\[\]\/]/g, '_');
}

/**
 * Verifica se string contém código malicioso
 */
function containsMaliciousCode(str) {
  if (!str) return false;
  
  const dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /onerror=/i,
    /onclick=/i,
    /onload=/i,
    /<iframe/i,
    /eval\(/i,
    /document\.cookie/i
  ];
  
  return dangerousPatterns.some(pattern => pattern.test(str));
}

// Exportar funções globalmente
if (typeof window !== 'undefined') {
  window.SecurityUtils = {
    sanitizeHTML,
    sanitizeName,
    sanitizeComment,
    checkRateLimit,
    isValidYouTubeURL,
    isValidDate,
    sanitizeFirebaseKey,
    containsMaliciousCode
  };
}
