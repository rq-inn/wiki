(function () {
  function register(options = {}) {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const swPath = options.swPath || "/wiki/sw.js";
    const scope = options.scope || "/wiki/";

    window.addEventListener("load", function () {
      navigator.serviceWorker.register(swPath, { scope }).catch(function (error) {
        console.error("[wiki_pwa] service worker registration failed", error);
      });
    });
  }

  window.WikiPwa = {
    register,
  };
}());
