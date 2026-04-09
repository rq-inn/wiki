(function () {
  const SEARCH_LIMIT = 60;

  const app = document.getElementById("app");
  const state = {
    articles: [],
    publicArticles: [],
    searchIndex: [],
    categories: [],
    categoryFilter: "",
    indexGroup: "all",
    searchQuery: "",
  };

  let searchInputTimer = 0;
  let isComposingSearch = false;

  const tabLabels = {
    all: "\u3059\u3079\u3066",
    a: "\u3042",
    ka: "\u304b",
    sa: "\u3055",
    ta: "\u305f",
    na: "\u306a",
    ha: "\u306f",
    ma: "\u307e",
    ya: "\u3084",
    ra: "\u3089",
    wa: "\u308f",
    other: "\u4ed6",
  };

  init().catch((error) => {
    console.error(error);
    app.innerHTML = `<section class="card stack"><h1>Viewer Error</h1><p class="notice error">${escapeHtml(String(error.message || error))}</p></section>`;
  });

  async function init() {
    await window.I18N.init(window.WikiAssets?.dataCsvBase);
    const rows = await loadArticles();
    state.articles = rows.map(window.WikiData.normalizeArticle);
    state.publicArticles = window.WikiData.sortArticles(state.articles.filter((article) => article.situation === "public"));
    state.searchIndex = state.publicArticles.map((article) => {
      const plainBody = stripTags(article.body_jp).replace(/\[image:[^\]]+\]/gi, " ").replace(/\s+/g, " ").trim();
      return {
        article,
        titleLower: `${article.title_jp} ${article.title_jp_read}`.toLowerCase(),
        bodyPlain: plainBody,
        bodyLower: plainBody.toLowerCase(),
      };
    });
    state.categories = window.WikiData.collectCategories(state.publicArticles);

    window.addEventListener("hashchange", render);
    window.addEventListener("storage", (event) => {
      if (event.key === "WIKI_EDITOR_PREVIEW") render();
    });
    render();
  }

  async function loadArticles() {
    try {
      const response = await fetch(window.WikiApi.buildUrl("/articles"), { cache: "no-store" });
      if (response.ok) return response.json();
    } catch (error) {
      console.warn("Viewer API fallback to local CSV", error);
    }
    return window.CSV.load(`${window.WikiAssets?.dataCsvBase || "../data/csv"}/wikitxt.csv`);
  }

  function render() {
    const route = parseRoute();
    if (route.name === "detail") return renderDetail(route.id);
    if (route.name === "preview") return renderPreview();
    if (route.name === "credit") return renderCredit();
    if (route.name === "main") return renderMain();
    if (route.name === "toc") return renderToc();
    if (route.name === "index") return renderIndex();
    if (route.name === "search") return renderSearch();
    return renderStart();
  }

  function parseRoute() {
    const hash = location.hash.replace(/^#/, "");
    if (!hash) return { name: "start" };
    const [name, rawId] = hash.split("/");
    return { name, id: rawId ? decodeURIComponent(rawId) : "" };
  }

  function renderShell(title, body) {
    app.innerHTML = `
      <section class="hero">
        <div class="stack" style="gap:6px;">
          <h1>${escapeHtml(title)}</h1>
          <div class="lede">${escapeHtml(window.I18N.t("VIEWER_SUBTITLE"))}</div>
        </div>
      </section>
      ${body}
    `;
  }

  function renderStart() {
    renderShell(window.I18N.t("APP_TITLE"), `
      <section class="card stack">
        <div class="start-stage compact">
          <div class="start-ornament">
            <img src="${window.WikiAssets?.iconBase || "../icon"}/lightbringers-512.png" alt="Lightbringers emblem">
          </div>
          <div class="stack">
            <h2 class="screen-title">${escapeHtml(window.I18N.t("START_TITLE"))}</h2>
            <p class="lede">${escapeHtml(window.I18N.t("START_BODY"))}</p>
            <div class="row">
              <button class="btn btn-primary" data-nav="#main">${escapeHtml(window.I18N.t("START_BUTTON"))}</button>
              <button class="btn btn-secondary" data-nav="#credit">${escapeHtml(window.I18N.t("CREDIT"))}</button>
            </div>
          </div>
        </div>
      </section>
    `);
    wireNav();
  }

  function renderCredit() {
    renderShell(window.I18N.t("CREDIT"), `
      <section class="card stack">
        <h2 class="screen-title">${escapeHtml(window.I18N.t("CREDIT"))}</h2>
        <p>${escapeHtml(window.I18N.t("CREDIT_BODY_1"))}</p>
        <p>${escapeHtml(window.I18N.t("CREDIT_BODY_2"))}</p>
        <p>${escapeHtml(window.I18N.t("CREDIT_BODY_3"))}</p>
        <p>${escapeHtml(window.I18N.t("CREDIT_BODY_4"))}</p>
        <p><a href="https://wellofdaliath.chaosium.com/home/gloranthan-documents/gloranthan-runes-fonts/glorantha-core-rune-font/" target="_blank" rel="noreferrer">${escapeHtml(window.I18N.t("FONT_LINK"))}</a></p>
        <div class="row">
          <button class="btn btn-secondary" data-nav="#">${escapeHtml(window.I18N.t("RETURN_TOP"))}</button>
        </div>
      </section>
    `);
    wireNav();
  }

  function renderMain() {
    renderShell(window.I18N.t("APP_TITLE"), `
      <section class="card stack">
        <h2 class="screen-title">${escapeHtml(window.I18N.t("MAIN_MENU"))}</h2>
        <div class="row">
          <button class="btn btn-primary" data-nav="#toc">${escapeHtml(window.I18N.t("TOC"))}</button>
          <button class="btn btn-accent" data-nav="#index">${escapeHtml(window.I18N.t("INDEX"))}</button>
          <button class="btn btn-secondary" data-nav="#search">${escapeHtml(window.I18N.t("SEARCH"))}</button>
        </div>
      </section>
    `);
    wireNav();
  }

  function renderToc() {
    const options = [
      `<option value="">${escapeHtml(window.I18N.t("ALL_CATEGORIES"))}</option>`,
      ...state.categories.map((category) => `<option value="${escapeHtml(category)}"${state.categoryFilter === category ? " selected" : ""}>${escapeHtml(category)}</option>`),
    ].join("");
    const rows = state.publicArticles.filter((article) => !state.categoryFilter || article.categories.includes(state.categoryFilter));

    renderShell(window.I18N.t("TOC"), `
      ${mainNav()}
      <section class="card stack">
        <div class="row center between">
          <h2 class="screen-title">${escapeHtml(window.I18N.t("TOC"))}</h2>
          <select class="select" id="categoryFilter" style="max-width:280px;">${options}</select>
        </div>
        ${renderArticleList(rows)}
      </section>
    `);
    wireNav();
    document.getElementById("categoryFilter").addEventListener("change", (event) => {
      state.categoryFilter = event.target.value;
      renderToc();
    });
  }

  function renderIndex() {
    const rows = window.WikiData.sortForIndex(state.publicArticles).filter((article) => {
      if (state.indexGroup === "all") return true;
      return window.WikiData.detectKanaGroup(article.reading) === state.indexGroup;
    });

    renderShell(window.I18N.t("INDEX"), `
      ${mainNav()}
      <section class="card stack">
        <h2 class="screen-title">${escapeHtml(window.I18N.t("INDEX"))}</h2>
        <div class="nav-tabs">
          ${Object.entries(tabLabels).map(([key, label]) => `<button class="nav-tab ${state.indexGroup === key ? "active" : ""}" data-index-group="${key}">${label}</button>`).join("")}
        </div>
        ${renderArticleList(rows)}
      </section>
    `);
    wireNav();
    document.querySelectorAll("[data-index-group]").forEach((button) => {
      button.addEventListener("click", () => {
        state.indexGroup = button.dataset.indexGroup;
        renderIndex();
      });
    });
  }

  function renderSearch() {
    const query = state.searchQuery.trim();
    const results = query ? buildSearchResults(query) : [];

    renderShell(window.I18N.t("SEARCH"), `
      ${mainNav()}
      <section class="card stack search-panel">
        <h2 class="screen-title">${escapeHtml(window.I18N.t("SEARCH"))}</h2>
        <input class="input" id="searchInput" placeholder="${escapeHtml(window.I18N.t("SEARCH_PLACEHOLDER"))}" value="${escapeHtml(state.searchQuery)}">
        ${query
          ? renderSearchResults(results)
          : `<div class="chips">${state.categories.map((category) => `<span class="chip">${escapeHtml(category)}</span>`).join("") || `<span class="muted">${escapeHtml(window.I18N.t("NO_CATEGORY"))}</span>`}</div>`}
      </section>
    `);

    wireNav();
    const searchInput = document.getElementById("searchInput");
    searchInput.focus();
    searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
    searchInput.addEventListener("compositionstart", () => {
      isComposingSearch = true;
      window.clearTimeout(searchInputTimer);
    });
    searchInput.addEventListener("compositionend", (event) => {
      isComposingSearch = false;
      state.searchQuery = event.target.value;
      renderSearch();
    });
    searchInput.addEventListener("input", (event) => {
      if (isComposingSearch || event.isComposing) {
        state.searchQuery = event.target.value;
        return;
      }
      window.clearTimeout(searchInputTimer);
      const nextValue = event.target.value;
      searchInputTimer = window.setTimeout(() => {
        state.searchQuery = nextValue;
        renderSearch();
      }, 120);
    });
  }

  function renderDetail(id) {
    const article = state.publicArticles.find((row) => row.id === id);
    if (!article) {
      renderShell(window.I18N.t("APP_TITLE"), `${mainNav()}<section class="card"><p class="notice error">${escapeHtml(window.I18N.t("ARTICLE_NOT_FOUND"))}</p></section>`);
      wireNav();
      return;
    }

    const body = window.WikiData.renderBody(article.body_jp, article.title_jp, state.publicArticles, window.WikiApi.imageBase);
    renderShell(article.title_jp, `
      ${mainNav()}
      <section class="card stack detail-paper">
        <div>
          <h2 class="screen-title">${escapeHtml(article.title_jp)}</h2>
          <div class="muted">${escapeHtml(article.date_updated || article.date_written)}</div>
        </div>
        <div class="chips">${article.categories.map((category) => `<span class="chip">${escapeHtml(category)}</span>`).join("")}</div>
        <article class="article-body">${body}</article>
      </section>
    `);
    wireNav();
  }

  function renderPreview() {
    const raw = localStorage.getItem("WIKI_EDITOR_PREVIEW");
    if (!raw) {
      renderShell(window.I18N.t("APP_TITLE"), `${mainNav()}<section class="card"><p class="notice error">${escapeHtml(window.I18N.t("PREVIEW_EMPTY"))}</p></section>`);
      wireNav();
      return;
    }
    const article = window.WikiData.normalizeArticle(JSON.parse(raw));
    const body = window.WikiData.renderBody(article.body_jp, article.title_jp, state.publicArticles, window.WikiApi.imageBase);
    renderShell(`${window.I18N.t("PREVIEW")} - ${article.title_jp || window.I18N.t("UNTITLED")}`, `
      ${mainNav()}
      <section class="card stack detail-paper">
        <div class="status-pill draft">${escapeHtml(window.I18N.t("PREVIEW"))}</div>
        <h2 class="screen-title">${escapeHtml(article.title_jp || window.I18N.t("UNTITLED"))}</h2>
        <div class="chips">${article.categories.map((category) => `<span class="chip">${escapeHtml(category)}</span>`).join("")}</div>
        <article class="preview-body">${body}</article>
      </section>
    `);
    wireNav();
  }

  function renderArticleList(rows) {
    if (!rows.length) return `<div class="empty-state">${escapeHtml(window.I18N.t("NO_RESULTS"))}</div>`;
    return `
      <div class="article-list">
        ${rows.map((article) => `
          <a class="article-link" href="#detail/${encodeURIComponent(article.id)}">
            <strong>${escapeHtml(article.title_jp)}</strong>
            <span class="muted">${escapeHtml(article.category_jp)}</span>
          </a>
        `).join("")}
      </div>
    `;
  }

  function renderSearchResults(results) {
    if (!results.length) return `<div class="empty-state">${escapeHtml(window.I18N.t("NO_RESULTS"))}</div>`;
    return `
      <div class="article-list">
        ${results.map((result) => `
          <a class="article-link search-card ${result.kind === "title" ? "search-title-card" : "search-body-card"}" href="#detail/${encodeURIComponent(result.article.id)}">
            <span class="search-kind ${result.kind}">${escapeHtml(result.kind === "title" ? "\u30bf\u30a4\u30c8\u30eb\u4e00\u81f4" : "\u672c\u6587\u4e00\u81f4")}</span>
            <strong>${escapeHtml(result.article.title_jp)}</strong>
            <span class="muted">${escapeHtml(result.article.category_jp)}</span>
            ${result.kind === "body" ? `<span class="search-snippet">${result.snippet}</span>` : ""}
          </a>
        `).join("")}
      </div>
    `;
  }

  function buildSearchResults(query) {
    const normalizedQuery = query.toLowerCase();
    const titleMatches = [];
    const bodyMatches = [];

    for (const entry of state.searchIndex) {
      if (titleMatches.length + bodyMatches.length >= SEARCH_LIMIT) break;

      if (entry.titleLower.includes(normalizedQuery)) {
        titleMatches.push({ kind: "title", article: entry.article });
        if (titleMatches.length + bodyMatches.length >= SEARCH_LIMIT) break;
      }

      const bodyIndex = entry.bodyLower.indexOf(normalizedQuery);
      if (bodyIndex !== -1) {
        bodyMatches.push({
          kind: "body",
          article: entry.article,
          snippet: buildBodySnippet(entry.bodyPlain, bodyIndex, query),
        });
      }
    }

    return [...titleMatches, ...bodyMatches];
  }

  function buildBodySnippet(text, matchIndex, query) {
    const cleaned = String(text || "").replace(/\s+/g, " ").trim();
    const normalized = cleaned.toLowerCase();
    const normalizedQuery = String(query || "").toLowerCase();
    const safeIndex = normalized.indexOf(normalizedQuery);
    const index = safeIndex >= 0 ? safeIndex : matchIndex;
    const queryLength = String(query || "").length;
    const start = Math.max(0, index - 20);
    const end = Math.min(cleaned.length, index + queryLength + 20);
    const left = cleaned.slice(start, index);
    const match = cleaned.slice(index, index + queryLength);
    const right = cleaned.slice(index + queryLength, end);
    return [
      `<span class="muted">...</span>`,
      renderFadeText(left, "l"),
      `<span class="match">${escapeHtml(match)}</span>`,
      renderFadeText(right, "r"),
      `<span class="muted">...</span>`,
    ].join("");
  }

  function renderFadeText(text, side) {
    if (!text) return "";
    const chars = Array.from(text);
    const edge = side === "l" ? chars.slice(-3) : chars.slice(0, 3);
    const core = side === "l" ? chars.slice(0, -3) : chars.slice(3);
    const edgeHtml = edge.map((char, index) => {
      const rank = side === "l" ? edge.length - index : index + 1;
      return `<span class="fade-${side}${Math.min(rank, 3)}">${escapeHtml(char)}</span>`;
    }).join("");
    return side === "l"
      ? `${escapeHtml(core.join(""))}${edgeHtml}`
      : `${edgeHtml}${escapeHtml(core.join(""))}`;
  }

  function mainNav() {
    return `
      <section class="card" style="margin-bottom:16px;">
        <div class="row">
          <button class="btn btn-primary" data-nav="#toc">${escapeHtml(window.I18N.t("TOC"))}</button>
          <button class="btn btn-accent" data-nav="#index">${escapeHtml(window.I18N.t("INDEX"))}</button>
          <button class="btn btn-secondary" data-nav="#search">${escapeHtml(window.I18N.t("SEARCH"))}</button>
          <button class="btn btn-secondary" data-nav="#main">${escapeHtml(window.I18N.t("RETURN_MAIN"))}</button>
        </div>
      </section>
    `;
  }

  function wireNav() {
    document.querySelectorAll("[data-nav]").forEach((button) => {
      button.addEventListener("click", () => {
        location.hash = button.dataset.nav;
      });
    });
  }

  function stripTags(html) {
    return String(html || "").replace(/<[^>]*>/g, " ");
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
}());
