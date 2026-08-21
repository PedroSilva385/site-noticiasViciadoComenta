const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { marked } = require('marked');
const TurndownService = require('turndown');
const { gfm } = require('turndown-plugin-gfm');

const root = path.resolve(__dirname, '..');
const contentDir = path.join(root, 'content', 'artigos');
const dataDir = path.join(root, 'data');
const jsonPath = path.join(dataDir, 'noticias.json');
const INSTRUCTIONS = 'Gerado automaticamente a partir de content/artigos/*.md. Edita no painel/admin local ou nos ficheiros Markdown e regenera antes de publicar.';

marked.setOptions({
  gfm: true,
  breaks: false,
  headerIds: false,
  mangle: false,
});

const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '_',
  strongDelimiter: '**',
});

turndownService.use(gfm);
turndownService.keep(['figure', 'figcaption', 'iframe']);

turndownService.addRule('preserveDivsWithImages', {
  filter(node) {
    return node && node.nodeName === 'DIV' && /<(img|figure|iframe)\b/i.test(node.innerHTML || '');
  },
  replacement(content, node) {
    return `\n\n${(node.innerHTML || '').trim()}\n\n`;
  },
});

turndownService.addRule('preserveSpansWithStyles', {
  filter(node) {
    return node && node.nodeName === 'SPAN' && node.getAttribute && node.getAttribute('style');
  },
  replacement(content, node) {
    return `<span style="${String(node.getAttribute('style') || '').replace(/"/g, '&quot;')}">${content}</span>`;
  },
});

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-') || 'artigo';
}

function articleUrl(slug) {
  return `https://www.viciadocomenta.pt/artigos/${slug}.html`;
}

function articleEditableUrl(slug) {
  return `${articleUrl(slug)}?edit=1`;
}

function hasHtml(value) {
  return /<[^>]+>/.test(String(value || ''));
}

function normalizeNewlines(value) {
  return String(value || '').replace(/\r\n/g, '\n').trim();
}

function htmlToMarkdown(value) {
  const source = normalizeNewlines(value);
  if (!source) return '';
  if (!hasHtml(source)) return source;

  return turndownService.turndown(source)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function markdownToHtml(value) {
  const source = normalizeNewlines(value);
  if (!source) return '';
  return String(marked.parse(source)).trim();
}

function parseNumericSort(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function sortArticles(items) {
  return [...items].sort((left, right) => {
    const idDiff = parseNumericSort(left.id) - parseNumericSort(right.id);
    if (idDiff !== 0) return idDiff;
    return String(left.slug || left.titulo || '').localeCompare(String(right.slug || right.titulo || ''), 'pt');
  });
}

function frontmatterFromArticle(article) {
  const ordered = {};
  const preferredKeys = [
    'id',
    'titulo',
    'slug',
    'data',
    'dataPublicacao',
    'dataAtualizacao',
    'categoria',
    'autor',
    'resumo',
    'video'
  ];

  for (const key of preferredKeys) {
    if (article[key] !== undefined && article[key] !== null && String(article[key]).trim() !== '') {
      ordered[key] = article[key];
    }
  }

  for (const [key, value] of Object.entries(article)) {
    if (preferredKeys.includes(key)) continue;
    if (['conteudo', 'conteudoMarkdown', 'link', 'linkEditavel'].includes(key)) continue;
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    ordered[key] = value;
  }

  return ordered;
}

function writeMarkdownArticle(article, targetPath) {
  const markdownBody = normalizeNewlines(article.conteudoMarkdown || htmlToMarkdown(article.conteudo || ''));
  const frontmatter = frontmatterFromArticle(article);
  const fileContent = matter.stringify(markdownBody ? `${markdownBody}\n` : '', frontmatter);
  fs.writeFileSync(targetPath, fileContent, 'utf8');
}

function fileNameForArticle(article, usedNames) {
  const base = slugify(article.slug || article.titulo || article.id || 'artigo');
  let candidate = `${base}.md`;
  let suffix = 2;
  while (usedNames.has(candidate)) {
    candidate = `${base}-${suffix}.md`;
    suffix += 1;
  }
  usedNames.add(candidate);
  return candidate;
}

function articleFromMarkdownFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = matter(raw);
  const data = parsed.data || {};
  const markdownBody = normalizeNewlines(parsed.content || '');
  const slug = slugify(data.slug || data.titulo || path.basename(filePath, path.extname(filePath)));

  return {
    ...data,
    slug,
    titulo: String(data.titulo || data.title || slug).trim(),
    autor: String(data.autor || 'Pedro Silva').trim(),
    categoria: String(data.categoria || '').trim(),
    resumo: String(data.resumo || '').trim(),
    data: String(data.data || '').trim(),
    dataPublicacao: String(data.dataPublicacao || '').trim(),
    video: String(data.video || '').trim(),
    conteudoMarkdown: markdownBody,
    conteudo: markdownToHtml(markdownBody),
    link: articleUrl(slug),
    linkEditavel: articleEditableUrl(slug),
  };
}

function loadPayloadFromMarkdown() {
  ensureDir(contentDir);
  const entries = fs.readdirSync(contentDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
    .map((entry) => articleFromMarkdownFile(path.join(contentDir, entry.name)));

  return {
    _INSTRUCOES: INSTRUCTIONS,
    noticias: sortArticles(entries),
  };
}

function writeJsonPayload(payload) {
  ensureDir(dataDir);
  fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function exportJsonFromMarkdown() {
  const payload = loadPayloadFromMarkdown();
  writeJsonPayload(payload);
  return payload;
}

function savePayloadToMarkdown(payload) {
  ensureDir(contentDir);

  const noticias = Array.isArray(payload && payload.noticias) ? payload.noticias : [];
  const usedNames = new Set();
  const nextFiles = new Set();

  for (const noticia of sortArticles(noticias)) {
    if (!noticia || !String(noticia.titulo || '').trim()) {
      continue;
    }

    const normalized = {
      ...noticia,
      slug: slugify(noticia.slug || noticia.titulo),
    };

    const fileName = fileNameForArticle(normalized, usedNames);
    const targetPath = path.join(contentDir, fileName);
    nextFiles.add(targetPath);
    writeMarkdownArticle(normalized, targetPath);
  }

  const existingFiles = fs.readdirSync(contentDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
    .map((entry) => path.join(contentDir, entry.name));

  for (const filePath of existingFiles) {
    if (!nextFiles.has(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  return exportJsonFromMarkdown();
}

function importJsonToMarkdown() {
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`Ficheiro não encontrado: ${jsonPath}`);
  }

  const raw = fs.readFileSync(jsonPath, 'utf8');
  const payload = JSON.parse(raw);
  return savePayloadToMarkdown(payload);
}

function printPayload(payload) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

function main() {
  const command = process.argv[2] || 'export-json';

  if (command === 'import-json') {
    const payload = importJsonToMarkdown();
    printPayload(payload);
    return;
  }

  if (command === 'export-json') {
    const payload = exportJsonFromMarkdown();
    printPayload(payload);
    return;
  }

  if (command === 'load-json') {
    const payload = loadPayloadFromMarkdown();
    printPayload(payload);
    return;
  }

  if (command === 'save-payload') {
    const payloadPath = process.argv[3];
    if (!payloadPath) {
      throw new Error('Uso: node tools/content-store.js save-payload <payload.json>');
    }
    const payload = JSON.parse(fs.readFileSync(path.resolve(payloadPath), 'utf8'));
    const result = savePayloadToMarkdown(payload);
    printPayload(result);
    return;
  }

  throw new Error(`Comando desconhecido: ${command}`);
}

try {
  main();
} catch (error) {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
}