(function () {
  function normalizeLinks(raw) {
    if (window.VCVideoData && typeof window.VCVideoData.normalizeByTarget === 'function') {
      return window.VCVideoData.normalizeByTarget('content-links', raw);
    }

    return raw && typeof raw === 'object' ? raw : {};
  }

  async function loadLinks(options) {
    const fallbackUrl = options && options.fallbackUrl ? options.fallbackUrl : 'data/content-links.json';

    if (window.VCVideoData && typeof window.VCVideoData.loadTarget === 'function') {
      return window.VCVideoData.loadTarget('content-links', { fallbackUrl });
    }

    const response = await fetch(fallbackUrl, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Falha ao carregar links de conteúdos.');
    }

    return normalizeLinks(await response.json());
  }

  function applyLinks(mappings) {
    Object.keys(mappings || {}).forEach((elementId) => {
      const href = String(mappings[elementId] || '').trim();
      if (!href) return;

      const element = document.getElementById(elementId);
      if (!element || element.tagName !== 'A') return;
      element.href = href;
    });
  }

  window.VCContentLinks = {
    loadLinks,
    applyLinks,
    normalizeLinks
  };
})();
