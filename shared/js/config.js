(function () {
  const DEFAULT_ASSET_BASE = "https://rq-inn.com/wiki";
  const DEFAULT_API_BASE = "https://rq-inn.com/api/wiki";

  function normalizeBase(value) {
    return String(value || "").trim().replace(/\/+$/, "");
  }

  const assetBase = normalizeBase(window.__WIKI_ASSET_BASE__ || DEFAULT_ASSET_BASE);
  const apiBase = normalizeBase(window.__WIKI_API_BASE__ || DEFAULT_API_BASE);

  window.__WIKI_ASSET_BASE__ = assetBase;
  window.__WIKI_API_BASE__ = apiBase;

  window.WikiAssets = {
    assetBase,
    dataCsvBase: `${assetBase}/data/csv`,
    iconBase: `${assetBase}/icon`,
    sharedJsBase: `${assetBase}/shared/js`,
    viewerJsBase: `${assetBase}/viewer/js`,
    cssBase: `${assetBase}/css`,
    toUrl(pathname = "") {
      const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
      return `${assetBase}${normalizedPath}`;
    },
  };
}());
