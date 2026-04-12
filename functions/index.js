const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { defineSecret } = require('firebase-functions/params');
const { onRequest } = require('firebase-functions/v2/https');

initializeApp();

const githubTriggerToken = defineSecret('GITHUB_ACTIONS_TRIGGER_TOKEN');

const GITHUB_OWNER = 'PedroSilva385';
const GITHUB_REPO = 'site-noticiasViciadoComenta';
const GITHUB_WORKFLOW_ID = 'rebuild-artigos.yml';
const GITHUB_REF = 'main';

function applyCorsHeaders(response) {
	response.set('Access-Control-Allow-Origin', '*');
	response.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
	response.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
	response.set('Access-Control-Max-Age', '3600');
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

exports.triggerArticlesRebuild = onRequest(
	{
		region: 'europe-west1',
		timeoutSeconds: 60,
		secrets: [githubTriggerToken]
	},
	async (request, response) => {
		applyCorsHeaders(response);

		if (request.method === 'OPTIONS') {
			response.status(204).send('');
			return;
		}

		if (request.method !== 'POST') {
			response.status(405).json({ ok: false, error: 'Method not allowed.' });
			return;
		}

		const idToken = getBearerToken(request);
		if (!idToken) {
			response.status(401).json({ ok: false, error: 'Missing Firebase ID token.' });
			return;
		}

		let decodedToken;
		try {
			decodedToken = await getAuth().verifyIdToken(idToken, true);
		} catch (error) {
			console.error('Failed to verify Firebase ID token:', error);
			response.status(401).json({ ok: false, error: 'Invalid Firebase ID token.' });
			return;
		}

		const signInProvider = decodedToken && decodedToken.firebase ? decodedToken.firebase.sign_in_provider : '';
		if (!decodedToken || !decodedToken.uid || signInProvider === 'anonymous') {
			response.status(403).json({ ok: false, error: 'Authenticated admin user required.' });
			return;
		}

		const body = normalizeRequestBody(request.body);
		const slug = String(body.slug || '').trim().slice(0, 160);
		const noticiaId = String(body.noticiaId || '').trim().slice(0, 80);
		const action = String(body.action || 'save').trim().slice(0, 40);

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
			response.status(502).json({ ok: false, error: 'Failed to contact GitHub Actions.' });
			return;
		}

		if (!githubResponse.ok) {
			const errorText = await githubResponse.text();
			console.error('GitHub Actions dispatch API returned an error:', githubResponse.status, errorText);
			response.status(502).json({
				ok: false,
				error: `GitHub Actions dispatch failed (${githubResponse.status}).`,
				details: errorText.slice(0, 1000)
			});
			return;
		}

		response.status(200).json({
			ok: true,
			message: 'Remote rebuild workflow dispatched successfully.',
			workflow: GITHUB_WORKFLOW_ID,
			ref: GITHUB_REF,
			slug,
			noticiaId
		});
	}
);

