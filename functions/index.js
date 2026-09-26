const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getDatabase } = require('firebase-admin/database');
const { defineSecret } = require('firebase-functions/params');
const { onRequest } = require('firebase-functions/v2/https');

const DATABASE_URL = 'https://chat-viciadocomenta-default-rtdb.europe-west1.firebasedatabase.app';

initializeApp({ databaseURL: DATABASE_URL });

const githubTriggerToken = defineSecret('GITHUB_ACTIONS_TRIGGER_TOKEN');

const GITHUB_OWNER = 'PedroSilva385';
const GITHUB_REPO = 'site-noticiasViciadoComenta';
const GITHUB_WORKFLOW_ID = 'rebuild-artigos.yml';
const GITHUB_REF = 'main';

// Apenas os domínios oficiais do site (e ambiente local de desenvolvimento) podem invocar este endpoint a partir do browser.
const ALLOWED_ORIGINS = new Set([
	'https://viciadocomenta.pt',
	'https://www.viciadocomenta.pt',
	'https://pedrosilva385.github.io'
]);

const LOCAL_ORIGIN_PATTERN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

const ALLOWED_ACTIONS = new Set(['save', 'create', 'update', 'delete', 'manual', 'publish']);

const SLUG_PATTERN = /^[a-z0-9-]*$/;
const NOTICIA_ID_PATTERN = /^[a-zA-Z0-9_-]*$/;

function resolveAllowedOrigin(request) {
	const origin = String(request.get('origin') || '').trim().toLowerCase();
	if (!origin) {
		return '';
	}

	return (ALLOWED_ORIGINS.has(origin) || LOCAL_ORIGIN_PATTERN.test(origin)) ? origin : '';
}

function applyCorsHeaders(request, response) {
	const origin = resolveAllowedOrigin(request);
	if (!origin) {
		return false;
	}

	response.set('Access-Control-Allow-Origin', origin);
	response.set('Vary', 'Origin');
	response.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
	response.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
	response.set('Access-Control-Max-Age', '3600');
	return true;
}

function setJsonContentType(response) {
	response.set('Content-Type', 'application/json; charset=utf-8');
}

function getBearerToken(request) {
	const authorization = String(request.get('authorization') || '');
	const match = authorization.match(/^Bearer\s+(.+)$/i);
	return match ? match[1].trim() : '';
}

function normalizeRequestBody(body) {
	if (!body) {
		return {};
	}

	if (typeof body === 'string') {
		try {
			return JSON.parse(body);
		} catch (_) {
			return {};
		}
	}

	if (typeof body === 'object') {
		return body;
	}

	return {};
}

function sendJson(response, statusCode, payload) {
	setJsonContentType(response);
	response.status(statusCode).json(payload);
}

async function isAdminUser(uid) {
	if (!uid) {
		return false;
	}

	try {
		const snapshot = await getDatabase().ref(`admins/${uid}`).get();
		return snapshot.exists() && snapshot.val() === true;
	} catch (error) {
		console.error('Failed to read admin allowlist:', error);
		return false;
	}
}

exports.triggerArticlesRebuild = onRequest(
	{
		region: 'europe-west1',
		timeoutSeconds: 60,
		secrets: [githubTriggerToken]
	},
	async (request, response) => {
		const originAllowed = applyCorsHeaders(request, response);

		if (request.method === 'OPTIONS') {
			response.status(originAllowed ? 204 : 403).send('');
			return;
		}

		if (request.method !== 'POST') {
			sendJson(response, 405, { ok: false, error: 'Method not allowed.' });
			return;
		}

		if (!originAllowed) {
			sendJson(response, 403, { ok: false, error: 'Origin not allowed.' });
			return;
		}

		const idToken = getBearerToken(request);
		if (!idToken) {
			sendJson(response, 401, { ok: false, error: 'Missing Firebase ID token.' });
			return;
		}

		let decodedToken;
		try {
			decodedToken = await getAuth().verifyIdToken(idToken, true);
		} catch (error) {
			console.error('Failed to verify Firebase ID token:', error);
			sendJson(response, 401, { ok: false, error: 'Invalid Firebase ID token.' });
			return;
		}

		const signInProvider = decodedToken && decodedToken.firebase ? decodedToken.firebase.sign_in_provider : '';
		if (!decodedToken || !decodedToken.uid || signInProvider === 'anonymous') {
			sendJson(response, 403, { ok: false, error: 'Authenticated admin user required.' });
			return;
		}

		const isAdmin = await isAdminUser(decodedToken.uid);
		if (!isAdmin) {
			console.warn('Rejected rebuild trigger from non-admin uid:', decodedToken.uid);
			sendJson(response, 403, { ok: false, error: 'Admin privileges required.' });
			return;
		}

		const body = normalizeRequestBody(request.body);
		const slug = String(body.slug || '').trim().toLowerCase().slice(0, 160);
		const noticiaId = String(body.noticiaId || '').trim().slice(0, 80);
		const rawAction = String(body.action || 'save').trim().toLowerCase().slice(0, 40);
		const action = ALLOWED_ACTIONS.has(rawAction) ? rawAction : 'save';

		if (slug && !SLUG_PATTERN.test(slug)) {
			sendJson(response, 400, { ok: false, error: 'Invalid slug.' });
			return;
		}

		if (noticiaId && !NOTICIA_ID_PATTERN.test(noticiaId)) {
			sendJson(response, 400, { ok: false, error: 'Invalid noticiaId.' });
			return;
		}

		const workflowDispatchPayload = {
			ref: GITHUB_REF,
			inputs: {
				trigger_source: 'admin-save',
				noticia_id: noticiaId,
				slug,
				action,
				requested_by: String(decodedToken.email || decodedToken.uid || '').slice(0, 120)
			}
		};

		let githubResponse;
		try {
			githubResponse = await fetch(
				`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${GITHUB_WORKFLOW_ID}/dispatches`,
				{
					method: 'POST',
					headers: {
						Authorization: `Bearer ${githubTriggerToken.value()}`,
						Accept: 'application/vnd.github+json',
						'Content-Type': 'application/json',
						'X-GitHub-Api-Version': '2022-11-28'
					},
					body: JSON.stringify(workflowDispatchPayload)
				}
			);
		} catch (error) {
			console.error('Failed to call GitHub Actions dispatch API:', error);
			sendJson(response, 502, { ok: false, error: 'Failed to contact GitHub Actions.' });
			return;
		}

		if (!githubResponse.ok) {
			const errorText = await githubResponse.text();
			console.error('GitHub Actions dispatch API returned an error:', githubResponse.status, errorText);
			sendJson(response, 502, {
				ok: false,
				error: `GitHub Actions dispatch failed (${githubResponse.status}).`
			});
			return;
		}

		sendJson(response, 200, {
			ok: true,
			message: 'Remote rebuild workflow dispatched successfully.',
			workflow: GITHUB_WORKFLOW_ID,
			ref: GITHUB_REF,
			slug,
			noticiaId
		});
	}
);
