window.I18N = {
  current: "L2",
  messages: {},
  languages: [],

  async init(basePath = window.WikiAssets?.dataCsvBase || "../data/csv") {
    const [languages, messages] = await Promise.all([
      window.CSV.load(`${basePath}/language.csv`),
      window.CSV.load(`${basePath}/message.csv`),
    ]);
    this.languages = languages;
    this.messages = {};
    for (const row of messages) {
      const key = String(row.key || "").trim();
      if (!key) continue;
      this.messages[key] = row;
    }
    const stored = localStorage.getItem("WIKI_LANG");
    if (stored && languages.some((row) => row.number === stored)) {
      this.current = stored;
    } else if (languages.some((row) => row.number === "L2")) {
      this.current = "L2";
    } else if (languages[0]?.number) {
      this.current = languages[0].number;
    }
  },

  setLanguage(code) {
    if (!this.languages.some((row) => row.number === code)) return;
    this.current = code;
    localStorage.setItem("WIKI_LANG", code);
    window.dispatchEvent(new CustomEvent("WIKI_LANG_CHANGED", { detail: { code } }));
  },

  t(key) {
    const row = this.messages[key];
    if (!row) return key;
    return row[`name_${this.current}`] || row.name_L2 || row.name_L1 || key;
  },
};
