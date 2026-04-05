// @ts-check
/// <reference lib="dom" />

/**
 * MARC27 Marketplace — webview client script
 * Communicates with the extension host via postMessage.
 * DOM-only rendering — no innerHTML.
 */

(function () {
	'use strict';

	// @ts-ignore
	const vscode = acquireVsCodeApi();

	const searchInput = /** @type {HTMLInputElement} */ (document.getElementById('search-input'));
	const categoryTabs = document.getElementById('category-tabs');
	const resultsContainer = document.getElementById('results-container');
	const statusMessage = document.getElementById('status-message');
	const loadingIndicator = document.getElementById('loading-indicator');

	let activeCategory = 'all';
	let searchTimer = 0;
	/** @type {Set<string>} */
	const installingIds = new Set();
	/** @type {Set<string>} */
	const installedIds = new Set();

	// ── Outbound messages ──

	function requestSearch() {
		const query = searchInput.value.trim();
		showLoading(true);
		hideStatus();
		vscode.postMessage({ type: 'search', query: query, category: activeCategory });
	}

	// ── Search input (debounced) ──

	searchInput.addEventListener('input', function () {
		clearTimeout(searchTimer);
		searchTimer = setTimeout(requestSearch, 300);
	});

	searchInput.addEventListener('keydown', function (e) {
		if (e.key === 'Enter') {
			clearTimeout(searchTimer);
			requestSearch();
		}
	});

	// ── Category tabs ──

	categoryTabs.addEventListener('click', function (e) {
		const target = /** @type {HTMLElement} */ (e.target);
		if (!target.classList.contains('category-tab')) {
			return;
		}
		const category = target.getAttribute('data-category');
		if (!category || category === activeCategory) {
			return;
		}

		activeCategory = category;

		// Update active state
		var tabs = categoryTabs.querySelectorAll('.category-tab');
		for (var i = 0; i < tabs.length; i++) {
			tabs[i].classList.toggle('active', tabs[i].getAttribute('data-category') === category);
		}

		requestSearch();
	});

	// ── Render helpers (DOM-only, no innerHTML) ──

	/**
	 * @param {string} tag
	 * @param {string} [className]
	 * @param {string} [textContent]
	 * @returns {HTMLElement}
	 */
	function el(tag, className, textContent) {
		var node = document.createElement(tag);
		if (className) { node.className = className; }
		if (textContent !== undefined) { node.textContent = textContent; }
		return node;
	}

	/**
	 * @param {number} rating
	 * @returns {HTMLElement}
	 */
	function renderStars(rating) {
		var container = el('span', 'meta-rating');
		var full = Math.round(rating);
		for (var i = 1; i <= 5; i++) {
			var star = el('span', i <= full ? 'star' : 'star empty', '\u2605');
			container.appendChild(star);
		}
		return container;
	}

	/**
	 * @param {number} n
	 * @returns {string}
	 */
	function formatInstalls(n) {
		if (n >= 1000000) { return (n / 1000000).toFixed(1) + 'M'; }
		if (n >= 1000) { return (n / 1000).toFixed(1) + 'k'; }
		return String(n);
	}

	/**
	 * @param {{id:string, name:string, description:string, author:string, category:string, installs:number, rating:number, version:string}} item
	 * @returns {HTMLElement}
	 */
	function renderCard(item) {
		var card = el('div', 'marketplace-card');
		card.setAttribute('data-id', item.id);

		// Header
		var header = el('div', 'card-header');
		header.appendChild(el('span', 'card-name', item.name));
		header.appendChild(el('span', 'card-version', 'v' + item.version));
		card.appendChild(header);

		// Description
		card.appendChild(el('div', 'card-description', item.description));

		// Meta row
		var meta = el('div', 'card-meta');
		meta.appendChild(el('span', 'meta-author', item.author));
		meta.appendChild(el('span', 'meta-installs', formatInstalls(item.installs)));
		meta.appendChild(renderStars(item.rating));
		card.appendChild(meta);

		// Footer
		var footer = el('div', 'card-footer');
		footer.appendChild(el('span', 'card-category', item.category));

		var btn = /** @type {HTMLButtonElement} */ (document.createElement('button'));
		btn.className = 'install-btn';

		if (installedIds.has(item.id)) {
			btn.textContent = 'Installed';
			btn.className = 'install-btn installed';
			btn.disabled = true;
		} else if (installingIds.has(item.id)) {
			btn.textContent = 'Installing...';
			btn.className = 'install-btn installing';
			btn.disabled = true;
		} else {
			btn.textContent = 'Install';
		}

		btn.addEventListener('click', function (e) {
			e.stopPropagation();
			if (btn.disabled) { return; }
			btn.textContent = 'Installing...';
			btn.className = 'install-btn installing';
			btn.disabled = true;
			installingIds.add(item.id);
			vscode.postMessage({ type: 'install', id: item.id, name: item.name });
		});

		footer.appendChild(btn);
		card.appendChild(footer);

		// Card click -> info
		card.addEventListener('click', function () {
			vscode.postMessage({ type: 'info', id: item.id });
		});

		return card;
	}

	/**
	 * @param {{id:string, name:string, description:string, author:string, category:string, installs:number, rating:number, version:string}[]} items
	 */
	function renderResults(items) {
		// Clear existing children
		while (resultsContainer.firstChild) {
			resultsContainer.removeChild(resultsContainer.firstChild);
		}

		if (items.length === 0) {
			showStatus('No packages found. Try a different search term.', false);
			return;
		}

		hideStatus();
		for (var i = 0; i < items.length; i++) {
			resultsContainer.appendChild(renderCard(items[i]));
		}
	}

	/**
	 * @param {boolean} visible
	 */
	function showLoading(visible) {
		loadingIndicator.style.display = visible ? 'flex' : 'none';
	}

	/**
	 * @param {string} message
	 * @param {boolean} isError
	 */
	function showStatus(message, isError) {
		// Clear children
		while (statusMessage.firstChild) {
			statusMessage.removeChild(statusMessage.firstChild);
		}

		statusMessage.className = isError ? 'status-message error' : 'status-message';

		if (isError) {
			statusMessage.appendChild(el('span', 'error-icon', '\u26A0'));
		} else {
			statusMessage.appendChild(el('span', 'empty-icon', '\uD83D\uDD0D'));
		}

		statusMessage.appendChild(document.createTextNode(message));
		statusMessage.style.display = 'block';
	}

	function hideStatus() {
		statusMessage.style.display = 'none';
	}

	// ── Inbound messages from extension host ──

	window.addEventListener('message', function (event) {
		var message = event.data;

		switch (message.type) {
			case 'searchResults':
				showLoading(false);
				renderResults(message.items || []);
				break;

			case 'searchError':
				showLoading(false);
				// Clear results
				while (resultsContainer.firstChild) {
					resultsContainer.removeChild(resultsContainer.firstChild);
				}
				showStatus(message.message, true);
				break;

			case 'installComplete': {
				installingIds.delete(message.id);
				installedIds.add(message.id);
				// Update button in DOM
				var cards = resultsContainer.querySelectorAll('.marketplace-card');
				for (var i = 0; i < cards.length; i++) {
					if (cards[i].getAttribute('data-id') === message.id) {
						var btn = cards[i].querySelector('.install-btn');
						if (btn) {
							btn.textContent = 'Installed';
							btn.className = 'install-btn installed';
							/** @type {HTMLButtonElement} */ (btn).disabled = true;
						}
					}
				}
				break;
			}

			case 'installFailed': {
				installingIds.delete(message.id);
				var failCards = resultsContainer.querySelectorAll('.marketplace-card');
				for (var j = 0; j < failCards.length; j++) {
					if (failCards[j].getAttribute('data-id') === message.id) {
						var failBtn = failCards[j].querySelector('.install-btn');
						if (failBtn) {
							failBtn.textContent = 'Install';
							failBtn.className = 'install-btn';
							/** @type {HTMLButtonElement} */ (failBtn).disabled = false;
						}
					}
				}
				break;
			}

			case 'setSearch':
				searchInput.value = message.query || '';
				requestSearch();
				break;

			case 'refresh':
				requestSearch();
				break;

			case 'triggerInstall':
				vscode.postMessage({ type: 'install', id: message.id, name: message.id });
				break;
		}
	});

	// ── Init ──

	vscode.postMessage({ type: 'ready' });
})();
