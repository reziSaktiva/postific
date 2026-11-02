/**
 * T-186.3 — pemeriksa dokumen. `runChecks(root)` membaca disk lewat `corpus.ts`
 * dan mengembalikan temuan `path:baris`; tidak mengubah berkas apa pun.
 *
 * Pemeriksaan: (1) penunjuk path valid, (2) ID yang dirujuk ada, (3) penghitung
 * "Berikutnya" = ID maksimum + 1, (4) pasangan kembar aturan 12 (AGENTS.md) tidak
 * menyimpang, (5) nama folder skill dan judul tiket baru berbahasa Inggris (S-003).
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { type Doc, loadCorpus, loadDefinitions, vendorSkills } from "./corpus";
import {
  type Definition,
  parsePointers,
  parseReferences,
  titleProse,
} from "./parse";

export interface Finding {
  rule:
    | "pointer"
    | "id-ref"
    | "counter"
    | "twin-pair"
    | "naming-skill"
    | "naming-title";
  path: string;
  line: number;
  message: string;
}

/**
 * Aturan penamaan Inggris berlaku untuk tiket baru: ID mulai di sini
 * (T-181 = tiket pertama setelah S-003 menetapkan aturannya). Tiket lama
 * berjudul Indonesia dan tidak diganti namanya (ID tidak didaur ulang).
 */
export const ENGLISH_TITLES_FROM_TICKET = 181;

/** Awalan ID yang tidak diperiksa keberadaannya: KI yang selesai dihapus dari daftar (ADR-067). */
const UNCHECKED_PREFIXES = new Set(["KI"]);

/**
 * ID yang sengaja dirujuk tanpa definisi (T-186.5, disetujui King Rezi 2026-11-02):
 * JOB-05 dan JOB-06 dicadangkan ADR-093 untuk Import Posts, UXP-08 adalah usulan
 * ID baru di ADR-049, T-049 sengaja dikosongkan di v03.
 */
const RESERVED_IDS = new Set(["JOB-05", "JOB-06", "UXP-08", "T-049"]);

/**
 * Penunjuk yang sengaja menunjuk berkas yang tidak ada (T-186.5): langkah
 * "Update CHANGELOG" di design-tokens.md dibiarkan karena menggantinya mengubah maknanya.
 */
const ALLOWED_POINTERS = new Set([
  "product-discovery/06-engineering/design-tokens.md→../../project-os/CHANGELOG.md",
]);

/** Dokumen yang menjadi sumber kebenaran penunjuk (bukan catatan historis). */
function inPointerScope(docPath: string): boolean {
  return (
    !/^project-os\/(decisions|tickets|reports|specs)\//.test(docPath) &&
    docPath !== "project-os/CONVERSATIONS.md" &&
    docPath !== "project-os/DECISIONS.md"
  );
}

/** Kata fungsi dan kata kerja Indonesia yang tidak muncul di judul berbahasa Inggris. */
const INDONESIAN_WORDS = new Set([
  "yang",
  "dan",
  "di",
  "ke",
  "dari",
  "untuk",
  "dengan",
  "tidak",
  "atau",
  "pada",
  "dalam",
  "saat",
  "setelah",
  "sebelum",
  "tanpa",
  "agar",
  "belum",
  "sudah",
  "bila",
  "jika",
  "oleh",
  "lintas",
  "hapus",
  "buat",
  "tambah",
  "ubah",
  "pasang",
  "putuskan",
  "periksa",
  "siapkan",
  "jalankan",
  "pakai",
  "aturan",
  "gelombang",
  "tiket",
  "bersihkan",
  "selaraskan",
  "pantau",
  "perbaikan",
  "tindak",
  "lanjut",
  "lanjutan",
  "kembali",
  "semua",
  "sisa",
  "baru",
  "lama",
  "masuk",
  "keluar",
  "tampil",
  "tampilkan",
  "hapuskan",
  "ganti",
  "uji",
  "tes",
  "kedipan",
  "terang",
  "gelap",
  "halaman",
  "kustom",
  "mengikuti",
  "pengguna",
  "zona",
  "terapkan",
  "kerjakan",
  "perbarui",
  "tinjau",
  "rapikan",
  "pindahkan",
  "gabungkan",
  "selesaikan",
  "waktu",
]);

function indonesianWords(text: string): string[] {
  return (text.toLowerCase().match(/[a-z]+/g) ?? []).filter((word) =>
    INDONESIAN_WORDS.has(word),
  );
}

function maxNumber(defs: Definition[], prefix: string, dir: string): number {
  let max = 0;
  for (const def of defs.filter((d) => d.path.startsWith(dir))) {
    const match = new RegExp(`^${prefix}-(\\d+)$`).exec(def.id);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return max;
}

function lineOf(text: string, needle: RegExp): number {
  const index = text.split("\n").findIndex((line) => needle.test(line));
  return index === -1 ? 1 : index + 1;
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

function checkIds(docs: Doc[], defs: Definition[]): Finding[] {
  const defined = new Set(defs.map((def) => def.id));
  const prefixes = new Set(
    defs
      .map((def) => def.id.split("-")[0])
      .filter((p) => !UNCHECKED_PREFIXES.has(p)),
  );
  const findings: Finding[] = [];
  for (const doc of docs) {
    const lines = doc.text.split("\n");
    for (const ref of parseReferences(doc.path, doc.text)) {
      if (ref.inRange || RESERVED_IDS.has(ref.id)) continue;
      // Penghitung "Berikutnya: **T-NNN**" sengaja menyebut ID yang belum ada;
      // hanya ID penghitung itu yang dilewati, bukan seluruh baris.
      const counters = [
        ...lines[ref.line - 1].matchAll(
          /berikutnya:\s*\*\*([A-Z]{1,4}-\d+)\*\*/gi,
        ),
      ];
      if (counters.some((counter) => counter[1] === ref.id)) continue;
      const prefix = ref.id.split("-")[0];
      if (!prefixes.has(prefix)) continue;
      const base = ref.id.replace(/\.\d+$/, "");
      if (defined.has(ref.id) || defined.has(base)) continue;
      findings.push({
        rule: "id-ref",
        path: ref.path,
        line: ref.line,
        message: `ID ${ref.id} dirujuk tetapi tidak didefinisikan di dokumen mana pun`,
      });
    }
  }
  return findings;
}

/** Berkas milik artifact desain (ADR-140), bukan repo ini. */
const ARTIFACT_ROOTS = /^(project|templates|components|foundations)\//;

const SEARCH_ROOTS = [
  "",
  "project-os",
  "context",
  "product-discovery",
  ".claude",
  ".claude/skills",
  "apps/web",
  "apps/web/src",
];

function resolvesPointer(
  root: string,
  docPath: string,
  target: string,
  via: "link" | "code",
): boolean {
  const clean = target.replace(/\/$/, "");
  const docDir = path.posix.dirname(docPath);
  if (via === "link") return existsSync(path.join(root, docDir, clean));
  // Nama berkas tanpa folder terlalu ambigu untuk dipetakan ke satu path.
  if (!clean.includes("/")) return true;
  // Paket npm, URL tanpa skema, dan berkas artifact desain bukan path repo.
  if (clean.startsWith("@") || ARTIFACT_ROOTS.test(clean)) return true;
  if (/^[^/.][^/]*\.[a-z]{2,}\//.test(clean)) return true;
  return [docDir, ...SEARCH_ROOTS].some((base) =>
    existsSync(path.join(root, base, clean)),
  );
}

function checkPointers(root: string, docs: Doc[]): Finding[] {
  const findings: Finding[] = [];
  for (const doc of docs.filter((d) => inPointerScope(d.path))) {
    for (const pointer of parsePointers(doc.path, doc.text)) {
      if (ALLOWED_POINTERS.has(`${doc.path}→${pointer.target}`)) continue;
      if (!resolvesPointer(root, doc.path, pointer.target, pointer.via)) {
        findings.push({
          rule: "pointer",
          path: doc.path,
          line: pointer.line,
          message: `penunjuk ke \`${pointer.target}\` tidak ada`,
        });
      }
    }
  }
  return findings;
}

function checkCounters(root: string, defs: Definition[]): Finding[] {
  const file = "project-os/AVAILABLE_TICKETS.md";
  const abs = path.join(root, file);
  if (!existsSync(abs)) return [];
  const text = readFileSync(abs, "utf8");
  const findings: Finding[] = [];
  const counters: {
    label: string;
    prefix: string;
    dir: string;
    width: number;
    pattern: RegExp;
  }[] = [
    {
      label: "tiket",
      prefix: "T",
      dir: "project-os/tickets/",
      width: 3,
      pattern: /Berikutnya:\s*\*\*T-(\d+)\*\*/,
    },
    {
      label: "spec",
      prefix: "S",
      dir: "project-os/specs/",
      width: 3,
      pattern: /spec berikutnya:\s*\*\*S-(\d+)\*\*/i,
    },
  ];
  for (const { label, prefix, dir, width, pattern } of counters) {
    const found = pattern.exec(text);
    const line = lineOf(text, pattern);
    const expected = maxNumber(defs, prefix, dir) + 1;
    if (!found) {
      findings.push({
        rule: "counter",
        path: file,
        line,
        message: `penghitung ID ${label} berikutnya tidak ditemukan`,
      });
    } else if (Number(found[1]) !== expected) {
      findings.push({
        rule: "counter",
        path: file,
        line,
        message: `penghitung ${label} ${prefix}-${found[1]} seharusnya ${prefix}-${pad(expected, width)} (ID maksimum + 1)`,
      });
    }
  }
  return findings;
}

function readJson(root: string, file: string): unknown {
  const abs = path.join(root, file);
  return existsSync(abs) ? JSON.parse(readFileSync(abs, "utf8")) : undefined;
}

/** JSON.stringify dengan kunci objek terurut, agar urutan kunci tidak dianggap beda. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value) ?? "undefined";
}

function checkTwins(root: string): Finding[] {
  const findings: Finding[] = [];

  const claude = readJson(root, ".mcp.json");
  const cursor = readJson(root, ".cursor/mcp.json");
  if (claude !== undefined || cursor !== undefined) {
    if (stableStringify(claude) !== stableStringify(cursor)) {
      findings.push({
        rule: "twin-pair",
        path: ".cursor/mcp.json",
        line: 1,
        message:
          "isi menyimpang dari `.mcp.json` (aturan 12: ubah keduanya bersamaan)",
      });
    }
  }

  const settings = readJson(root, ".claude/settings.json") as
    { permissions?: { deny?: string[] } } | undefined;
  const ignoreFile = path.join(root, ".cursorignore");
  if (settings !== undefined || existsSync(ignoreFile)) {
    const deny = (settings?.permissions?.deny ?? [])
      .map((rule) => /^Read\(\.\/(.*)\)$/.exec(rule)?.[1])
      .filter((pattern): pattern is string => pattern !== undefined);
    const ignored = existsSync(ignoreFile)
      ? readFileSync(ignoreFile, "utf8")
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line && !line.startsWith("#"))
      : [];
    for (const pattern of deny.filter((p) => !ignored.includes(p))) {
      findings.push({
        rule: "twin-pair",
        path: ".cursorignore",
        line: 1,
        message: `pola \`${pattern}\` ada di permissions.deny tetapi tidak di .cursorignore`,
      });
    }
    for (const pattern of ignored.filter((p) => !deny.includes(p))) {
      findings.push({
        rule: "twin-pair",
        path: ".claude/settings.json",
        line: 1,
        message: `pola \`${pattern}\` ada di .cursorignore tetapi tidak di permissions.deny`,
      });
    }
  }
  return findings;
}

function checkNaming(root: string, defs: Definition[]): Finding[] {
  const findings: Finding[] = [];
  const skillsDir = path.join(root, ".claude/skills");
  if (existsSync(skillsDir)) {
    const vendor = vendorSkills(root);
    // Daftar folder lewat korpus tidak cukup (folder tanpa .md); baca langsung.
    for (const name of listDirs(skillsDir).filter((n) => !vendor.has(n))) {
      const bad = indonesianWords(name.replace(/-/g, " "));
      if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name)) {
        findings.push({
          rule: "naming-skill",
          path: `.claude/skills/${name}`,
          line: 1,
          message: "nama folder skill harus huruf kecil, kebab-case, ASCII",
        });
      } else if (bad.length > 0) {
        findings.push({
          rule: "naming-skill",
          path: `.claude/skills/${name}`,
          line: 1,
          message: `nama folder skill harus berbahasa Inggris (kata Indonesia: ${bad.join(", ")})`,
        });
      }
    }
  }
  for (const def of defs) {
    const match = /^T-(\d+)$/.exec(def.id);
    if (
      def.kind !== "heading" ||
      !match ||
      !def.path.startsWith("project-os/tickets/")
    )
      continue;
    if (Number(match[1]) < ENGLISH_TITLES_FROM_TICKET) continue;
    const bad = indonesianWords(titleProse(def.title));
    if (bad.length > 0) {
      findings.push({
        rule: "naming-title",
        path: def.path,
        line: def.line,
        message: `judul ${def.id} harus berbahasa Inggris (kata Indonesia: ${bad.join(", ")})`,
      });
    }
  }
  return findings;
}

function listDirs(dir: string): string[] {
  return readdirSync(dir).filter((name) =>
    statSync(path.join(dir, name)).isDirectory(),
  );
}

export function runChecks(root: string): Finding[] {
  const docs = loadCorpus(root);
  const defs = loadDefinitions(docs);
  return [
    ...checkPointers(root, docs),
    ...checkIds(docs, defs),
    ...checkCounters(root, defs),
    ...checkTwins(root),
    ...checkNaming(root, defs),
  ].sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line);
}

export function formatFinding(finding: Finding): string {
  return `${finding.path}:${finding.line}  [${finding.rule}] ${finding.message}`;
}
