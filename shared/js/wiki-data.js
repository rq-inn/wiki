(function () {
  const CSV_HEADERS = [
    "date_written",
    "date_updated",
    "situation",
    "sort_order",
    "category_jp",
    "title_jp",
    "title_jp_read",
    "body_jp",
  ];

  const KANA_GROUPS = [
    { key: "all", chars: [] },
    { key: "a", chars: ["\u3042", "\u3044", "\u3046", "\u3048", "\u304a"] },
    { key: "ka", chars: ["\u304b", "\u304d", "\u304f", "\u3051", "\u3053", "\u304c", "\u304e", "\u3050", "\u3052", "\u3054"] },
    { key: "sa", chars: ["\u3055", "\u3057", "\u3059", "\u305b", "\u305d", "\u3056", "\u3058", "\u305a", "\u305c", "\u305e"] },
    { key: "ta", chars: ["\u305f", "\u3061", "\u3064", "\u3066", "\u3068", "\u3060", "\u3062", "\u3065", "\u3067", "\u3069"] },
    { key: "na", chars: ["\u306a", "\u306b", "\u306c", "\u306d", "\u306e"] },
    { key: "ha", chars: ["\u306f", "\u3072", "\u3075", "\u3078", "\u307b", "\u3070", "\u3073", "\u3076", "\u3079", "\u307c", "\u3071", "\u3074", "\u3077", "\u307a", "\u307d"] },
    { key: "ma", chars: ["\u307e", "\u307f", "\u3080", "\u3081", "\u3082"] },
    { key: "ya", chars: ["\u3084", "\u3086", "\u3088"] },
    { key: "ra", chars: ["\u3089", "\u308a", "\u308b", "\u308c", "\u308d"] },
    { key: "wa", chars: ["\u308f", "\u3092", "\u3093"] },
    { key: "other", chars: [] },
  ];

  function normalizeHiragana(value) {
    return String(value || "")
      .trim()
      .replace(/[\u30A1-\u30F6]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60));
  }

  function normalizeArticle(row) {
    const article = {};
    for (const key of CSV_HEADERS) {
      article[key] = String(row?.[key] ?? "");
    }
    article.id = article.date_written || `id-${Math.random().toString(36).slice(2)}`;
    article.sort_order = article.sort_order || "9999";
    article.categories = article.category_jp
      .split(/\u3000+/)
      .map((value) => value.trim())
      .filter(Boolean);
    article.reading = normalizeHiragana(article.title_jp_read || article.title_jp);
    return article;
  }

  function sortArticles(rows) {
    return [...rows].sort((a, b) => {
      const orderDiff = Number(a.sort_order || 9999) - Number(b.sort_order || 9999);
      if (orderDiff !== 0) return orderDiff;
      return a.title_jp.localeCompare(b.title_jp, "ja");
    });
  }

  function sortForIndex(rows) {
    return [...rows].sort((a, b) => {
      const readDiff = a.reading.localeCompare(b.reading, "ja");
      if (readDiff !== 0) return readDiff;
      return a.title_jp.localeCompare(b.title_jp, "ja");
    });
  }

  function detectKanaGroup(reading) {
    const first = normalizeHiragana(reading).charAt(0);
    if (!first) return "other";
    for (const group of KANA_GROUPS) {
      if (group.key !== "all" && group.key !== "other" && group.chars.includes(first)) {
        return group.key;
      }
    }
    return "other";
  }

  function collectCategories(rows) {
    return Array.from(new Set(rows.flatMap((row) => row.categories))).sort((a, b) => a.localeCompare(b, "ja"));
  }

  function createTimestamp(date = new Date()) {
    const pad = (value) => String(value).padStart(2, "0");
    return [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate()),
      pad(date.getHours()),
      pad(date.getMinutes()),
    ].join("");
  }

  function toIsoLocal(date = new Date()) {
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
  }

  function renderBody(bodyHtml, currentTitle, articles, imageBasePath) {
    const source = String(bodyHtml || "");
    const candidates = sortForIndex(articles.filter((article) => article.title_jp && article.title_jp !== currentTitle))
      .sort((a, b) => b.title_jp.length - a.title_jp.length);
    const linkedTitles = new Set();
    const parts = source.split(/(<[^>]+>)/g).filter(Boolean);
    let insideAnchor = false;

    return parts.map((part) => {
      if (part.startsWith("<")) {
        if (/^<a\b/i.test(part)) insideAnchor = true;
        if (/^<\/a>/i.test(part)) insideAnchor = false;
        return part;
      }
      return transformTextSegment(part, insideAnchor);
    }).join("");

    function transformTextSegment(text, isInsideAnchor) {
      const tokens = text.split(/(\[image:[^\]\r\n]+\])/gi).filter(Boolean);
      return tokens.map((token) => {
        const match = token.match(/^\[image:([^\]\r\n]+)\]$/i);
        if (match) {
          const safeName = String(match[1]).trim();
          if (!safeName) return "";
          return `<img src="${imageBasePath}/${encodeURIComponent(safeName)}" alt="${safeName}">`;
        }
        if (isInsideAnchor || !token) return token;

        let result = "";
        let cursor = 0;
        while (cursor < token.length) {
          let winner = null;
          for (const article of candidates) {
            if (linkedTitles.has(article.title_jp)) continue;
            const position = token.indexOf(article.title_jp, cursor);
            if (position === -1) continue;
            if (!winner || position < winner.position || (position === winner.position && article.title_jp.length > winner.article.title_jp.length)) {
              winner = { article, position };
            }
          }
          if (!winner) {
            result += token.slice(cursor);
            break;
          }
          result += token.slice(cursor, winner.position);
          result += `<a href="#detail/${encodeURIComponent(winner.article.id)}">${winner.article.title_jp}</a>`;
          linkedTitles.add(winner.article.title_jp);
          cursor = winner.position + winner.article.title_jp.length;
        }
        return result;
      }).join("");
    }
  }

  async function blobToJpeg(file) {
    if (!("createImageBitmap" in window)) return file;
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    context.drawImage(bitmap, 0, 0);
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob || file), "image/jpeg", 0.92);
    });
  }

  function slugifyTitle(title) {
    const compact = String(title || "").trim().replace(/\s+/g, "-");
    const sanitized = compact.replace(/[\\/:*?"<>|]/g, "").slice(0, 32);
    return sanitized || "article";
  }

  function extractImageNames(body) {
    return Array.from(String(body || "").matchAll(/\[image:([^\]\r\n]+)\]/gi), (match) => match[1].trim()).filter(Boolean);
  }

  window.WikiData = {
    CSV_HEADERS,
    KANA_GROUPS,
    normalizeArticle,
    sortArticles,
    sortForIndex,
    detectKanaGroup,
    collectCategories,
    createTimestamp,
    toIsoLocal,
    renderBody,
    blobToJpeg,
    slugifyTitle,
    extractImageNames,
  };
}());
