(function () {
  const STORAGE_KEY = "WIKI_API_BASE";
  const DEFAULT_FILE_API_BASE = "http://127.0.0.1:3000/api/wiki";

  function normalizeBase(value) {
    return String(value || "").trim().replace(/\/+$/, "");
  }

  function resolveApiBase() {
    const queryValue = new URLSearchParams(window.location.search).get("apiBase");
    const storedValue = window.localStorage.getItem(STORAGE_KEY);
    const explicitValue = normalizeBase(queryValue || storedValue || window.__WIKI_API_BASE__);

    if (explicitValue) {
      if (queryValue) {
        window.localStorage.setItem(STORAGE_KEY, explicitValue);
      }
      return explicitValue;
    }

    if (window.location.protocol === "file:") {
      return DEFAULT_FILE_API_BASE;
    }

    return "/api/wiki";
  }

  function toAbsoluteUrl(value) {
    try {
      return new URL(value, window.location.href).toString();
    } catch (_error) {
      return value;
    }
  }

  const apiBase = resolveApiBase();
  const apiBaseAbsolute = toAbsoluteUrl(apiBase);
  const serverRoot = apiBaseAbsolute.replace(/\/api\/wiki\/?$/, "");

  window.WikiApi = {
    storageKey: STORAGE_KEY,
    apiBase,
    apiBaseAbsolute,
    serverRoot,
    imageBase: `${serverRoot}/wiki/data/images`,
    buildUrl(pathname = "") {
      const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
      return `${apiBase}${normalizedPath}`;
    },
    rememberBase(nextBase) {
      const normalized = normalizeBase(nextBase);
      if (!normalized) return;
      window.localStorage.setItem(STORAGE_KEY, normalized);
    },
  };
}());
