(function () {
  const PASSWORD = "ST1625";
  const MAX_FAILURES = 3;
  const LOCK_MINUTES = 30;
  const LOCK_KEY = "WIKI_EDITOR_LOCK_UNTIL";
  const FAILURE_KEY = "WIKI_EDITOR_FAILURES";
  const PREVIEW_KEY = "WIKI_EDITOR_PREVIEW";
  const API_BASE = window.WikiApi?.apiBase || "/api/wiki";

  const app = document.getElementById("app");
  const state = {
    auth: false,
    apiAvailable: false,
    articles: [],
    dirtyOrder: false,
    screen: "auth",
    selectedId: null,
    notice: "",
    error: "",
  };

  init().catch((error) => {
    console.error(error);
    app.innerHTML = `<section class="card"><p class="notice error">${escapeHtml(String(error.message || error))}</p></section>`;
  });

  async function init() {
    await window.I18N.init("../data/csv");
    await refreshArticles();
    render();
  }

  async function refreshArticles() {
    clearMessages();
    try {
      state.apiAvailable = await checkApiHealth();
      if (state.apiAvailable) {
        const rows = await apiFetchJson(window.WikiApi.buildUrl("/articles"));
        state.articles = window.WikiData.sortArticles(rows.map(window.WikiData.normalizeArticle));
        return;
      }
    } catch (error) {
      console.warn("API fetch failed, fallback to local csv", error);
      state.apiAvailable = false;
    }

    const rows = await window.CSV.load("../data/csv/wikitxt.csv");
    state.articles = window.WikiData.sortArticles(rows.map(window.WikiData.normalizeArticle));
  }

  function render() {
    if (!state.auth) return renderAuth();
    if (state.screen === "edit") return renderEditor();
    if (state.screen === "list") return renderList();
    return renderHome();
  }

  function renderShell(title, body, options = {}) {
    const showHero = options.showHero !== false;
    app.innerHTML = `
      ${showHero ? `
        <section class="hero">
          <div class="brand">
            <img src="../icon/yelmalio-192.png" alt="Editor">
            <div class="stack" style="gap:6px;">
              <h1>${escapeHtml(title)}</h1>
              <div class="lede">${escapeHtml(window.I18N.t("EDITOR_SUBTITLE"))}</div>
            </div>
          </div>
        </section>
      ` : ""}
      ${state.notice ? `<p class="notice">${escapeHtml(state.notice)}</p>` : ""}
      ${state.error ? `<p class="notice error">${escapeHtml(state.error)}</p>` : ""}
      ${body}
    `;
  }

  function renderAuth() {
    const lockUntil = Number(localStorage.getItem(LOCK_KEY) || 0);
    const locked = Date.now() < lockUntil;
    const remaining = locked ? Math.ceil((lockUntil - Date.now()) / 60000) : 0;

    renderShell(window.I18N.t("EDITOR_LOGIN"), `
      <section class="card stack login-card" style="max-width:540px; margin:0 auto;">
        <div class="login-mark">
          <img src="../icon/yelmalio-192.png" alt="Yelmalio emblem">
        </div>
        <h2 class="screen-title">${escapeHtml(window.I18N.t("EDITOR_LOGIN"))}</h2>
        <p class="lede">${escapeHtml(window.I18N.t("EDITOR_LOGIN_BODY"))}</p>
        <label>
          <span class="field-label">${escapeHtml(window.I18N.t("PASSWORD"))}</span>
          <input class="input" id="passwordInput" type="password" ${locked ? "disabled" : ""}>
        </label>
        ${locked ? `<div class="notice error">${escapeHtml(window.I18N.t("LOCKED_MESSAGE").replace("{minutes}", String(remaining)))}</div>` : ""}
        <div class="row">
          <button class="btn btn-primary" id="loginButton" ${locked ? "disabled" : ""}>${escapeHtml(window.I18N.t("LOGIN"))}</button>
        </div>
      </section>
    `, { showHero: false });

    document.getElementById("loginButton")?.addEventListener("click", tryLogin);
    document.getElementById("passwordInput")?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") tryLogin();
    });
  }

  function renderHome() {
    renderShell(window.I18N.t("EDITOR_HOME"), `
      <section class="card stack">
        <div class="row">
          <button class="btn btn-primary" id="newArticleButton">${escapeHtml(window.I18N.t("NEW_ARTICLE"))}</button>
          <button class="btn btn-secondary" id="listButton">${escapeHtml(window.I18N.t("ARTICLE_LIST"))}</button>
          <button class="btn btn-accent" id="reloadButton">${escapeHtml(window.I18N.t("SERVER_RELOAD"))}</button>
        </div>
        <div class="status-pill ${state.apiAvailable ? "public" : "draft"}">
          ${escapeHtml(state.apiAvailable ? window.I18N.t("SERVER_CONNECTED") : window.I18N.t("SERVER_DISCONNECTED"))}
        </div>
      </section>
    `);

    document.getElementById("newArticleButton").addEventListener("click", () => {
      state.selectedId = null;
      state.screen = "edit";
      clearMessages();
      render();
    });
    document.getElementById("listButton").addEventListener("click", () => {
      state.screen = "list";
      clearMessages();
      render();
    });
    document.getElementById("reloadButton").addEventListener("click", async () => {
      await refreshArticles();
      state.notice = state.apiAvailable ? window.I18N.t("SERVER_CONNECTED") : window.I18N.t("SERVER_DISCONNECTED");
      render();
    });
  }

  function renderList() {
    renderShell(window.I18N.t("ARTICLE_LIST"), `
      <section class="card stack">
        <div class="row between center">
          <h2 class="screen-title">${escapeHtml(window.I18N.t("ARTICLE_LIST"))}</h2>
          <div class="row">
            <button class="btn ${state.dirtyOrder ? "btn-save-dirty" : "btn-secondary"}" id="saveOrderButton">${escapeHtml(window.I18N.t("SAVE_ORDER"))}</button>
            <button class="btn btn-secondary" id="reloadButton">${escapeHtml(window.I18N.t("SERVER_RELOAD"))}</button>
            <button class="btn btn-secondary" id="backHomeButton">${escapeHtml(window.I18N.t("BACK"))}</button>
          </div>
        </div>
        <div class="stack" id="articleCards">
          ${state.articles.length ? state.articles.map(renderCard).join("") : `<div class="empty-state">${escapeHtml(window.I18N.t("NO_RESULTS"))}</div>`}
        </div>
      </section>
    `);

    document.getElementById("backHomeButton").addEventListener("click", () => {
      state.screen = "home";
      clearMessages();
      render();
    });
    document.getElementById("reloadButton").addEventListener("click", async () => {
      await refreshArticles();
      render();
    });
    document.getElementById("saveOrderButton").addEventListener("click", saveOrder);
    wireCardEvents();
  }

  function renderCard(article, index) {
    return `
      <article class="editor-card" draggable="true" data-id="${escapeHtml(article.id)}" data-index="${index}">
        <div class="row between center">
          <div class="drag-handle">::</div>
          <div class="status-pill ${article.situation === "public" ? "public" : "draft"}">${escapeHtml(getStatusLabel(article.situation || "draft"))}</div>
        </div>
        <div class="stack" style="gap:8px; margin-top:10px;">
          <strong>${escapeHtml(article.title_jp || window.I18N.t("UNTITLED"))}</strong>
          <div class="muted">${escapeHtml(article.category_jp)}</div>
          <div class="muted">sort_order: ${escapeHtml(article.sort_order)}</div>
        </div>
      </article>
    `;
  }

  function renderEditor() {
    const article = getCurrentArticle();
    renderShell(article.title_jp || window.I18N.t("EDITOR_EDIT"), `
      <section class="card stack">
        <div class="row between center">
          <h2 class="screen-title">${escapeHtml(article.title_jp || window.I18N.t("EDITOR_EDIT"))}</h2>
          <div class="row">
            <button class="btn btn-secondary" id="previewButton">${escapeHtml(window.I18N.t("PREVIEW"))}</button>
            <button class="btn btn-primary" id="saveButton">${escapeHtml(window.I18N.t("SAVE"))}</button>
            <button class="btn btn-accent" id="publishButton">${escapeHtml(window.I18N.t("PUBLISH"))}</button>
            <button class="btn btn-secondary" id="backButton">${escapeHtml(window.I18N.t("BACK"))}</button>
            ${state.selectedId ? `<button class="btn btn-danger" id="deleteButton">${escapeHtml(window.I18N.t("DELETE"))}</button>` : ""}
          </div>
        </div>
        <div class="status-pill ${state.apiAvailable ? "public" : "draft"}">
          ${escapeHtml(state.apiAvailable ? window.I18N.t("SERVER_CONNECTED") : window.I18N.t("SERVER_DISCONNECTED"))}
        </div>
        <div class="grid columns-2">
          <label>
            <span class="field-label">${escapeHtml(window.I18N.t("TITLE"))}</span>
            <input class="input" id="titleInput" value="${escapeHtml(article.title_jp)}">
          </label>
          <label>
            <span class="field-label">${escapeHtml(window.I18N.t("TITLE_READ"))}</span>
            <input class="input" id="readingInput" value="${escapeHtml(article.title_jp_read)}">
          </label>
          <label>
            <span class="field-label">${escapeHtml(window.I18N.t("CATEGORY"))}</span>
            <input class="input" id="categoryInput" value="${escapeHtml(article.category_jp)}" placeholder="Category1　Category2">
          </label>
          <label>
            <span class="field-label">${escapeHtml(window.I18N.t("STATUS"))}</span>
            <select class="select" id="statusInput">
              <option value="draft"${article.situation !== "public" ? " selected" : ""}>下書き</option>
              <option value="public"${article.situation === "public" ? " selected" : ""}>公開</option>
            </select>
          </label>
        </div>
        <div class="toolbar">
          <button class="btn btn-secondary" data-cmd="justifyLeft">${escapeHtml(window.I18N.t("ALIGN_LEFT"))}</button>
          <button class="btn btn-secondary" data-cmd="justifyCenter">${escapeHtml(window.I18N.t("ALIGN_CENTER"))}</button>
          <button class="btn btn-secondary" data-cmd="justifyRight">${escapeHtml(window.I18N.t("ALIGN_RIGHT"))}</button>
          <button class="btn btn-secondary" data-block="h1">${escapeHtml(window.I18N.t("HEADING_L"))}</button>
          <button class="btn btn-secondary" data-block="h2">${escapeHtml(window.I18N.t("HEADING_M"))}</button>
          <button class="btn btn-secondary" data-block="h3">${escapeHtml(window.I18N.t("HEADING_S"))}</button>
          <button class="btn btn-secondary" data-cmd="bold">${escapeHtml(window.I18N.t("BOLD"))}</button>
          <button class="btn btn-secondary" id="linkButton">${escapeHtml(window.I18N.t("LINK"))}</button>
          <button class="btn btn-secondary" data-cmd="insertUnorderedList">${escapeHtml(window.I18N.t("BULLET_LIST"))}</button>
          <button class="btn btn-secondary" data-cmd="insertOrderedList">${escapeHtml(window.I18N.t("NUMBER_LIST"))}</button>
          <button class="btn btn-secondary" id="imageButton">${escapeHtml(window.I18N.t("INSERT_IMAGE"))}</button>
        </div>
        <div id="editorSurface" class="editor-surface" contenteditable="true">${article.body_jp}</div>
      </section>
    `);

    document.getElementById("previewButton").addEventListener("click", previewArticle);
    document.getElementById("saveButton").addEventListener("click", () => saveArticle(false));
    document.getElementById("publishButton").addEventListener("click", () => saveArticle(true));
    document.getElementById("backButton").addEventListener("click", () => {
      state.screen = "list";
      clearMessages();
      render();
    });
    document.getElementById("deleteButton")?.addEventListener("click", deleteArticle);
    document.querySelectorAll("[data-cmd]").forEach((button) => {
      button.addEventListener("click", () => document.execCommand(button.dataset.cmd, false, null));
    });
    document.querySelectorAll("[data-block]").forEach((button) => {
      button.addEventListener("click", () => document.execCommand("formatBlock", false, button.dataset.block));
    });
    document.getElementById("linkButton").addEventListener("click", () => {
      const url = prompt(window.I18N.t("LINK_PROMPT"), "https://");
      if (url) document.execCommand("createLink", false, url);
    });
    document.getElementById("imageButton").addEventListener("click", insertImage);
  }

  function tryLogin() {
    clearMessages();
    const lockUntil = Number(localStorage.getItem(LOCK_KEY) || 0);
    if (Date.now() < lockUntil) {
      state.error = window.I18N.t("LOCKED_MESSAGE").replace("{minutes}", String(Math.ceil((lockUntil - Date.now()) / 60000)));
      return render();
    }

    const input = document.getElementById("passwordInput");
    if (input.value === PASSWORD) {
      state.auth = true;
      state.screen = "home";
      localStorage.removeItem(FAILURE_KEY);
      localStorage.removeItem(LOCK_KEY);
      return render();
    }

    const failures = Number(localStorage.getItem(FAILURE_KEY) || 0) + 1;
    localStorage.setItem(FAILURE_KEY, String(failures));
    if (failures >= MAX_FAILURES) {
      localStorage.setItem(LOCK_KEY, String(Date.now() + LOCK_MINUTES * 60 * 1000));
      localStorage.setItem(FAILURE_KEY, "0");
      state.error = window.I18N.t("LOCKED_MESSAGE").replace("{minutes}", String(LOCK_MINUTES));
    } else {
      state.error = window.I18N.t("LOGIN_FAILED").replace("{count}", String(failures));
    }
    render();
  }

  function getCurrentArticle() {
    if (!state.selectedId) {
      const now = window.WikiData.toIsoLocal();
      return {
        date_written: now,
        date_updated: now,
        situation: "draft",
        sort_order: String((state.articles.length + 1) * 10),
        category_jp: "",
        title_jp: "",
        title_jp_read: "",
        body_jp: "<p></p>",
      };
    }

    return state.articles.find((article) => article.id === state.selectedId) || {
      date_written: window.WikiData.toIsoLocal(),
      date_updated: window.WikiData.toIsoLocal(),
      situation: "draft",
      sort_order: "10",
      category_jp: "",
      title_jp: "",
      title_jp_read: "",
      body_jp: "<p></p>",
    };
  }

  function buildArticleFromForm(forcePublic) {
    const existing = getCurrentArticle();
    return window.WikiData.normalizeArticle({
      date_written: existing.date_written || window.WikiData.toIsoLocal(),
      date_updated: window.WikiData.toIsoLocal(),
      situation: forcePublic ? "public" : document.getElementById("statusInput").value,
      sort_order: existing.sort_order || "10",
      category_jp: document.getElementById("categoryInput").value.trim(),
      title_jp: document.getElementById("titleInput").value.trim(),
      title_jp_read: document.getElementById("readingInput").value.trim(),
      body_jp: sanitizeEditorHtml(document.getElementById("editorSurface").innerHTML),
    });
  }

  async function saveArticle(forcePublic) {
    clearMessages();
    const draft = buildArticleFromForm(forcePublic);
    if (!draft.title_jp) {
      state.error = window.I18N.t("TITLE_REQUIRED");
      return render();
    }
    if (!state.apiAvailable) {
      state.error = window.I18N.t("SERVER_REQUIRED");
      return render();
    }
    if (state.selectedId && !confirm(window.I18N.t("OVERWRITE_CONFIRM"))) return;

    const nextArticles = [...state.articles];
    const index = nextArticles.findIndex((article) => article.id === state.selectedId);
    if (index >= 0) nextArticles[index] = draft;
    else {
      nextArticles.push(draft);
      state.selectedId = draft.id;
    }

    await persistArticles(nextArticles);
    await refreshArticles();
    state.notice = forcePublic ? window.I18N.t("PUBLISHED") : window.I18N.t("SAVED");
    state.screen = "list";
    render();
  }

  async function persistArticles(articles) {
    const rows = window.WikiData.sortArticles(articles).map((article, index) => ({
      date_written: article.date_written,
      date_updated: article.date_updated,
      situation: article.situation,
      sort_order: String((index + 1) * 10),
      category_jp: article.category_jp,
      title_jp: article.title_jp,
      title_jp_read: article.title_jp_read,
      body_jp: article.body_jp,
    }));

    await apiFetchJson(window.WikiApi.buildUrl("/articles"), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ articles: rows }),
    });
  }

  async function saveOrder() {
    clearMessages();
    if (!state.dirtyOrder) {
      state.notice = window.I18N.t("ORDER_UNCHANGED");
      return render();
    }
    if (!state.apiAvailable) {
      state.error = window.I18N.t("SERVER_REQUIRED");
      return render();
    }
    await persistArticles(state.articles);
    await refreshArticles();
    state.dirtyOrder = false;
    state.notice = window.I18N.t("ORDER_SAVED");
    render();
  }

  async function deleteArticle() {
    clearMessages();
    if (!state.selectedId || !confirm(window.I18N.t("DELETE_CONFIRM"))) return;
    if (!state.apiAvailable) {
      state.error = window.I18N.t("SERVER_REQUIRED");
      return render();
    }

    const article = getCurrentArticle();
    const nextArticles = state.articles.filter((row) => row.id !== state.selectedId);

    await apiFetchJson(window.WikiApi.buildUrl("/article-delete"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        articles: nextArticles.map((item, index) => ({
          date_written: item.date_written,
          date_updated: item.date_updated,
          situation: item.situation,
          sort_order: String((index + 1) * 10),
          category_jp: item.category_jp,
          title_jp: item.title_jp,
          title_jp_read: item.title_jp_read,
          body_jp: item.body_jp,
        })),
        deleteImages: window.WikiData.extractImageNames(article.body_jp),
      }),
    });

    await refreshArticles();
    state.selectedId = null;
    state.screen = "list";
    state.notice = window.I18N.t("DELETED");
    render();
  }

  function previewArticle() {
    const draft = buildArticleFromForm(false);
    localStorage.setItem(PREVIEW_KEY, JSON.stringify(draft));
    window.open("../index.html#preview", "_blank", "noopener");
  }

  async function insertImage() {
    clearMessages();
    if (!state.apiAvailable) {
      state.error = window.I18N.t("SERVER_REQUIRED");
      return render();
    }

    const picker = document.createElement("input");
    picker.type = "file";
    picker.accept = "image/*";
    picker.addEventListener("change", async () => {
      const file = picker.files?.[0];
      if (!file) return;

      const fileName = `${window.WikiData.createTimestamp()}_${window.WikiData.slugifyTitle(document.getElementById("titleInput").value.trim())}.jpg`;
      const jpegBlob = await window.WikiData.blobToJpeg(file);
      const dataUrl = await blobToDataUrl(jpegBlob);

      await apiFetchJson(window.WikiApi.buildUrl("/image-upload"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName, dataUrl }),
      });

      document.getElementById("editorSurface").focus();
      document.execCommand("insertText", false, `[image:${fileName}]`);
      alert(window.I18N.t("IMAGE_INSERTED").replace("{name}", fileName));
    }, { once: true });
    picker.click();
  }

  function wireCardEvents() {
    const container = document.getElementById("articleCards");
    let draggedId = null;

    container.querySelectorAll(".editor-card").forEach((card) => {
      card.addEventListener("click", () => {
        state.selectedId = card.dataset.id;
        state.screen = "edit";
        clearMessages();
        render();
      });
      card.addEventListener("dragstart", () => {
        draggedId = card.dataset.id;
        card.classList.add("dragging");
      });
      card.addEventListener("dragend", () => card.classList.remove("dragging"));
      card.addEventListener("dragover", (event) => event.preventDefault());
      card.addEventListener("drop", (event) => {
        event.preventDefault();
        const targetId = card.dataset.id;
        if (!draggedId || draggedId === targetId) return;
        const fromIndex = state.articles.findIndex((article) => article.id === draggedId);
        const toIndex = state.articles.findIndex((article) => article.id === targetId);
        const reordered = [...state.articles];
        const [moved] = reordered.splice(fromIndex, 1);
        reordered.splice(toIndex, 0, moved);
        state.articles = reordered.map((article, index) => ({ ...article, sort_order: String((index + 1) * 10) }));
        state.dirtyOrder = true;
        renderList();
      });
    });
  }

  function sanitizeEditorHtml(html) {
    return String(html || "")
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
      .replace(/\son\w+="[^"]*"/gi, "")
      .trim();
  }

  async function checkApiHealth() {
    try {
      const response = await fetch(window.WikiApi.buildUrl("/health"), { cache: "no-store" });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  async function apiFetchJson(url, options) {
    const response = await fetch(url, {
      cache: "no-store",
      ...options,
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `API request failed: ${response.status}`);
    }
    return response.json();
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("FILE_READ_FAILED"));
      reader.readAsDataURL(blob);
    });
  }

  function clearMessages() {
    state.notice = "";
    state.error = "";
  }

  function getStatusLabel(status) {
    return status === "public" ? "公開" : "下書き";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
}());
