/**
 * T-186.3 — `bun run docs:check`.
 *
 * Checks the project documents without changing them: path pointers, referenced
 * IDs, the "Next" counters, twin file pairs (rule 12), and English naming.
 * Exit code 1 when there are findings, so it can run in pre-commit or CI.
 */
import path from "node:path";

import { formatFinding, runChecks } from "./docs/check";

const root = path.resolve(import.meta.dirname, "..");
const findings = runChecks(root);

for (const finding of findings) console.log(formatFinding(finding));
if (findings.length > 0) {
  console.error(`\ndocs:check: ${findings.length} findings.`);
  process.exit(1);
}
console.log("docs:check: no findings.");
