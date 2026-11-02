/**
 * T-186.3 — `bun run docs:check`.
 *
 * Memeriksa dokumen project tanpa mengubahnya: penunjuk path, ID yang dirujuk,
 * penghitung "Berikutnya", pasangan file kembar (aturan 12), dan penamaan Inggris.
 * Exit code 1 bila ada temuan, supaya bisa dipasang di pre-commit atau CI.
 */
import path from "node:path";

import { formatFinding, runChecks } from "./docs/check";

const root = path.resolve(import.meta.dirname, "..");
const findings = runChecks(root);

for (const finding of findings) console.log(formatFinding(finding));
if (findings.length > 0) {
  console.error(`\ndocs:check: ${findings.length} temuan.`);
  process.exit(1);
}
console.log("docs:check: tidak ada temuan.");
