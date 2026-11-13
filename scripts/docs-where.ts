/**
 * T-186.2 — `bun run docs:where <query>`.
 *
 * Returns `path:line` for an ID (T-186, ADR-133, S-003, KSP-12, CI-D03) or a
 * title keyword, so a document section can be read with `offset`/`limit`
 * without opening the whole file. Zero tokens: computed from the documents at run time.
 */
import path from "node:path";

import { loadCorpus, loadDefinitions } from "./docs/corpus";
import { formatMatch, locate } from "./docs/locate";

const query = process.argv.slice(2).join(" ").trim();
if (!query) {
  console.error("Usage: bun run docs:where <ID or title keyword>");
  process.exit(2);
}

const root = path.resolve(import.meta.dirname, "..");
const { matches, truncated } = locate(loadDefinitions(loadCorpus(root)), query);

if (matches.length === 0) {
  console.error(`Not found: ${query}`);
  process.exit(1);
}
for (const match of matches) console.log(formatMatch(match));
if (truncated > 0) {
  console.log(`... ${truncated} more results; narrow the keyword.`);
}
