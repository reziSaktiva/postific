/**
 * T-186.2 — `bun run docs:where <query>`.
 *
 * Mengembalikan `path:baris` untuk ID (T-186, ADR-133, S-003, KSP-12, CI-D03)
 * atau kata kunci judul, supaya bagian dokumen dibaca dengan `offset`/`limit`
 * tanpa membuka seluruh berkas. Nol token: dihitung dari dokumen saat dijalankan.
 */
import path from "node:path";

import { loadCorpus, loadDefinitions } from "./docs/corpus";
import { formatMatch, locate } from "./docs/locate";

const query = process.argv.slice(2).join(" ").trim();
if (!query) {
  console.error("Pemakaian: bun run docs:where <ID atau kata kunci judul>");
  process.exit(2);
}

const root = path.resolve(import.meta.dirname, "..");
const { matches, truncated } = locate(loadDefinitions(loadCorpus(root)), query);

if (matches.length === 0) {
  console.error(`Tidak ditemukan: ${query}`);
  process.exit(1);
}
for (const match of matches) console.log(formatMatch(match));
if (truncated > 0) {
  console.log(`... ${truncated} hasil lain; persempit kata kunci.`);
}
