(function () {
	const STORAGE_LAST_VISIT = 'last_visit_timestamp';
	const STORAGE_NOTIFICATION_SHOWN = 'notification_shown_for';
	const STORAGE_LAST_NEW_IDS = 'vc_last_new_article_ids';

	const DEFAULT_OPTIONS = {
		toastDurationMs: 10000,
		observeDom: true,
		badgeText: '🔴 NOVO',
		scanSelector: 'a[href]'
	};

	function slugifyTitulo(titulo) {
		if (!titulo || typeof titulo !== 'string') return '';
		return titulo
			.toLowerCase()
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.replace(/-{2,}/g, '-');
	}

	function parseDataPublicacao(valor) {
		if (!valor || typeof valor !== 'string') return 0;

		const dateTime = valor.trim();
		const [datePart, timePart = '00:00'] = dateTime.split(' ');
		const [dia, mes, ano] = (datePart || '').split('/').map(Number);
		const [hora, minuto] = (timePart || '00:00').split(':').map(Number);

		if (!dia || !mes || !ano) return 0;

		return new Date(
			ano,
			mes - 1,
			dia,
			Number.isFinite(hora) ? hora : 0,
			Number.isFinite(minuto) ? minuto : 0,
			0,
			0
		).getTime();
	}

	function getArticleTimestamp(noticia) {
		const dataPublicacaoTs = parseDataPublicacao(noticia.dataPublicacao);
		if (dataPublicacaoTs > 0) return dataPublicacaoTs;

		const dataTs = parseDataPublicacao(noticia.data);
		return dataTs > 0 ? dataTs : 0;
	}

	function buildArticlePath(noticia) {
		const slug = noticia && noticia.slug ? slugifyTitulo(String(noticia.slug).trim()) : slugifyTitulo(noticia && noticia.titulo);
		if (slug) {
			return `/artigos/${encodeURIComponent(slug)}.html`;
		}
		return `/noticias.html?id=${encodeURIComponent(String(noticia && noticia.id ? noticia.id : ''))}`;
	}

	function normalizePath(rawHref) {
		try {
			const parsed = new URL(rawHref, window.location.origin);
			return `${parsed.pathname}${parsed.search}`;
		} catch (error) {
			return rawHref || '';
		}
	}

	function ensureStyles() {
		if (document.getElementById('vc-new-article-notification-style')) return;

		const style = document.createElement('style');
		style.id = 'vc-new-article-notification-style';
		style.textContent = `
			.vc-new-badge {
				display: inline-flex;
				align-items: center;
				gap: 4px;
				margin-left: 8px;
				padding: 3px 8px;
				border-radius: 999px;
				background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
				color: #fff;
				font-size: 11px;
				font-weight: 700;
				letter-spacing: .3px;
				animation: vcPulse 1.4s infinite;
			}

			.vc-new-toast {
				position: fixed;
				top: 20px;
				right: 20px;
				z-index: 9999;
				max-width: 380px;
				padding: 14px 16px;
				border-radius: 12px;
				background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
				color: #fff;
				box-shadow: 0 12px 30px rgba(0, 0, 0, .28);
				cursor: pointer;
				line-height: 1.45;
			}

			.vc-new-toast strong {
				display: block;
				margin-bottom: 4px;
			}

			@keyframes vcPulse {
				0% { transform: scale(1); opacity: 1; }
				50% { transform: scale(1.04); opacity: .85; }
				100% { transform: scale(1); opacity: 1; }
			}
		`;

		document.head.appendChild(style);
	}

	function findTitleElement(anchor) {
		if (!anchor) return null;

		const parentCard = anchor.closest('.noticia-item, .noticia-card, .noticia-completa, article, .search-result-item');
		if (parentCard) {
			return parentCard.querySelector('h2, h3, .card-title, .noticia-titulo') || anchor;
		}
		return anchor;
	}

	function addBadgeToElement(target, badgeText) {
		if (!target) return;
		if (target.querySelector('.vc-new-badge')) return;

		const badge = document.createElement('span');
		badge.className = 'vc-new-badge';
		badge.textContent = badgeText;
		target.appendChild(badge);
	}

	function showToast(newArticles, options) {
		if (!Array.isArray(newArticles) || newArticles.length === 0) return;

		const signature = newArticles.map((item) => String(item.id)).sort().join('|');
		if (!signature) return;

		if (localStorage.getItem(STORAGE_NOTIFICATION_SHOWN) === signature) {
			return;
		}

		localStorage.setItem(STORAGE_NOTIFICATION_SHOWN, signature);

		const firstArticle = newArticles[0];
		const toast = document.createElement('div');
		toast.className = 'vc-new-toast';

		if (newArticles.length === 1) {
			toast.innerHTML = `<strong>📰 Novo artigo publicado</strong>${firstArticle.titulo}`;
		} else {
			toast.innerHTML = `<strong>📰 ${newArticles.length} novos artigos publicados</strong>Clique para ver os artigos mais recentes.`;
		}

		toast.addEventListener('click', () => {
			const destination = newArticles.length === 1
				? buildArticlePath(firstArticle)
				: '/todas-noticias.html';
			window.location.href = destination;
		});

		document.body.appendChild(toast);

		setTimeout(() => {
			toast.remove();
		}, options.toastDurationMs);
	}

	function addNewBadges(newArticles, options) {
		if (!Array.isArray(newArticles) || newArticles.length === 0) return;

		const newPaths = new Set(newArticles.map((item) => normalizePath(buildArticlePath(item))));
		const anchors = document.querySelectorAll(options.scanSelector);

		anchors.forEach((anchor) => {
			const href = anchor.getAttribute('href') || '';
			if (!href || href.startsWith('mailto:') || href.startsWith('http://') || href.startsWith('https://')) return;

			const normalized = normalizePath(href);
			if (!newPaths.has(normalized)) return;

			const titleTarget = findTitleElement(anchor);
			addBadgeToElement(titleTarget, options.badgeText);
		});
	}

	function observeAndReapply(newArticles, options) {
		if (!options.observeDom) return;

		let queued = false;
		const observer = new MutationObserver(() => {
			if (queued) return;
			queued = true;
			setTimeout(() => {
				queued = false;
				addNewBadges(newArticles, options);
			}, 120);
		});

		observer.observe(document.body, {
			childList: true,
			subtree: true
		});
	}

	function getNewArticles(noticias) {
		const now = Date.now();
		const lastVisitRaw = localStorage.getItem(STORAGE_LAST_VISIT);
		const lastVisit = Number(lastVisitRaw);

		if (!lastVisitRaw || !Number.isFinite(lastVisit) || lastVisit <= 0) {
			localStorage.setItem(STORAGE_LAST_VISIT, String(now));
			localStorage.removeItem(STORAGE_LAST_NEW_IDS);
			return [];
		}

		const newArticles = noticias.filter((noticia) => {
			const ts = getArticleTimestamp(noticia);
			return ts > lastVisit && ts <= now;
		});

		localStorage.setItem(STORAGE_LAST_VISIT, String(now));
		localStorage.setItem(STORAGE_LAST_NEW_IDS, JSON.stringify(newArticles.map((item) => String(item.id))));

		return newArticles;
	}

	function init(noticias, customOptions) {
		if (!Array.isArray(noticias) || noticias.length === 0) return;

		const options = { ...DEFAULT_OPTIONS, ...(customOptions || {}) };
		ensureStyles();

		const newArticles = getNewArticles(noticias);
		if (newArticles.length === 0) return;

		addNewBadges(newArticles, options);
		observeAndReapply(newArticles, options);
		showToast(newArticles, options);
	}

	window.NewArticleNotification = {
		init
	};
})();
