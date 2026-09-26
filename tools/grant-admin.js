#!/usr/bin/env node
/*
 * grant-admin.js — Gestão da lista de administradores (/admins) do Realtime Database.
 *
 * Uso:
 *   node tools/grant-admin.js --list
 *   node tools/grant-admin.js --whoami
 *   node tools/grant-admin.js --bootstrap
 *   node tools/grant-admin.js --grant --uid <UID>
 *   node tools/grant-admin.js --grant --target-email <email> --target-password <senha>
 *   node tools/grant-admin.js --revoke --uid <UID>
 *
 * Credenciais da conta administradora que executa a operação:
 *   --email <email> (ou VC_ADMIN_EMAIL)
 *   --password <senha> (ou VC_ADMIN_PASSWORD, ou pedida de forma oculta)
 *
 * Notas:
 *   - A primeira conta administradora é reivindicada com --bootstrap (ou pelo
 *     login no painel admin), enquanto /admins não tiver nenhuma entrada.
 *   - As regras do Realtime Database (database.rules.json) têm de estar publicadas.
 *   - As senhas não são guardadas em nenhum ficheiro; prefere as variáveis de
 *     ambiente ou a introdução interativa (o --password fica no histórico da shell).
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const CONFIG_JSON_PATH = path.join(ROOT_DIR, 'firebase-config.json');
const CONFIG_JS_PATH = path.join(ROOT_DIR, 'firebase-config.js');

function loadFirebaseConfig() {
  if (fs.existsSync(CONFIG_JSON_PATH)) {
    const parsed = JSON.parse(fs.readFileSync(CONFIG_JSON_PATH, 'utf8'));
    if (parsed.apiKey && parsed.databaseURL) {
      return parsed;
    }
  }

  if (fs.existsSync(CONFIG_JS_PATH)) {
    const source = fs.readFileSync(CONFIG_JS_PATH, 'utf8');
    const apiKey = (source.match(/apiKey\s*:\s*['"]([^'"]+)['"]/) || [])[1];
    const databaseURL = (source.match(/databaseURL\s*:\s*['"]([^'"]+)['"]/) || [])[1];
    if (apiKey && databaseURL) {
      return { apiKey, databaseURL };
    }
  }

  throw new Error('Configuração Firebase não encontrada (firebase-config.json).');
}

function parseArgs(argv) {
  const args = { _: [] };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      args._.push(token);
      continue;
    }

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

function translateAuthError(code) {
  switch (String(code || '')) {
    case 'EMAIL_NOT_FOUND':
      return 'Email não encontrado no Firebase Auth.';
    case 'INVALID_PASSWORD':
    case 'INVALID_LOGIN_CREDENTIALS':
    case 'INVALID_CREDENTIAL':
      return 'Email ou senha inválidos.';
    case 'USER_DISABLED':
      return 'Esta conta está desativada no Firebase Auth.';
    case 'TOO_MANY_ATTEMPTS_TRY_LATER':
      return 'Demasiadas tentativas. Aguarda alguns minutos.';
    case 'OPERATION_NOT_ALLOWED':
      return 'O login por Email/Senha está desativado no Firebase Auth.';
    default:
      return `Falha de autenticação (${code || 'erro desconhecido'}).`;
  }
}

async function signInWithPassword(apiKey, email, password) {
  const endpoint = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.idToken) {
    const code = payload && payload.error ? payload.error.message : '';
    throw new Error(translateAuthError(code));
  }

  return { idToken: payload.idToken, uid: payload.localId, email: payload.email || email };
}

function databaseBaseUrl(config) {
  return String(config.databaseURL).replace(/\/+$/, '');
}

async function rtdbRequest(config, idToken, nodePath, options = {}) {
  const url = `${databaseBaseUrl(config)}/${nodePath}.json?auth=${encodeURIComponent(idToken)}`;
  const init = {
    method: options.method || 'GET',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined
  };

  const response = await fetch(url, init);
  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch (_) {
      payload = null;
    }
  }

  if (!response.ok) {
    const reason = payload && payload.error ? String(payload.error) : `HTTP ${response.status}`;
    const error = new Error(reason);
    error.status = response.status;
    throw error;
  }

  return payload;
}

function promptHidden(question) {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    const stdout = process.stdout;

    if (!stdin.isTTY) {
      reject(new Error('Sem terminal interativo para pedir a senha. Usa VC_ADMIN_PASSWORD ou --password.'));
      return;
    }

    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let value = '';
    const finish = (result) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('data', onData);
      stdout.write('\n');
      resolve(result);
    };

    const onData = (chunk) => {
      for (const char of chunk) {
        if (char === '\r' || char === '\n') {
          finish(value);
          return;
        }
        if (char === '\u0003') {
          finish('');
          process.exit(130);
        }
        if (char === '\u007f' || char === '\b') {
          value = value.slice(0, -1);
          continue;
        }
        value += char;
      }
    };

    stdin.on('data', onData);
  });
}

function printHelp() {
  console.log('Gestão de administradores (/admins) do Realtime Database');
  console.log('');
  console.log('  node tools/grant-admin.js --list');
  console.log('  node tools/grant-admin.js --whoami');
  console.log('  node tools/grant-admin.js --bootstrap');
  console.log('  node tools/grant-admin.js --grant --uid <UID>');
  console.log('  node tools/grant-admin.js --grant --target-email <email> --target-password <senha>');
  console.log('  node tools/grant-admin.js --revoke --uid <UID>');
  console.log('');
  console.log('Credenciais: --email/--password, VC_ADMIN_EMAIL/VC_ADMIN_PASSWORD ou pergunta interativa.');
}

async function main() {
  if (typeof fetch !== 'function') {
    throw new Error('É necessário Node.js 18 ou superior (fetch global indisponível).');
  }

  const args = parseArgs(process.argv.slice(2));
  const config = loadFirebaseConfig();

  const action = args.list
    ? 'list'
    : (args.whoami
      ? 'whoami'
      : (args.bootstrap
        ? 'bootstrap'
        : (args.grant
          ? 'grant'
          : (args.revoke ? 'revoke' : ''))));

  if (!action) {
    printHelp();
    process.exitCode = 1;
    return;
  }

  const email = String(args.email || process.env.VC_ADMIN_EMAIL || '').trim();
  if (!email) {
    throw new Error('Indica o email da conta administradora com --email ou VC_ADMIN_EMAIL.');
  }

  let password = String(args.password || process.env.VC_ADMIN_PASSWORD || '');
  if (!password) {
    password = await promptHidden(`Senha de ${email}: `);
  }
  if (!password) {
    throw new Error('Senha em falta.');
  }

  const session = await signInWithPassword(config.apiKey, email, password);
  console.log(`Sessão iniciada: ${session.email} (uid: ${session.uid})`);

  if (action === 'whoami') {
    console.log(`UID desta conta: ${session.uid}`);
    return;
  }

  if (action === 'list') {
    const admins = await rtdbRequest(config, session.idToken, 'admins');
    const entries = admins && typeof admins === 'object' ? Object.keys(admins) : [];
    if (!entries.length) {
      console.log('A lista /admins está vazia.');
      return;
    }

    entries.sort();
    entries.forEach((uid) => {
      console.log(`- ${uid}${uid === session.uid ? ' (esta conta)' : ''}`);
    });
    return;
  }

  if (action === 'bootstrap') {
    await rtdbRequest(config, session.idToken, `admins/${session.uid}`, { method: 'PUT', body: true });
    console.log('Conta reivindicada como primeira administradora (bootstrap concluído).');
    return;
  }

  if (action === 'grant') {
    let targetUid = String(args.uid || '').trim();

    if (!targetUid && args['target-email']) {
      const targetEmail = String(args['target-email']).trim();
      const targetPassword = String(args['target-password'] || '');
      if (!targetPassword) {
        throw new Error('Para resolver o UID por email, indica também --target-password (credenciais da nova conta).');
      }

      const targetSession = await signInWithPassword(config.apiKey, targetEmail, targetPassword);
      targetUid = targetSession.uid;
      console.log(`UID de ${targetEmail}: ${targetUid}`);
    }

    if (!/^[A-Za-z0-9_-]{1,128}$/.test(targetUid)) {
      throw new Error('UID inválido. Usa --uid <UID> ou --target-email/--target-password.');
    }

    await rtdbRequest(config, session.idToken, `admins/${targetUid}`, { method: 'PUT', body: true });
    console.log(`UID ${targetUid} adicionado à lista de administradores.`);
    return;
  }

  if (action === 'revoke') {
    const targetUid = String(args.uid || '').trim();
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(targetUid)) {
      throw new Error('Indica o UID a remover com --revoke --uid <UID>.');
    }

    if (targetUid === session.uid) {
      console.warn('Atenção: estás a remover a própria conta de administrador.');
    }

    await rtdbRequest(config, session.idToken, `admins/${targetUid}`, { method: 'DELETE' });
    console.log(`UID ${targetUid} removido da lista de administradores.`);
  }
}

main().catch((error) => {
  const message = String(error && error.message ? error.message : error);

  if (/permission denied/i.test(message)) {
    console.error('Sem permissão no Realtime Database: a conta indicada tem de já ser administradora.');
    console.error('Se ainda não existe nenhum administrador, usa --bootstrap com a conta principal.');
  } else if (/unauthorized|401/i.test(message)) {
    console.error('Credenciais rejeitadas pelo Firebase. Confirma o email e a senha.');
  } else {
    console.error(`Erro: ${message}`);
  }

  process.exitCode = 1;
});
