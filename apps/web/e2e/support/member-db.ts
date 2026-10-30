import { Client } from "pg";

import { sleep } from "./sleep";
import { E2E_WORKSPACE_NAME } from "./workspace";

/**
 * Akses DB minimal untuk skenario "member dikeluarkan" (T-178.3, S-002).
 *
 * Satu-satunya hal yang butuh tulis DB langsung: mengubah `status` baris
 * `workspace_members` milik akun test di workspace E2E Sandbox (aplikasi
 * belum punya jalur UI/API yang mengeluarkan diri sendiri dari workspace).
 * Dipilih driver `pg` langsung (sudah dependency `apps/web`, dipakai
 * `@prisma/adapter-pg`) alih-alih Prisma Client: tidak menarik singleton
 * aplikasi, alias `@/`, atau `server-only` ke proses Playwright.
 *
 * Keselamatan (aturan keras King Rezi: tidak pernah menyentuh workspace
 * nyata):
 * - Baris dicari lewat join `workspaces.name = E2E_WORKSPACE_NAME` dan
 *   `identity_user.email = E2E_USER_EMAIL`; id tidak pernah ditebak.
 * - Harus tepat satu baris; selain itu probe gagal dan (f) di-skip.
 * - Setiap `UPDATE` memakai `id` + `workspace_id` + `user_id` baris itu DAN
 *   status sebelumnya (`AND status = $prev`), dan wajib mengenai tepat satu
 *   baris.
 * - Pemanggil wajib mencocokkan `workspaceId` dengan workspace yang dilaporkan
 *   tool `get_workspace` sebelum mengubah apa pun (`assertWorkspaceId`).
 * - Probe menjalankan dry-run (ubah ke `removed` lalu pulihkan) dalam satu
 *   transaksi yang di-ROLLBACK, jadi hak UPDATE, RLS, dan jalur pemulihan
 *   terbukti sebelum perubahan sungguhan.
 * - Pesan galat dari driver tidak pernah diteruskan mentah: hanya kode
 *   (mis. 28P01, ENOTFOUND) dan nama variabel env; nilai env tidak dicetak.
 *
 * Koneksi (urutan): `DATABASE_URL` (pooler, role runtime `app_runtime`).
 * `DIRECT_URL` (role migrasi `postgres`: superuser, bypass RLS) HANYA dicoba
 * bila `E2E_ALLOW_DIRECT_URL=1` (opt-in eksplisit King Rezi); tanpa itu, (f)
 * di-skip dengan alasan tertulis bila `DATABASE_URL` tidak cukup.
 *
 * RLS (migrasi efektif untuk `workspace_members`: policy UPDATE
 * `workspace_members_workspace_isolation_update` dari
 * `20260813073842_t017_split_workspace_members_insert_policy`, tidak diganti
 * migrasi lain): UPDATE hanya mengenai baris di workspace tempat GUC
 * `app.current_user_id` adalah member `active`. Role `postgres`/BYPASSRLS
 * tidak terpengaruh; `app_runtime` iya. Setelah akun test di-`removed`, ia
 * tidak lagi lolos policy itu, jadi memulihkan `active` lewat `app_runtime`
 * butuh member `active` LAIN di workspace yang sama sebagai GUC. E2E Sandbox
 * hanya punya satu member, jadi dengan `app_runtime` saja (f) di-skip.
 *
 * RUNBOOK pemulihan manual (bila run terhenti dan member tertinggal
 * `removed`; `afterAll` dan `globalSetup` run berikutnya
 * (`heal-member.global.ts`, berjalan SEBELUM proyek `setup`) mencoba
 * memulihkan otomatis hanya bila koneksi bypass RLS tersedia):
 *   UPDATE workspace_members SET status = 'active', updated_at = now()
 *    WHERE status = 'removed'
 *      AND workspace_id = (SELECT id FROM workspaces WHERE name = 'E2E Sandbox')
 *      AND user_id = (SELECT id FROM identity_user WHERE email = '<E2E_USER_EMAIL>');
 * dijalankan sebagai `postgres` (SQL Editor Supabase). Peringatan: selama
 * akun test terkunci, `auth.setup.ts` (`ensureE2eWorkspaceActive`) membuat
 * workspace "E2E Sandbox" KEDUA karena yang lama tidak lagi terlihat. Dua
 * workspace bernama sama membuat probe gagal ("tidak tepat satu") dan (f)
 * di-skip; hapus workspace kedua itu secara manual sebelum menjalankan
 * runbook di atas (workspace.ts tidak diubah oleh T-178).
 */

export type MemberStatus = "active" | "removed";

export type ConnectionVar = "DATABASE_URL" | "DIRECT_URL";

/** Galat aman-cetak: tidak pernah memuat pesan mentah driver atau nilai env. */
export class SandboxDbError extends Error {}

export interface SandboxMemberRef {
  /** Variabel env koneksi yang dipakai (nilainya tidak pernah dicetak). */
  connectionVar: ConnectionVar;
  memberId: string;
  workspaceId: string;
  userId: string;
  /** Status saat probe dibaca (`active`, atau `removed` bila sisa run terhenti). */
  status: string;
  /** Pengguna yang dipakai sebagai GUC saat membaca/memulihkan (lihat catatan RLS). */
  restoreActorId: string;
  /** Role koneksi, hanya untuk laporan (bukan rahasia). */
  role: string;
  bypassRls: boolean;
}

export type ProbeResult =
  | { ok: true; ref: SandboxMemberRef }
  | {
      ok: false;
      reason: string;
      /**
       * Jumlah baris member akun test di E2E Sandbox bila pencarian sempat
       * berjalan: 0 = tidak terlihat (mis. tertinggal `removed` di bawah RLS),
       * 2+ = workspace "E2E Sandbox" ganda.
       */
      memberRows?: number;
    };

const STATEMENT_TIMEOUT_MS = 10_000;

/**
 * Apakah ada variabel koneksi DB yang BOLEH dipakai (gerbang skenario (f) dan
 * penyembuhan member), searah dengan `probeSandboxMember`: `DATABASE_URL`, atau
 * `DIRECT_URL` (superuser) hanya dengan opt-in `E2E_ALLOW_DIRECT_URL=1`.
 */
export function hasDbConnection(): boolean {
  return Boolean(
    process.env.DATABASE_URL ||
    (process.env.DIRECT_URL && process.env.E2E_ALLOW_DIRECT_URL === "1"),
  );
}

function dbErrorCode(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code === "string") return code;
  return error instanceof Error ? error.name : "tidak diketahui";
}

async function withClient<T>(
  connectionVar: ConnectionVar,
  fn: (client: Client) => Promise<T>,
): Promise<T> {
  const connectionString = process.env[connectionVar];
  if (!connectionString) {
    throw new SandboxDbError(`${connectionVar} tidak tersedia.`);
  }
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: STATEMENT_TIMEOUT_MS,
    query_timeout: STATEMENT_TIMEOUT_MS,
  });
  // Tanpa handler, 'error' pada koneksi menganggur menjatuhkan worker.
  client.on("error", (error) => {
    console.warn(
      `[mcp.e2e] ${connectionVar}: error koneksi DB (kode ${dbErrorCode(error)})`,
    );
  });
  let connected = false;
  try {
    await client.connect();
    connected = true;
    return await fn(client);
  } catch (error) {
    if (error instanceof SandboxDbError) throw error;
    throw new SandboxDbError(
      `${connectionVar}: operasi DB gagal (kode ${dbErrorCode(error)})`,
    );
  } finally {
    if (connected) await client.end().catch(() => undefined);
  }
}

/**
 * Satu transaksi dengan `app.current_user_id` diset ke `actorId` (bound
 * parameter) dan batas waktu per statement/lock. `SET LOCAL` (bukan opsi
 * startup koneksi) agar tetap jalan lewat pooler mode transaksi.
 */
async function inTransaction<T>(
  client: Client,
  actorId: string,
  fn: () => Promise<T>,
  options: { rollback?: boolean } = {},
): Promise<T> {
  await client.query("BEGIN");
  try {
    await setActor(client, actorId);
    await client.query(`SET LOCAL statement_timeout = ${STATEMENT_TIMEOUT_MS}`);
    await client.query(`SET LOCAL lock_timeout = ${STATEMENT_TIMEOUT_MS}`);
    const result = await fn();
    await client.query(options.rollback ? "ROLLBACK" : "COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

async function setActor(client: Client, actorId: string): Promise<void> {
  await client.query("SELECT set_config('app.current_user_id', $1, true)", [
    actorId,
  ]);
}

const UPDATE_STATUS_SQL = `UPDATE workspace_members SET status = $1, updated_at = now()
   WHERE id = $2 AND workspace_id = $3 AND user_id = $4 AND status = $5`;

/**
 * Cari baris member akun test di E2E Sandbox lewat koneksi yang terbukti
 * (dry-run ber-ROLLBACK) dapat mengubah dan memulihkan status. Mencoba
 * `DATABASE_URL`; `DIRECT_URL` hanya dengan opt-in `E2E_ALLOW_DIRECT_URL=1`.
 * Tidak mengubah apa pun secara permanen.
 */
export async function probeSandboxMember(email: string): Promise<ProbeResult> {
  const reasons: string[] = [];
  let memberRows: number | undefined;
  const candidates: ConnectionVar[] = [];
  if (process.env.DATABASE_URL) candidates.push("DATABASE_URL");
  if (process.env.DIRECT_URL) {
    if (process.env.E2E_ALLOW_DIRECT_URL === "1") {
      candidates.push("DIRECT_URL");
    } else {
      reasons.push(
        "DIRECT_URL tersedia tetapi tidak dicoba: koneksi itu superuser (bypass RLS) dan butuh opt-in eksplisit E2E_ALLOW_DIRECT_URL=1 (keputusan King Rezi)",
      );
    }
  }

  for (const connectionVar of candidates) {
    try {
      const result = await probeWith(connectionVar, email);
      if (result.ok) return result;
      memberRows ??= result.memberRows;
      reasons.push(`${connectionVar}: ${result.reason}`);
    } catch (error) {
      reasons.push(
        error instanceof SandboxDbError
          ? error.message
          : `${connectionVar}: probe gagal (kode ${dbErrorCode(error)})`,
      );
    }
  }
  return {
    ok: false,
    reason: reasons.join("; ") || "tidak ada variabel koneksi DB",
    memberRows,
  };
}

async function probeWith(
  connectionVar: ConnectionVar,
  email: string,
): Promise<ProbeResult> {
  return withClient(connectionVar, async (client) => {
    const roleRow = await client.query<{ who: string; bypass: boolean }>(
      "SELECT current_user AS who, (rolsuper OR rolbypassrls) AS bypass FROM pg_roles WHERE rolname = current_user",
    );
    const role = roleRow.rows[0]?.who ?? "tidak diketahui";
    const bypassRls = roleRow.rows[0]?.bypass === true;

    const users = await client.query<{ id: string }>(
      "SELECT id FROM identity_user WHERE lower(email) = lower($1)",
      [email],
    );
    if (users.rows.length !== 1) {
      return {
        ok: false as const,
        reason: `akun test tidak ditemukan tepat satu kali di identity_user (${users.rows.length})`,
      };
    }
    const userId = users.rows[0].id;

    const found = await inTransaction(client, userId, async () => {
      const members = await client.query<{
        id: string;
        workspace_id: string;
        status: string;
      }>(
        `SELECT wm.id, wm.workspace_id, wm.status
           FROM workspace_members wm
           JOIN workspaces w ON w.id = wm.workspace_id
          WHERE wm.user_id = $1 AND w.name = $2`,
        [userId, E2E_WORKSPACE_NAME],
      );
      if (members.rows.length !== 1) {
        return {
          kind: "fail" as const,
          reason: `baris member di "${E2E_WORKSPACE_NAME}" tidak tepat satu (${members.rows.length}); role ${role}, bypass RLS ${bypassRls}`,
          memberRows: members.rows.length,
        };
      }
      const member = members.rows[0];

      let restoreActorId = userId;
      if (!bypassRls) {
        const others = await client.query<{ user_id: string }>(
          `SELECT user_id FROM workspace_members
            WHERE workspace_id = $1 AND status = 'active' AND user_id <> $2
            LIMIT 1`,
          [member.workspace_id, userId],
        );
        restoreActorId = others.rows[0]?.user_id ?? "";
      }
      return { kind: "ok" as const, member, restoreActorId };
    });
    if (found.kind === "fail") {
      return {
        ok: false as const,
        reason: found.reason,
        memberRows: found.memberRows,
      };
    }
    const { member, restoreActorId } = found;

    const ref: SandboxMemberRef = {
      connectionVar,
      memberId: member.id,
      workspaceId: member.workspace_id,
      userId,
      status: member.status,
      restoreActorId: restoreActorId || userId,
      role,
      bypassRls,
    };

    // Dry-run ber-ROLLBACK: bukti hak UPDATE + RLS + jalur pemulihan.
    const dry = await dryRun(client, ref, restoreActorId !== "");
    if (dry) {
      return {
        ok: false as const,
        reason: `role ${role} (bypass RLS ${bypassRls}): ${dry}`,
      };
    }
    return { ok: true as const, ref };
  });
}

/**
 * Simulasi mengeluarkan dan memulihkan member dalam transaksi yang di-ROLLBACK.
 * Mengembalikan alasan kegagalan, atau `undefined` bila kedua langkah lolos.
 */
async function dryRun(
  client: Client,
  ref: SandboxMemberRef,
  hasRestoreActor: boolean,
): Promise<string | undefined> {
  try {
    return await inTransaction(
      client,
      ref.userId,
      async () => {
        if (ref.status === "active") {
          const out = await client.query(UPDATE_STATUS_SQL, [
            "removed",
            ref.memberId,
            ref.workspaceId,
            ref.userId,
            "active",
          ]);
          if (out.rowCount !== 1) {
            return `UPDATE ke removed mengenai ${out.rowCount} baris pada dry-run (hak UPDATE atau RLS menolak)`;
          }
        }
        if (!hasRestoreActor) {
          return `UPDATE ke removed lolos pada dry-run, tetapi pemulihan active tidak dapat dijamin: tanpa bypass RLS, "${E2E_WORKSPACE_NAME}" butuh member active lain (policy UPDATE hanya mengenai workspace tempat aktor member active) dan tidak ada`;
        }
        await setActor(client, ref.restoreActorId);
        const back = await client.query(UPDATE_STATUS_SQL, [
          "active",
          ref.memberId,
          ref.workspaceId,
          ref.userId,
          "removed",
        ]);
        if (back.rowCount !== 1) {
          return `pemulihan ke active mengenai ${back.rowCount} baris pada dry-run`;
        }
        return undefined;
      },
      { rollback: true },
    );
  } catch (error) {
    return `dry-run gagal (kode ${dbErrorCode(error)})`;
  }
}

/** Pastikan baris ini memang milik workspace yang dilaporkan `get_workspace`. */
export function assertWorkspaceId(
  ref: SandboxMemberRef,
  reportedWorkspaceId: string,
): void {
  if (ref.workspaceId !== reportedWorkspaceId) {
    throw new SandboxDbError(
      `Workspace token (${reportedWorkspaceId}) berbeda dari baris member E2E (${ref.workspaceId}); perubahan dibatalkan.`,
    );
  }
}

export async function readMemberStatus(ref: SandboxMemberRef): Promise<string> {
  return withClient(ref.connectionVar, (client) =>
    inTransaction(
      client,
      // Saat `removed`, hanya aktor pemulihan yang dapat melihat baris (RLS).
      ref.restoreActorId,
      async () => {
        const result = await client.query<{ status: string }>(
          "SELECT status FROM workspace_members WHERE id = $1 AND workspace_id = $2 AND user_id = $3",
          [ref.memberId, ref.workspaceId, ref.userId],
        );
        if (result.rows.length !== 1) {
          throw new SandboxDbError("Baris member E2E tidak terbaca.");
        }
        return result.rows[0].status;
      },
    ),
  );
}

/**
 * Ubah status dari `previous` ke `next`; `UPDATE` hanya jalan bila status
 * saat ini memang `previous` dan wajib mengenai tepat satu baris.
 *
 * Jendela balapan: bila timeout klien/statement menyela, hasilnya tidak
 * pasti (perubahan bisa sudah terjadi di server). Karena itu pemulihan tidak
 * memakai fungsi ini langsung, melainkan `restoreMemberActive` yang membaca
 * status terbaru dulu.
 */
export async function setMemberStatus(
  ref: SandboxMemberRef,
  next: MemberStatus,
  previous: MemberStatus,
): Promise<void> {
  // Mengeluarkan: akun test masih `active`, jadi ia sendiri aktornya.
  // Memulihkan: aktor yang sanggup melihat baris (lihat `probeSandboxMember`).
  const actorId = next === "removed" ? ref.userId : ref.restoreActorId;
  await withClient(ref.connectionVar, (client) =>
    inTransaction(client, actorId, async () => {
      const result = await client.query(UPDATE_STATUS_SQL, [
        next,
        ref.memberId,
        ref.workspaceId,
        ref.userId,
        previous,
      ]);
      if (result.rowCount !== 1) {
        throw new SandboxDbError(
          `UPDATE status member ${previous} -> ${next} mengenai ${result.rowCount} baris (harus 1).`,
        );
      }
    }),
  );
}

/**
 * Pastikan status member `active` dengan retry pendek. Idempoten: membaca
 * status terbaru dulu (menangani jendela balapan timeout), hanya mengubah
 * dari `removed`, dan memverifikasi hasilnya. Status lain yang tak terduga
 * tidak disentuh.
 */
export async function restoreMemberActive(
  ref: SandboxMemberRef,
  { attempts = 3, delayMs = 1_000 } = {},
): Promise<void> {
  let lastMessage = "tidak diketahui";
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const current = await readMemberStatus(ref);
      if (current === "active") return;
      if (current !== "removed") {
        throw new SandboxDbError(
          `status member tak terduga "${current}"; tidak diubah`,
        );
      }
      await setMemberStatus(ref, "active", "removed");
      if ((await readMemberStatus(ref)) === "active") return;
      lastMessage = "status belum active setelah UPDATE";
    } catch (error) {
      lastMessage =
        error instanceof SandboxDbError
          ? error.message
          : `kode ${dbErrorCode(error)}`;
    }
    if (attempt < attempts) await sleep(delayMs);
  }
  throw new SandboxDbError(
    `pemulihan status member gagal setelah ${attempts} percobaan (${lastMessage}). Pulihkan manual: lihat RUNBOOK di member-db.ts.`,
  );
}
