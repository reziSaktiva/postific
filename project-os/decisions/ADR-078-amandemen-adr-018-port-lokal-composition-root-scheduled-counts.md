## Decision ADR-078

### Title

Amandemen ADR-018 — Port Lokal + Composition Root untuk Cross-Domain Service Call (`ScheduledCountsPort`)

### Status

Accepted

### Date

2026-08-12

### Context

**ADR-018** menetapkan komunikasi antar domain lewat service-to-service call
langsung dengan tiga aturan: (1) hanya import dari `index.ts` (public API)
domain lain, (2) tidak ada circular dependency, (3) hanya passing ID, bukan
full entity. Aturan itu masih berlaku, tetapi belum menjelaskan **bagaimana**
wiring konkret dilakukan tanpa melanggar boundary domain layer.

Saat **T-012.2** (badge scheduled-count real di sidebar Channels),
`WorkspaceService` butuh hitungan post terjadwal dari domain `publishing`.
Import konkret `PublishingService` ke dalam
`apps/web/src/domains/workspace/` akan mengikat domain `workspace` ke
implementasi `publishing` di layer domain — melanggar semangat AGENTS.md #7
(cross-domain lewat public API) dan membuat domain layer sulit di-test tanpa
menarik dependency publishing.

Pola yang dipilih di kode (sudah di-merge lewat T-012.2) belum tercatat di
ADR manapun. ADR ini mengamandemen ADR-018 untuk mengunci pola itu sebagai
preseden resmi.

### Decision

Amandemen terhadap **ADR-018** — tambahan aturan operasional (tidak
mengganti tiga aturan asli):

1. **Port lokal di domain pemanggil.** Domain yang membutuhkan data/aksi
   lintas domain mendeklarasikan interface port sempit di file service-nya
   sendiri (contoh: `ScheduledCountsPort` di `workspace.service.ts`). Port
   itu adalah _implementation detail_ service — **bukan** kontrak publik
   domain, jadi **tidak** di-`export` dari file tersebut (barrel `index.ts`
   memakai `export *`, sehingga `export` pada interface lokal akan bocor ke
   public API).

2. **Tidak ada import konkret service domain lain di layer domain.** File di
   `domains/<pemanggil>/` tidak mengimpor class/service konkret dari
   `domains/<pemasok>/`. Dependency disuplai lewat constructor (opsional
   bila fitur boleh degrade — mis. `scheduledCount` default 0).

3. **Wiring konkret hanya di composition root.** Satu-satunya tempat
   mengimpor public API domain pemasok dan menginstansiasi service konkret
   adalah entry point aplikasi (RSC layout, Server Action factory, Route
   Handler, dsb.). Contoh kanonikal T-012.2:

   ```ts
   // apps/web/src/app/(app)/layout.tsx — composition root
   import { PublishingService } from "@/domains/publishing";
   import { WorkspaceService } from "@/domains/workspace";

   const workspaceService = new WorkspaceService(
     workspaceRepository,
     new PublishingService(publishingRepository), // cocok structural ke ScheduledCountsPort
   );
   ```

4. **Passing tetap ID-only.** Port menerima/mengembalikan ID shared
   (`WorkspaceId`, `ConnectedAccountId`, …) dan nilai primitif (angka count),
   bukan entity penuh lintas domain — selaras aturan ADR-018 asli.

Preseden pertama di codebase: `WorkspaceService` ← `ScheduledCountsPort` ←
`PublishingService.countScheduledByAccount` (T-012.2). Pola yang sama
dipakai ulang untuk cross-domain call berikutnya kecuali ADR baru
menggantikannya.

Body ADR-018 sendiri **tidak diedit** — hanya kolom Status di
`DECISIONS.md` yang ditandai `Accepted — Amended by ADR-078 (2026-08-12)`,
mengikuti pola ADR-066/ADR-067 dan ADR-071/ADR-075.

### Reason

- Menjaga domain layer bebas dari import konkret lintas folder, sementara
  tetap memakai service-to-service call langsung (bukan event bus) sesuai
  ADR-018.
- Port lokal + structural typing memungkinkan unit test domain pemanggil
  menyuplai fake port tanpa menarik repository/service domain lain.
- Composition root menjadikan dependency lintas domain eksplisit dan mudah
  ditelusuri (satu tempat wiring), bukan tersebar di dalam domain services.

### Alternatives Considered

- Import `PublishingService` langsung di `WorkspaceService` — ditolak:
  mengikat domain layer ke implementasi konkret domain lain.
- Domain Events / shared read model — sudah ditolak di ADR-018 untuk MVP;
  T-012.2 tidak mengubah keputusan itu.
- Port di `packages/shared` atau public API workspace — ditolak: port
  terlalu sempit dan spesifik pemanggil; memasukkannya ke shared/public API
  menambah surface area tanpa manfaat.

### Impact / Baseline yang diamandemen

- `project-os/DECISIONS.md` — baris ADR-018: Status diubah jadi
  `Accepted — Amended by ADR-078 (2026-08-12)`; baris indeks ADR-078
  ditambahkan.
- Catatan T-012.2 di `project-os/tickets/v01-foundation.md` dan
  `project-os/COMPLETE_TASK.md` mereferensikan ADR-078.
- Tidak mengubah kode runtime — pola sudah hidup di
  `workspace.service.ts` + `app/(app)/layout.tsx`.

---
