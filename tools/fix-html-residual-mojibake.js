const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const includeRoots = [
  root,
  path.join(root, 'artigos'),
];
const excludePrefixes = [
  path.join(root, 'backups'),
  path.join(root, 'tools'),
  path.join(root, 'admin'),
  path.join(root, 'node_modules'),
];

const replacements = [
  ['NAVEGA+�+�O', 'NAVEGAÇÃO'],
  ['NAVEGA��O', 'NAVEGAÇÃO'],
  ["content: '��+'", "content: '▼'"],
  ["content: '?'", "content: '▼'"],
  ['not+�cias', 'notícias'],
  ['not�cias', 'notícias'],
  ['an+�lise', 'análise'],
  ['an�lise', 'análise'],
  ['telecomunica+�+�es', 'telecomunicações'],
  ['telecomunica��es', 'telecomunicações'],
  ['opini+�o', 'opinião'],
  ['opini�o', 'opinião'],
  ['conte+�dos', 'conteúdos'],
  ['conte�dos', 'conteúdos'],
  ['conte+�do', 'conteúdo'],
  ['conte�do', 'conteúdo'],
  ['audi+�ncias', 'audiências'],
  ['audi�ncias', 'audiências'],
  ['experi+�ncia', 'experiência'],
  ['experi�ncia', 'experiência'],
  ['Pol+�tica', 'Política'],
  ['Pol�tica', 'Política'],
  ['In+�cio', 'Início'],
  ['In�cio', 'Início'],
  ['Sobre N+�s', 'Sobre Nós'],
  ['Sobre N�s', 'Sobre Nós'],
  ['Conte+�dos', 'Conteúdos'],
  ['Conte�dos', 'Conteúdos'],
  ['Cr+�tico', 'Crítico'],
  ['Cr�tico', 'Crítico'],
  ['cr+�tica', 'crítica'],
  ['cr�tica', 'crítica'],
  ['Epis+�dios', 'Episódios'],
  ['Epis�dios', 'Episódios'],
  ['V+�deos', 'Vídeos'],
  ['V�deos', 'Vídeos'],
  ['v+�deos', 'vídeos'],
  ['v�deos', 'vídeos'],
  ['v+�deo', 'vídeo'],
  ['v�deo', 'vídeo'],
  ['V+� os', 'Vê os'],
  ['V� os', 'Vê os'],
  ['dispon+�vel', 'disponível'],
  ['dispon�vel', 'disponível'],
  ['n+�o', 'não'],
  ['n�o', 'não'],
  ['p+�gina', 'página'],
  ['p�gina', 'página'],
  ['t+�tulo', 'título'],
  ['t�tulo', 'título'],
  ['+�ltimos', 'Últimos'],
  ['�ltimos', 'Últimos'],
  ['+�ltima', 'Última'],
  ['�ltima', 'Última'],
  ['atualiza+�+�o', 'atualização'],
  ['atualiza��o', 'atualização'],
  ['Fun+�+�o', 'Função'],
  ['Fun��o', 'Função'],
  ['Fun+�+�es', 'Funções'],
  ['Fun��es', 'Funções'],
  ['configura+�+�o', 'configuração'],
  ['configura��o', 'configuração'],
  ['Autentica+�+�o', 'Autenticação'],
  ['Autentica��o', 'Autenticação'],
  ['autentica+�+�o', 'autenticação'],
  ['autentica��o', 'autenticação'],
  ['an+�nima', 'anónima'],
  ['an�nima', 'anónima'],
  ['hiperliga+�+�o', 'hiperligação'],
  ['hiperliga��o', 'hiperligação'],
  ['edi+�+�o', 'edição'],
  ['edi��o', 'edição'],
  ['coment+�rios', 'comentários'],
  ['coment�rios', 'comentários'],
  ['manuten+�+�o', 'manutenção'],
  ['manuten��o', 'manutenção'],
  ['sec+�+�o', 'secção'],
  ['sec��o', 'secção'],
  ['regenera+�+�o', 'regeneração'],
  ['regenera��o', 'regeneração'],
  ['Servi+�o', 'Serviço'],
  ['Servi�o', 'Serviço'],
  ['transmiss+�es', 'transmissões'],
  ['transmiss�es', 'transmissões'],
  ['fam+�lia', 'família'],
  ['fam�lia', 'família'],
  ['re+�ne', 'reúne'],
  ['re�ne', 'reúne'],
  ['+�pico', 'épico'],
  ['�pico', 'épico'],
  ['m+�vel', 'móvel'],
  ['m�vel', 'móvel'],
  ['fideliza+�+�o', 'fidelização'],
  ['fideliza��o', 'fidelização'],
  ['pr+�mio', 'prémio'],
  ['pr�mio', 'prémio'],
  ['s+�o', 'são'],
  ['s�o', 'são'],
  ['est+�', 'está'],
  ['est�', 'está'],
  ['pa+�s', 'país'],
  ['pa�s', 'país'],
  ['regi+�o', 'região'],
  ['regi�o', 'região'],
  ['prefer+�ncias', 'preferências'],
  ['prefer�ncias', 'preferências'],
  ['prote+�+�o', 'proteção'],
  ['prote��o', 'proteção'],
  ['informa+�+�o', 'informação'],
  ['Informa+�+�o', 'Informação'],
  ['informa��o', 'informação'],
  ['Informa��o', 'Informação'],
  ['intera+�+�es', 'interações'],
  ['intera��es', 'interações'],
  ['an+ncio', 'anúncio'],
  ['an+�ncios', 'anúncios'],
  ['an�ncios', 'anúncios'],
  ['p+�ginas', 'páginas'],
  ['p�ginas', 'páginas'],
  ['paix+�o', 'paixão'],
  ['paix�o', 'paixão'],
  ['Transpar+�ncia', 'Transparência'],
  ['Transpar�ncia', 'Transparência'],
  ['Atualiza+�+�es', 'Atualizações'],
  ['Atualiza��es', 'Atualizações'],
  ['+� aqui', 'É aqui'],
  ['� aqui', 'É aqui'],
  ['+� o criador', 'É o criador'],
  ['� o criador', 'É o criador'],
  ['+� mais do que', 'É mais do que'],
  ['� mais do que', 'É mais do que'],
  ['N+�o', 'Não'],
  ['N�o', 'Não'],
  ['poss+�vel', 'possível'],
  ['poss�vel', 'possível'],
  ['seguuran+�a', 'segurança'],
  ['Seguran+�a', 'Segurança'],
  ['seguran+�a', 'segurança'],
  ['Fun+�+�es de Seguran+�a', 'Funções de Segurança'],
  ['SEC+�+�O DE COMENT+�RIOS', 'SECÇÃO DE COMENTÁRIOS'],
  ['OTIMIZA+�+�ES MOBILE - Bot+�es de A+�+�o', 'OTIMIZAÇÕES MOBILE - Botões de Ação'],
  ['FIREBASE CONFIGURA+�+�O', 'FIREBASE CONFIGURAÇÃO'],
  ['Atualiza o JSON para mostrar o vídeo escolhido na homepage.', 'Atualiza o JSON para mostrar o vídeo escolhido na homepage.'],
  ['-� 2026 Viciado Comenta. Todos os direitos reservados.', '© 2026 Viciado Comenta. Todos os direitos reservados.'],
  ['� 2026 Viciado Comenta. Todos os direitos reservados.', '© 2026 Viciado Comenta. Todos os direitos reservados.'],
  ['?? Pesquisar artigos por título, categoria ou conteúdo...', 'Pesquisar artigos por título, categoria ou conteúdo...'],
  ['?? Pesquisar artigos por t�tulo, categoria ou conte�do...', 'Pesquisar artigos por título, categoria ou conteúdo...'],
  ['??? Nenhum artigo encontrado', 'Nenhum artigo encontrado'],
  ['��� Nenhum artigo encontrado', 'Nenhum artigo encontrado'],
  ['Ver mais ���', 'Ver mais'],
  ['Ver mais ???', 'Ver mais'],
  ['ԣ�', '✓'],
  ['��ƥ Guardar edição', 'Guardar edição'],
  ['��ƥ Guardar edi+�+�o', 'Guardar edição'],
  ['��Ƽ Sistema de comentários em manutenção.', 'Sistema de comentários em manutenção.'],
  ['��Ƽ Sistema de coment+�rios em manuten+�+�o.', 'Sistema de comentários em manutenção.'],
  ['���� Hiperligação', 'Hiperligação'],
  ['���� Hiperliga+�+�o', 'Hiperligação'],
  ['���� Aguardando configuração Firebase...', 'Aguardando configuração Firebase...'],
  ['���� Aguardando configura+�+�o Firebase...', 'Aguardando configuração Firebase...'],
  ['V�deo em destaque', 'Vídeo em destaque'],
  ['V+�deo em destaque', 'Vídeo em destaque'],
  ['Título do vídeo', 'Título do vídeo'],
  ['T+�tulo do v+�deo', 'Título do vídeo'],
  ['Verifique o link do vídeo no JSON', 'Verifique o link do vídeo no JSON'],
  ['Verifique o link do v+�deo no JSON', 'Verifique o link do vídeo no JSON'],
  ['Vídeo não disponível', 'Vídeo não disponível'],
  ['V+�deo n+�o disponível', 'Vídeo não disponível'],
  ['V+�deo n+�o dispon+�vel', 'Vídeo não disponível'],
  ['Vídeo não definido', 'Vídeo não definido'],
  ['V+�deo n+�o definido', 'Vídeo não definido'],
  ['Atualiza o link do vídeo em destaque no script.', 'Atualiza o link do vídeo em destaque no script.'],
  ['Atualiza o link do v+�deo em destaque no script.', 'Atualiza o link do vídeo em destaque no script.'],
  ['Sistema de comentários em manutenção.', 'Sistema de comentários em manutenção.'],
];

const regexReplacements = [
  [/\$\{newFooterLinks\}/g, ''],
  [/placeholder="[^"\n]*Pesquisar artigos por t[^"\n]*"/g, 'placeholder="Pesquisar artigos por título, categoria ou conteúdo..."'],
  [/>[?�]{2,}\s*\$\{n\.data\}</g, '>${n.data}<'],
  [/>[?�]{2,}\s*\$\{featured\.data\}</g, '>${featured.data}<'],
  [/>[?�]+\s*\$\{featured\.autor\}</g, '>${featured.autor}<'],
  [/>[?�]+\s*\$\{resultados\.length\}\s*\$\{plural\}</g, '>${resultados.length} ${plural}<'],
  [/>[?�]+\s*Nenhum artigo encontrado</g, '>Nenhum artigo encontrado<'],
  [/"\?\?"/g, '"▼"'],
];

function shouldProcess(filePath) {
  if (!filePath.endsWith('.html')) return false;
  if (excludePrefixes.some((prefix) => filePath.startsWith(prefix))) return false;
  return includeRoots.some((prefix) => filePath.startsWith(prefix));
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (excludePrefixes.some((prefix) => fullPath.startsWith(prefix))) continue;
    if (entry.isDirectory()) {
      walk(fullPath, files);
      continue;
    }
    if (shouldProcess(fullPath)) files.push(fullPath);
  }
  return files;
}

const files = Array.from(new Set(includeRoots.flatMap((dir) => walk(dir))));
let changed = 0;

for (const filePath of files) {
  const original = fs.readFileSync(filePath, 'utf8');
  if (!original.includes('�') && !original.includes('+�') && !original.includes('${newFooterLinks}') && !original.includes("content: '?'")) {
    continue;
  }

  let text = original;
  for (const [from, to] of replacements) {
    text = text.split(from).join(to);
  }
  for (const [pattern, replacement] of regexReplacements) {
    text = text.replace(pattern, replacement);
  }

  if (text !== original) {
    fs.writeFileSync(filePath, text, 'utf8');
    changed += 1;
    console.log('Corrigido residual:', path.relative(root, filePath));
  }
}

console.log('Ficheiros atualizados:', changed);