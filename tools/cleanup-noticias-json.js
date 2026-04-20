const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const jsonPath = path.join(root, 'data', 'noticias.json');

const imageTargets = [
  {
    id: '27',
    index: 0,
    relativePath: 'assets/imagens/digi-com-novidades-na-rede-movel-hd-voice-hd-plus.jpg',
  },
  {
    id: '29',
    index: 0,
    relativePath: 'assets/imagens/starlink-corta-velocidade-e-dispara-precos-starlink-precos.png',
  },
  {
    id: '29',
    index: 1,
    relativePath: 'assets/imagens/starlink-corta-velocidade-e-dispara-precos-amazon-leo.jpg',
  },
];

function saveEmbeddedImages(rawJson, noticias) {
  let output = rawJson;

  for (const target of imageTargets) {
    const article = noticias.find((item) => String(item && item.id) === target.id);
    if (!article || typeof article.conteudo !== 'string') {
      throw new Error(`Artigo ${target.id} não encontrado.`);
    }

    const matches = [...article.conteudo.matchAll(/<img[^>]+src="([^"]+)"[^>]*>/g)];
    if (!matches[target.index]) {
      throw new Error(`Imagem ${target.index} não encontrada no artigo ${target.id}.`);
    }

    const source = matches[target.index][1];
    const dataMatch = source.match(/^data:image\/[^;]+;base64,(.+)$/);
    if (!dataMatch) {
      continue;
    }

    const targetPath = path.join(root, ...target.relativePath.split('/'));
    fs.writeFileSync(targetPath, Buffer.from(dataMatch[1], 'base64'));
    output = output.replace(source, target.relativePath);
  }

  return output;
}

function replaceLegacyArticleLinks(rawJson) {
  return rawJson.replace(
    /https:\/\/www\.viciadocomenta\.pt\/artigos\.html#\/([^/]+)\/(\d+)/g,
    (_, slug, id) => `https://www.viciadocomenta.pt/noticias.html?id=${id}&slug=${slug}`,
  );
}

const rawJson = fs.readFileSync(jsonPath, 'utf8');
const parsed = JSON.parse(rawJson);
const noticias = Array.isArray(parsed.noticias) ? parsed.noticias : [];

let updated = saveEmbeddedImages(rawJson, noticias);
updated = replaceLegacyArticleLinks(updated);

fs.writeFileSync(jsonPath, updated, 'utf8');

console.log('noticias.json limpo com sucesso.');