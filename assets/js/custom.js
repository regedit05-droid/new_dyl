// Aggregated search renderer for the custom search page.
(function () {
	var mermaidLoadPromise = null;

	function loadMermaidRuntime() {
		if (window.mermaid) {
			return Promise.resolve(window.mermaid);
		}

		if (mermaidLoadPromise) {
			return mermaidLoadPromise;
		}

		mermaidLoadPromise = new Promise(function (resolve, reject) {
			var script = document.createElement("script");
			script.src = "https://cdn.jsdelivr.net/npm/mermaid@9.4.3/dist/mermaid.min.js";
			script.async = true;
			script.onload = function () {
				if (window.mermaid) {
					resolve(window.mermaid);
					return;
				}
				reject(new Error("Mermaid runtime loaded but window.mermaid is unavailable"));
			};
			script.onerror = function () {
				reject(new Error("Failed to load Mermaid runtime"));
			};
			document.head.appendChild(script);
		});

		return mermaidLoadPromise;
	}

	function prepareMermaidBlocks() {
		var blocks = document.querySelectorAll("pre.mermaid");
		for (var i = 0; i < blocks.length; i += 1) {
			var pre = blocks[i];
			var source = pre.querySelector("code");
			var text = source ? source.textContent : pre.textContent;
			var graph = document.createElement("div");
			graph.className = "mermaid";
			graph.textContent = String(text || "").replace(/^\s+|\s+$/g, "");
			pre.parentNode.replaceChild(graph, pre);
		}
	}

	function initMermaidDiagrams() {
		var hasMermaidBlocks = document.querySelector("pre.mermaid, div.mermaid");
		if (!hasMermaidBlocks) {
			return;
		}

		prepareMermaidBlocks();

		loadMermaidRuntime()
			.then(function (mermaid) {
				mermaid.initialize({
					startOnLoad: false,
					securityLevel: "loose",
				});
				var targets = document.querySelectorAll("div.mermaid");
				if (targets.length > 0) {
					mermaid.init(undefined, targets);
				}
			})
			.catch(function (err) {
				console.error("[custom.js] Mermaid render failed:", err);
			});
	}

	function escapeHtml(str) {
		return String(str || "")
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/\"/g, "&quot;")
			.replace(/'/g, "&#39;");
	}

	function normalizeText(str) {
		return String(str || "").toLowerCase().replace(/\s+/g, " ").trim();
	}

	function splitTerms(query) {
		return normalizeText(query)
			.split(/[\s,.;:!?，。；：！？/\\|+\-]+/)
			.map(function (t) {
				return t.trim();
			})
			.filter(function (t) {
				return t.length > 0;
			});
	}

	function scoreDoc(doc, query, terms) {
		var title = normalizeText(doc.title || "");
		var text = normalizeText(doc.text || "");
		var url = normalizeText(doc.url || "");
		var all = title + " " + text + " " + url;

		if (!query) {
			return 0;
		}

		var score = 0;
		if (title.indexOf(query) >= 0) {
			score += 120;
		}
		if (all.indexOf(query) >= 0) {
			score += 80;
		}

		var matchedTerms = 0;
		for (var i = 0; i < terms.length; i += 1) {
			var term = terms[i];
			var inTitle = title.indexOf(term) >= 0;
			var inText = text.indexOf(term) >= 0;
			var inUrl = url.indexOf(term) >= 0;

			if (inTitle || inText || inUrl) {
				matchedTerms += 1;
				score += inTitle ? 25 : 0;
				score += inText ? 12 : 0;
				score += inUrl ? 8 : 0;
			}
		}

		if (terms.length > 0 && matchedTerms === terms.length) {
			score += 60;
		}

		return score;
	}

	function buildSnippet(text, terms) {
		var raw = String(text || "").replace(/\s+/g, " ").trim();
		if (!raw) {
			return "";
		}

		var lower = raw.toLowerCase();
		var hitIndex = -1;
		var hitLen = 0;

		for (var i = 0; i < terms.length; i += 1) {
			var idx = lower.indexOf(terms[i]);
			if (idx >= 0 && (hitIndex < 0 || idx < hitIndex)) {
				hitIndex = idx;
				hitLen = terms[i].length;
			}
		}

		var start = hitIndex > 40 ? hitIndex - 40 : 0;
		var end = Math.min(raw.length, start + 180);
		var snippet = raw.slice(start, end);
		if (start > 0) {
			snippet = "..." + snippet;
		}
		if (end < raw.length) {
			snippet += "...";
		}

		var safe = escapeHtml(snippet);
		for (var j = 0; j < terms.length; j += 1) {
			var term = terms[j];
			if (!term) {
				continue;
			}
			var escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
			safe = safe.replace(new RegExp("(" + escaped + ")", "ig"), "<mark>$1</mark>");
		}

		return safe;
	}

	function getCategory(url) {
		var clean = String(url || "").replace(/^\//, "");
		var seg = clean.split("/")[0] || "其他";
		try {
			return decodeURIComponent(seg) || "其他";
		} catch (e) {
			return seg || "其他";
		}
	}

	function renderSearchResults(container, docs, query) {
		var normalizedQuery = normalizeText(query);
		var terms = splitTerms(query);

		if (!normalizedQuery) {
			container.innerHTML = "<p>请输入关键词进行聚合搜索。</p>";
			return;
		}

		var scored = [];
		var seen = Object.create(null);

		for (var i = 0; i < docs.length; i += 1) {
			var doc = docs[i] || {};
			var url = doc.url || "";
			if (!url || seen[url]) {
				continue;
			}

			var score = scoreDoc(doc, normalizedQuery, terms);
			if (score <= 0) {
				continue;
			}

			seen[url] = true;
			scored.push({
				doc: doc,
				score: score,
			});
		}

		scored.sort(function (a, b) {
			return b.score - a.score;
		});

		if (scored.length === 0) {
			container.innerHTML = "<p>未找到与“" + escapeHtml(query) + "”相关的内容。</p>";
			return;
		}

		var top = scored.slice(0, 80);
		var html = [];
		html.push('<p class="search-summary">共找到 ' + top.length + ' 条结果（按相关度排序）</p>');

		for (var j = 0; j < top.length; j += 1) {
			var item = top[j];
			var title = escapeHtml(item.doc.title || "无标题");
			var link = escapeHtml(item.doc.url || "#");
			var category = escapeHtml(getCategory(item.doc.url));
			var snippet = buildSnippet(item.doc.text || "", terms);
			html.push(
				'<article class="search-result">' +
					'<h3><a href="' + link + '">' + title + '</a></h3>' +
					'<div class="search-meta">分类：<span>' + category + '</span> · 相关度：' + item.score + '</div>' +
					'<p>' + snippet + '</p>' +
				'</article>'
			);
		}

		container.innerHTML = html.join("");
	}

	function initAggregatedSearch() {
		var container = document.getElementById("search-results");
		if (!container) {
			return;
		}

		var params = new URLSearchParams(window.location.search);
		var query = params.get("q") || params.get("query") || "";

		fetch("/search/search_index.json")
			.catch(function () {
				return fetch("/search_index.json");
			})
			.then(function (res) {
				if (!res.ok) {
					throw new Error("无法读取搜索索引");
				}
				return res.json();
			})
			.then(function (index) {
				var docs = Array.isArray(index.docs) ? index.docs : [];
				renderSearchResults(container, docs, query);
			})
			.catch(function (err) {
				container.innerHTML = '<p>搜索初始化失败：' + escapeHtml(err.message) + '</p>';
			});
	}

	function getThemeScheme() {
		return document.body.getAttribute("data-md-color-scheme") || "default";
	}

	function applyFilterTheme(toolbar) {
		if (!toolbar) {
			return;
		}

		toolbar.classList.remove("inline-item-filter--default", "inline-item-filter--slate");
		toolbar.classList.add(getThemeScheme() === "slate" ? "inline-item-filter--slate" : "inline-item-filter--default");
	}

	function ensureThemeObserver(toolbar) {
		if (!toolbar || !document.body) {
			return;
		}

		if (window.__inlineItemFilterThemeObserver) {
			window.__inlineItemFilterThemeObserver.disconnect();
		}

		var observer = new MutationObserver(function () {
			applyFilterTheme(toolbar);
		});

		observer.observe(document.body, {
			attributes: true,
			attributeFilter: ["data-md-color-scheme"],
		});

		window.__inlineItemFilterThemeObserver = observer;
	}

	function findItemContainer(card) {
		var node = card;
		while (node && node.parentElement) {
			if (node.parentElement.classList && node.parentElement.classList.contains("grid")) {
				return node;
			}
			node = node.parentElement;
		}
		return card;
	}

	function trimWrapperWhitespace(wrapper) {
		while (wrapper.firstChild && wrapper.firstChild.nodeType === Node.TEXT_NODE && !wrapper.firstChild.textContent.trim()) {
			wrapper.removeChild(wrapper.firstChild);
		}
		while (wrapper.lastChild && wrapper.lastChild.nodeType === Node.TEXT_NODE && !wrapper.lastChild.textContent.trim()) {
			wrapper.removeChild(wrapper.lastChild);
		}
	}

	function decorateItemMetaBetweenDividers() {
		var cards = document.querySelectorAll(".md-content .admonition.item");
		for (var c = 0; c < cards.length; c += 1) {
			var dividers = cards[c].querySelectorAll("hr.item-divider");
			if (dividers.length < 2) {
				continue;
			}

			for (var i = 0; i < dividers.length - 1; i += 2) {
				var start = dividers[i];
				var end = dividers[i + 1];
				if (!start || !end || start.parentNode !== end.parentNode) {
					continue;
				}

				var maybeWrapped = start.nextElementSibling;
				if (maybeWrapped && maybeWrapped.classList && maybeWrapped.classList.contains("item-meta")) {
					continue;
				}

				var wrapper = document.createElement("div");
				wrapper.className = "item-meta";
				var node = start.nextSibling;
				var moved = false;

				while (node && node !== end) {
					var next = node.nextSibling;
					wrapper.appendChild(node);
					moved = true;
					node = next;
				}

				trimWrapperWhitespace(wrapper);
				if (moved && wrapper.childNodes.length > 0) {
					start.parentNode.insertBefore(wrapper, end);
				}
			}
		}
	}

	function initCurrentPageItemFilter() {
		var existingToolbar = document.querySelector(".inline-item-filter");
		if (existingToolbar) {
			existingToolbar.remove();
		}

		var cards = Array.prototype.slice.call(document.querySelectorAll(".md-content .admonition.item"));
		if (cards.length === 0) {
			return;
		}

		var host = document.querySelector(".md-content__inner") || document.querySelector(".md-content");
		if (!host) {
			return;
		}

		var wrappers = cards.map(findItemContainer);
		var data = cards.map(function (card, idx) {
			return {
				card: card,
				wrapper: wrappers[idx],
				text: normalizeText(card.textContent || ""),
			};
		});

		var toolbar = document.createElement("div");
		toolbar.className = "inline-item-filter";
		toolbar.innerHTML =
			'<label for="inline-item-filter-input">筛选</label>' +
			'<input id="inline-item-filter-input" type="search" placeholder="输入关键词，如：黑暗 项链" />' +
			'<button type="button" id="inline-item-filter-clear">清空</button>' +
			'<span id="inline-item-filter-count" aria-live="polite"></span>';

		applyFilterTheme(toolbar);

		host.insertBefore(toolbar, host.firstChild);
		ensureThemeObserver(toolbar);

		var input = toolbar.querySelector("#inline-item-filter-input");
		var clearBtn = toolbar.querySelector("#inline-item-filter-clear");
		var countEl = toolbar.querySelector("#inline-item-filter-count");

		function applyFilter() {
			var q = normalizeText(input.value || "");
			var terms = splitTerms(q);
			var visible = 0;

			for (var i = 0; i < data.length; i += 1) {
				var matched = true;
				for (var j = 0; j < terms.length; j += 1) {
					if (data[i].text.indexOf(terms[j]) < 0) {
						matched = false;
						break;
					}
				}
				data[i].wrapper.style.display = matched ? "" : "none";
				if (matched) {
					visible += 1;
				}
			}

			countEl.textContent = "显示 " + visible + " / " + data.length;
		}

		input.addEventListener("input", applyFilter);
		clearBtn.addEventListener("click", function () {
			input.value = "";
			applyFilter();
			input.focus();
		});

		applyFilter();
	}

	function initFooterYear() {
		var yearEl = document.getElementById("dyl-footer-year");
		if (!yearEl) {
			return;
		}

		var start = parseInt((yearEl.textContent || "").trim(), 10);
		var now = new Date().getFullYear();
		if (!isNaN(start) && now > start) {
			yearEl.textContent = start + "-" + now;
		} else {
			yearEl.textContent = String(now);
		}
	}

	function initPageFeatures() {
		initMermaidDiagrams();
		initAggregatedSearch();
		decorateItemMetaBetweenDividers();
		initCurrentPageItemFilter();
		initFooterYear();
	}

	document.addEventListener("DOMContentLoaded", function () {
		initPageFeatures();
	});

	if (typeof document$ !== "undefined" && document$ && typeof document$.subscribe === "function") {
		document$.subscribe(function () {
			window.requestAnimationFrame(function () {
				initPageFeatures();
			});
		});
	}
})();
