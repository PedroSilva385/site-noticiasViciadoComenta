#!/usr/bin/env node
/*
 * push-noticias-firebase.js — Envia data/noticias.json para o nó /noticias do
 * Realtime Database, para o workflow rebuild-artigos.yml nao sobrescrever as
 * alteracoes feitas localmente em content/artigos/*.md.
 *
 * Uso:
 *   node tools/push-noticias-firebase.js --dry-run
 *   node tools/push-noticias-firebase.js --confirm
 *
 * Credenciais da conta administradora (precisam de estar na lista /admins):
 *   --email <email>      (ou VC_ADMIN_EMAIL)
 *   --password <senha>   (ou VC_ADMIN_PASSWORD; prefere a variavel de ambiente,
 *                         o --password fica no historico da shell)
 *
 * Notas:
 *   - As regras em database.rules.json exigem auth nao-anonima e uid em /admins.
 *   - Sem --confirm nada é escrito (por defeito corre em dry-run).
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const CONFIG_JSON_PATH = path.join(ROOT_DIR, 'firebase-config.json');
const NOTICIAS_PATH = path.join(ROOT_DIR, 'data', 'noticias.json');

function loadFirebaseConfig() {
  if (!fs.existsSync(CONFIG_JSON_PATH)) {
    throw new Error('Configuração Firebase não encontrada (firebase-config.json).');
  }
  const parsed = JSON.parse(fs.readFileSync(CONFIG_JSON_PATH, 'utf8'));
  if (!parsed.apiKey || !parsed.databaseURL) {
    throw new Error('firebase-config.json sem apiKey ou databaseURL.');
  }
  return parsed;
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const name = token.slice(2);
    const inlineIndex = name.indexOf('=');
    if (inlineIndex > 0) {
      args[name.slice(0, inlineIndex)] = name.slice(inlineIndex + 1);
      continue;
    }
    const next = argv[i + 1];
    if (typeof next === 'string' && !next.startsWith('--')) {
      args[name] = next;
      i += 1;
    } else {
      args[name] = true;
    }
  }
  return args;
}

async function signInWithPassword(apiKey, email, password) {
  const endpoint = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecurities: false }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.idToken) {
    const code = payload && payload.error ? payload.error.message : '';
    throw new Error(`Autenticação falhou (${code || 'erro desconhecido'}).`);
  }
  return { idToken: payload.idToken, uid: payload.localId, email: payload.email || email };
}

function databaseBaseUrl(config) {
  return String(config.databaseURL).replace(/\/+$/, '');
}

async function rtdbRequest(config, idToken, nodePath, options = {}) {
  const query = options.query ? `&${options.query}` : '';
  const url = `${databaseBaseUrl(config)}/${nodePath}.json?auth=${encodeURIComponent(idToken)}${query}`;
  const init = {
    method: options.method || 'GET',
    headers: options.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  };
  const response = await fetch(url, init);
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`RTDB ${init.method} /${nodePath} falhou (HTTP ${response.status}): ${text.slice(0, 200)}`);
  }
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const email = args.email || process.env.VC_ADMIN_EMAIL;
  const password = args.password || process.env.VC_ADMIN_PASSWORD;
  const dryRun = !args.confirm || !!args['dry-run'];

  if (!fs.existsSync(NOTICIAS_PATH)) {
    throw new Error('data/noticias.json não encontrado. Corre primeiro: node tools/content-store.js export-json');
  }

  const payload = JSON.parse(fs.readFileSync(NOTICIAS_PATH, 'utf8'));
  const noticias = Array.isArray(payload.noticias) ? payload.noticias : null;
  if (!noticias || !noticias.length) {
    throw new Error('data/noticias.json não contém um array "noticias" populated.');
  }

  const semComentario = noticias.filter((n) => !/O Coment[áa]rio do Viciado/i.test(String(n.conteudo || '') + String(n.conteudoMarkdown || '')));
  const semResumo = noticias.filter((n) => !String(n.resumo || '').trim());

  console.log(`Noticias a enviar: ${noticias.length}`);
  console.log(`Sem comentario autoral: ${semComentario.length} | Sem resumo: ${semResumo.length}`);

  if (dryRun) {
    console.log('\n[DRY-RUN] Nada foi escrito no Firebase. Usa --confirm para publicar.');
    if (semComentario.length) {
      console.log('Slugs sem comentario: ' + semComentario.map((n) => n.slug).join(', '));
    }
    return;
  }

  if (!email || !password) {
    throw new Error('Credenciais em falta: define VC_ADMIN_EMAIL e VC_ADMIN_PASSWORD (ou --email/--password).');
  }

  const config = loadFirebaseConfig();
  const session = await signInWithPassword(config.apiKey, email, password);
  console.log(`Sessão iniciada: ${session.email} (uid: ${session.uid})`);

  const isAdmin = await rtdbRequest(config, session.idToken, `admins/${session.uid}`);
  if (isAdmin !== true) {
    throw new Error('Esta conta não está na lista /admins; o Firebase recusaria a escrita.');
  }

  const antes = await rtdbRequest(config, session.idToken, 'noticias', { query: 'shallow=true' });
  const totalAntes = antes && typeof antes === 'object' ? Object.keys(antes).length : 0;

  await rtdbRequest(config, session.idToken, 'noticias', { method: 'PUT', body: noticias });

  const depois = await rtdbRequest(config, session.idToken, 'noticias', { query: 'shallow=true' });
  const totalDepois = depois && typeof depois === 'object' ? Object.keys(depois).length : 0;

  console.log(`/noticias atualizado: ${totalAntes} entradas antes, ${totalDepois} depois.`);
  if (totalDepois !== noticias.length) {
    console.warn('Atenção: o número de entradas no Firebase difere do local. Verifica a leitura.');
  }
}

main().catch((error) => {
  console.error(error && error.message ? error.message : error);
  process.exit(1);
});
