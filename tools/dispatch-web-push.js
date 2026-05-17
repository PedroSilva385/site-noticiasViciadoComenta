const fs = require('node:fs');
const admin = require('firebase-admin');
const webpush = require('web-push');

const DATABASE_URL = process.env.FIREBASE_DATABASE_URL || 'https://chat-viciadocomenta-default-rtdb.europe-west1.firebasedatabase.app';
const SERVICE_ACCOUNT_JSON = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
const VAPID_PUBLIC_KEY = String(process.env.WEB_PUSH_VAPID_PUBLIC_KEY || '').trim();
const VAPID_PRIVATE_KEY = String(process.env.WEB_PUSH_VAPID_PRIVATE_KEY || '').trim();
const VAPID_SUBJECT = String(process.env.WEB_PUSH_VAPID_SUBJECT || '').trim();
const PUSH_SUBSCRIPTIONS_PATH = 'push_subscriptions';
const PUSH_META_PATH = 'push_meta';
const DISPATCH_REQUEST_TIMEOUT_MS = Number(process.env.WEB_PUSH_REQUEST_TIMEOUT_MS || 10000);

function fail(message) {
  throw new Error(message);
}

function ensureEnv() {
  if (!SERVICE_ACCOUNT_JSON) fail('Missing FIREBASE_SERVICE_ACCOUNT_JSON.');
  if (!VAPID_PUBLIC_KEY) fail('Missing WEB_PUSH_VAPID_PUBLIC_KEY.');
  if (!VAPID_PRIVATE_KEY) fail('Missing WEB_PUSH_VAPID_PRIVATE_KEY.');
  if (!VAPID_SUBJECT) fail('Missing WEB_PUSH_VAPID_SUBJECT.');
}

function parseServiceAccount() {
  try {
    return JSON.parse(SERVICE_ACCOUNT_JSON);
  } catch (error) {
    fail(`Invalid FIREBASE_SERVICE_ACCOUNT_JSON: ${error.message}`);
  }
}

function normalizeSubscription(rawSubscription) {
  if (!rawSubscription || typeof rawSubscription !== 'object' || Array.isArray(rawSubscription)) {
    return null;
  }

  const endpoint = String(rawSubscription.endpoint || '').trim();
  const expirationTime = rawSubscription.expirationTime == null ? null : Number(rawSubscription.expirationTime);
  const keys = rawSubscription.keys && typeof rawSubscription.keys === 'object' ? rawSubscription.keys : {};
  const p256dh = String(keys.p256dh || '').trim();
  const auth = String(keys.auth || '').trim();

  if (!endpoint || !p256dh || !auth) {
    return null;
  }

  return {
    endpoint,
    expirationTime: Number.isFinite(expirationTime) ? expirationTime : null,
    keys: {
      p256dh,
      auth
    }
  };
}

function buildPushPayload(body) {
  return {
    title: String(body.title || 'Novo artigo publicado').trim().slice(0, 120),
    body: String(body.body || 'Ja saiu um novo artigo no VICIADO COMENTA.').trim().slice(0, 240),
    url: String(body.url || 'https://www.viciadocomenta.pt/artigos.html').trim().slice(0, 500),
    topic: String(body.topic || 'all').trim().toLowerCase() || 'all',
    articleKey: String(body.articleKey || '').trim().slice(0, 180),
    icon: '/assets/favicon.svg',
    badge: '/assets/favicon.svg'
  };
}

function shouldSendToTopic(record, topic) {
  const recordTopic = String((record && record.topic) || 'all').trim().toLowerCase() || 'all';
  return topic === 'all' || recordTopic === 'all' || recordTopic === topic;
}

function buildSendOptions() {
  return {
    TTL: 60,
    urgency: 'normal',
    timeout: Number.isFinite(DISPATCH_REQUEST_TIMEOUT_MS) && DISPATCH_REQUEST_TIMEOUT_MS > 0
      ? DISPATCH_REQUEST_TIMEOUT_MS
      : 10000
  };
}

async function markSubscriptionStatus(database, subscriptionId, status, errorMessage) {
  await database.ref(`${PUSH_SUBSCRIPTIONS_PATH}/${subscriptionId}`).update({
    status,
    lastError: errorMessage ? String(errorMessage).slice(0, 500) : null,
    updatedAt: Date.now(),
    lastSeenAt: Date.now()
  });
}

async function main() {
  ensureEnv();

  const payloadPath = process.argv[2];
  if (!payloadPath) {
    fail('Usage: node tools/dispatch-web-push.js <payload.json>');
  }

  const rawPayload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));
  const payload = buildPushPayload(rawPayload);
  const serviceAccount = parseServiceAccount();

  let app = admin.apps[0];
  if (!app) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: DATABASE_URL
    });
    app = admin.app();
  }

  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    const database = admin.database(app);
    const metaRef = database.ref(`${PUSH_META_PATH}/last_dispatch`);
    const metaSnapshot = await metaRef.get();
    const lastDispatch = metaSnapshot.exists() ? (metaSnapshot.val() || {}) : {};

    if (payload.articleKey && lastDispatch.articleKey === payload.articleKey) {
      console.log('Push skipped: article already notified.');
      return;
    }

    const subscriptionsSnapshot = await database.ref(PUSH_SUBSCRIPTIONS_PATH).get();
    const subscriptions = subscriptionsSnapshot.exists() ? (subscriptionsSnapshot.val() || {}) : {};
    const entries = Object.entries(subscriptions).filter(([, record]) => shouldSendToTopic(record, payload.topic));

    let sent = 0;
    let failed = 0;

    for (const [subscriptionId, record] of entries) {
      const subscription = normalizeSubscription(record && record.subscription);
      if (!subscription) {
        failed += 1;
        await markSubscriptionStatus(database, subscriptionId, 'invalid', 'Missing or invalid subscription object.');
        continue;
      }

      try {
        await webpush.sendNotification(subscription, JSON.stringify(payload), buildSendOptions());
        sent += 1;
        await markSubscriptionStatus(database, subscriptionId, 'active', null);
      } catch (error) {
        failed += 1;
        const statusCode = Number(error && error.statusCode);
        if (statusCode === 404 || statusCode === 410) {
          await database.ref(`${PUSH_SUBSCRIPTIONS_PATH}/${subscriptionId}`).remove();
        } else {
          await markSubscriptionStatus(database, subscriptionId, 'error', error && error.message ? error.message : 'Unknown Web Push error.');
        }
      }
    }

    await metaRef.set({
      articleKey: payload.articleKey || null,
      topic: payload.topic,
      title: payload.title,
      url: payload.url,
      sent,
      failed,
      dispatchedAt: Date.now()
    });

    console.log(`Push dispatch finished. Sent: ${sent}. Failed: ${failed}.`);
  } finally {
    await app.delete();
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
