import { MemberRole, OWNER_OR_ADMIN_ROLES } from "@postific/shared";
import { AuthorizationError } from "@/lib/utils/errors";

/**
 * RBAC bersama untuk Publish Now, Cancel Schedule, dan Delete Post
 * (ADR-074, struktur 3-role) — `roles-permissions.md` menetapkan ketiga
 * aksi ini sama-sama ✅ untuk Account Owner, Admin, DAN Creator (bagian
 * siklus hidup konten), tidak ada pembatasan berbeda per aksi. Sebelumnya
 * dideklarasikan 3x identik (satu `ReadonlySet` per aksi) — dipusatkan di
 * sini supaya kalau struktur role berubah (role baru ditambah, atau akses
 * Creator ke aksi konten dicabut), cukup diubah satu tempat, tidak
 * berisiko satu aksi "lupa ikut diupdate" sementara dua lainnya sudah
 * konsisten.
 *
 * Dengan struktur 3-role saat ini, ini secara efektif mengizinkan setiap
 * member aktif — tapi assertion per aksi tetap eksplisit (bukan diam-diam
 * "semua boleh") karena dua alasan: (1) `getWorkspaceContext()` membaca
 * `role` dari header request sebagai string lalu men-cast ke `MemberRole`
 * tanpa validasi runtime (`apps/web/src/lib/workspace/workspace-context.ts`)
 * — assertion ini yang benar-benar memvalidasi nilainya adalah salah satu
 * dari 3 role yang sah; (2) mendokumentasikan aturan produk di kode,
 * supaya kalau role baru pernah ditambah lagi, developer wajib memutuskan
 * secara sadar apakah role itu boleh melakukan aksi ini atau tidak, bukan
 * otomatis ikut lolos.
 */
const ROLES_ALLOWED_FOR_CONTENT_ACTIONS: ReadonlySet<MemberRole> = new Set([
  MemberRole.Owner,
  MemberRole.Admin,
  MemberRole.Creator,
]);

export function assertActorCanPublishNow(actorRole: MemberRole): void {
  if (!ROLES_ALLOWED_FOR_CONTENT_ACTIONS.has(actorRole)) {
    throw new AuthorizationError(
      "Anda tidak memiliki izin untuk mempublikasikan konten secara langsung (Publish Now).",
    );
  }
}

export function assertActorCanCancelSchedule(actorRole: MemberRole): void {
  if (!ROLES_ALLOWED_FOR_CONTENT_ACTIONS.has(actorRole)) {
    throw new AuthorizationError(
      "Anda tidak memiliki izin untuk membatalkan jadwal post ini (Cancel Schedule).",
    );
  }
}

/**
 * RBAC untuk Delete Post (T-035.1, ADR-049 Tier 2). `roles-permissions.md`
 * tidak punya baris eksplisit untuk "Delete Post" — beda dari
 * `deleteWorkspace`/transfer ownership (Tier 1, dibatasi Account Owner)
 * atau remove member/connected account (dibatasi Owner+Admin), delete post
 * adalah bagian dari siklus hidup konten ("Buat/edit konten" di tabel
 * Ringkasan Hak Akses, ✅ untuk ketiga role) — pakai role set bersama yang
 * sama dengan Publish Now/Cancel Schedule di atas.
 */
export function assertActorCanDeletePost(actorRole: MemberRole): void {
  if (!ROLES_ALLOWED_FOR_CONTENT_ACTIONS.has(actorRole)) {
    throw new AuthorizationError(
      "Anda tidak memiliki izin untuk menghapus post ini (Delete Post).",
    );
  }
}

/**
 * RBAC untuk trigger manual "Sync Now" Import Posts (T-090.3, ADR-093 poin
 * 9) — SENGAJA bukan `ROLES_ALLOWED_FOR_CONTENT_ACTIONS` (yang mengikutkan
 * Creator): endpoint ini BERBAYAR dan ADR-093 eksplisit membatasinya ke
 * hak "kelola Connected Accounts" — Owner & Admin saja, sama persis dengan
 * `assertActorCanManageConnectedAccounts` di
 * `WorkspaceService`/`roles-permissions.md`. Dideklarasikan ulang di sini
 * (bukan reuse method private `WorkspaceService`) karena
 * `ImportPostsTriggerUseCase` hidup di domain `publishing`, tidak boleh
 * mengimpor `workspace` (AGENTS.md #7) — nilai himpunan role HARUS tetap
 * identik dengan gate itu — code review PR #148: nilai himpunan role
 * sekarang satu sumber kebenaran bersama, `OWNER_OR_ADMIN_ROLES` di
 * `packages/shared` (lihat docstring konstanta itu), bukan `Set` literal
 * terpisah di sini.
 */
export function assertActorCanTriggerManualImportSync(
  actorRole: MemberRole,
): void {
  if (!OWNER_OR_ADMIN_ROLES.has(actorRole)) {
    throw new AuthorizationError(
      "Hanya Owner atau Admin yang bisa menjalankan sinkronisasi impor manual (Sync Now).",
    );
  }
}
