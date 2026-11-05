import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// T-201.2 — penjaga drift antara query `findLatestPostTargetAccountIds` dan
// indeksnya. Kalau filter query berubah, predikat indeks harus ikut
// berubah (atau indeks tidak akan dipakai planner).
const webRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const read = (path: string) => readFileSync(join(webRoot, path), "utf8");

describe("indeks 'Terakhir dipakai' (T-201.2)", () => {
  const sql = read(
    "prisma/migrations/20261105110000_t201_latest_target_index_literal_predicate/migration.sql",
  );
  const repo = read("src/lib/repositories/publishing/publishing.repository.ts");

  it("migrasi aktif membuat indeks workspace_id + created_at DESC dengan predikat literal saja", () => {
    expect(sql).toMatch(/\("workspace_id", "created_at" DESC\)/);
    // Hanya predikat literal: status dikirim Prisma sebagai parameter, jadi
    // tidak boleh masuk predikat indeks (rencana generik tidak memakainya).
    expect(sql).toMatch(/WHERE "deleted_at" IS NULL;/);
    expect(sql).not.toMatch(/"status"/);
  });

  it("repository masih menyebut filter dan urutan yang dicakup indeks (penjaga dokumentasi, bukan bukti planner)", () => {
    const start = repo.indexOf("async findLatestPostTargetAccountIds");
    const body = repo.slice(start, start + 1200);
    expect(body).toContain("deletedAt: null");
    expect(body).toContain("status: { not: ContentStatus.Imported }");
    expect(body).toContain('orderBy: { createdAt: "desc" }');
  });
});
