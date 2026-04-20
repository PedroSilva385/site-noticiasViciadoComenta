const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '..', 'assets', 'firebase-config.js');
const configSource = fs.readFileSync(configPath, 'utf8');

const DEFAULT_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCrWyoW7qjHHsF2lP9LzLs21AtPEa-r8NI',
  databaseURL: 'https://chat-viciadocomenta-default-rtdb.europe-west1.firebasedatabase.app'
};

function extractConfigValue(key) {
  const patterns = {
    apiKey: /apiKey:\s*"([^"]+)"/,
    databaseURL: /databaseURL:\s*"([^"]+)"/
  };

  const pattern = patterns[key];
  const match = pattern ? configSource.match(pattern) : null;
  if (match && match[1]) {
    return match[1];
  }

  if (DEFAULT_FIREBASE_CONFIG[key]) {
    return DEFAULT_FIREBASE_CONFIG[key];
  }

  throw new Error(`Nao foi possivel obter ${key} de assets/firebase-config.js`);
}

function normalizeCount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function normalizeFlatMap(source) {
  const entries = Object.entries(source || {});
  const normalized = {};
  for (const [key, value] of entries) {
    normalized[key] = normalizeCount(value);
  }
  return normalized;
}

function normalizeNestedCountMap(source) {
  const normalized = {};
  for (const [outerKey, innerValue] of Object.entries(source || {})) {
    normalized[outerKey] = normalizeFlatMap(innerValue);
  }
  return normalized;
}

function normalizeClickTargets(source) {
  const normalized = {};
  for (const [targetKey, targetValue] of Object.entries(source || {})) {
    const current = targetValue && typeof targetValue === 'object' ? targetValue : {};
    normalized[targetKey] = {
      ...current,
      count: normalizeCount(current.count)
    };
  }
  return normalized;
}

async function signInAnonymously(apiKey) {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Referer: 'https://www.viciadocomenta.pt/'
    },
    body: JSON.stringify({ returnSecureToken: true })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Falha no sign-in anonimo: ${response.status} ${body}`);
  }

  const payload = await response.json();
  if (!payload.idToken) {
    throw new Error('Firebase nao devolveu idToken para reparacao de site_stats.');
  }

  return payload.idToken;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Falha ao obter ${url}: ${response.status}`);
  }
  return response.json();
}

async function writeJson(url, authToken, payload) {
  const separator = url.includes('?') ? '&' : '?';
  const response = await fetch(`${url}${separator}auth=${encodeURIComponent(authToken)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Falha ao escrever ${url}: ${response.status} ${body}`);
  }
}

async function main() {
  const apiKey = extractConfigValue('apiKey');
  const databaseURL = extractConfigValue('databaseURL').replace(/\/$/, '');
  const siteStatsUrl = `${databaseURL}/site_stats.json`;

  const siteStats = await fetchJson(siteStatsUrl);
  const normalizedDaily = normalizeFlatMap(siteStats.daily);
  const normalizedMonthly = normalizeFlatMap(siteStats.monthly);
  const normalizedHourly = normalizeNestedCountMap(siteStats.hourly);
  const normalizedUniqueDaily = normalizeFlatMap(siteStats.unique_daily);
  const normalizedUniqueMonthly = normalizeFlatMap(siteStats.unique_monthly);
  const normalizedUniqueHourly = normalizeNestedCountMap(siteStats.unique_hourly);
  const normalizedPages = normalizeFlatMap(siteStats.pages);
  const normalizedReferrers = normalizeFlatMap(siteStats.referrers);
  const normalizedClickTargets = normalizeClickTargets(siteStats.click_targets);
  const repairedTotal = Object.values(normalizedDaily).reduce((sum, value) => sum + value, 0);

  const repairedStats = {
    ...siteStats,
    total_visits: repairedTotal,
    unique_total: normalizeCount(siteStats.unique_total),
    daily: normalizedDaily,
    monthly: normalizedMonthly,
    hourly: normalizedHourly,
    unique_daily: normalizedUniqueDaily,
    unique_monthly: normalizedUniqueMonthly,
    unique_hourly: normalizedUniqueHourly,
    pages: normalizedPages,
    referrers: normalizedReferrers,
    click_targets: normalizedClickTargets,
    last_updated: new Date().toISOString()
  };

  const authToken = await signInAnonymously(apiKey);
  await writeJson(siteStatsUrl, authToken, repairedStats);

  console.log(`site_stats reparado com sucesso. total_visits=${repairedTotal}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});