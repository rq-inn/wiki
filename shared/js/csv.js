window.CSV = {
  async load(url) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`CSV_FETCH_FAILED: ${url} (${response.status})`);
    return this.parse(await response.text());
  },

  parse(text) {
    if (typeof text !== "string") return [];
    const source = text.replace(/^\uFEFF/, "");
    const rows = [];
    let row = [];
    let cell = "";
    let inQuotes = false;

    for (let i = 0; i < source.length; i += 1) {
      const ch = source[i];
      const next = source[i + 1];
      if (ch === '"') {
        if (inQuotes && next === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (!inQuotes && ch === ",") {
        row.push(cell);
        cell = "";
        continue;
      }
      if (!inQuotes && (ch === "\n" || ch === "\r")) {
        if (ch === "\r" && next === "\n") i += 1;
        row.push(cell);
        if (!row.every((value) => String(value ?? "").trim() === "")) rows.push(row);
        row = [];
        cell = "";
        continue;
      }
      cell += ch;
    }

    row.push(cell);
    if (!row.every((value) => String(value ?? "").trim() === "")) rows.push(row);
    if (!rows.length) return [];

    const header = rows[0].map((value) => String(value ?? "").trim());
    return rows.slice(1).map((columns) => {
      const record = {};
      for (let i = 0; i < header.length; i += 1) {
        const key = header[i];
        if (!key) continue;
        record[key] = String(columns[i] ?? "");
      }
      return record;
    });
  },

  stringify(rows, headers) {
    const keys = Array.isArray(headers) && headers.length
      ? headers
      : Array.from(new Set((rows || []).flatMap((row) => Object.keys(row || {}))));
    const lines = [
      keys.join(","),
      ...(rows || []).map((row) => keys.map((key) => this.escapeCell(row?.[key] ?? "")).join(",")),
    ];
    return `${lines.join("\r\n")}\r\n`;
  },

  escapeCell(value) {
    const text = String(value ?? "");
    if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  },
};
