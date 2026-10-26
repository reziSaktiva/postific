## Decision ADR-062

### Title

Backlog Task Berjenjang per Release — `TASKS.md` + `tickets/` dan Amandemen Aturan "Status Hanya di PROJECT_STATE.md"

### Status

Accepted — Amended by ADR-131 (2026-10-16)

### Date

2026-08-04

### Decision

King Rezi meminta perencanaan task yang matang dari awal pengerjaan hingga task terakhir, dikelompokkan dan punya subtask, serta rapi dibaca baik oleh AI maupun manusia. Section `Next Tasks` di `PROJECT_STATE.md` sebelumnya berupa flat list ~15 bullet prosa panjang tanpa hierarki, tanpa ID, tanpa dependency, dan sebagian isinya terduplikasi dengan `Known Issues`.

Sebagai gantinya:

- Dibuat **backlog berjenjang** dengan struktur `release → task → subtask`:
  - `project-os/TASKS.md` — **indeks**: protokol baca untuk AI, legend status, aturan ID, indeks release, fokus sekarang, daftar keputusan terbuka, aturan maintenance.
  - `project-os/tickets/vXX-*.md` — **satu file per release**, memuat detail task + subtask.
- Pengelompokan memakai **release `v0.x`** dari `product-discovery/02-product/release-roadmap.md` (v0.1 Foundation, v0.2 Publishing MVP, v0.3 Analytics MVP, v0.4 Engagement MVP, v0.5 AI Assistant MVP, v0.6 Start Page MVP, v1.0 Public Launch) — **bukan** penamaan grup baru, dan **bukan** milestone M0–M9 (yang tetap menjadi penanda fase project di `PROJECT_STATE.md`).
- **ID task global berurutan** (`T-001` … `T-088`) yang **tidak memuat kode release**, supaya task bisa berpindah antar release tanpa penomoran ulang dan tanpa membuat referensi lama menjadi salah. Subtask memakai format `T-021.4`. ID tidak pernah didaur ulang; task yang dibatalkan ditandai `⏸️ Deferred` beserta alasannya. Setiap release menyisakan nomor kosong di akhir sebagai ruang tumbuh.
- **Kedalaman rolling wave:** v0.1–v0.3 dirinci penuh sampai subtask; v0.4–v1.0 dikunci pada level task saja (ID + cakupan + dependency + bacaan minimal), subtask diisi saat release-nya mendekat.
- Setiap task membawa field **Domain**, **ADR**, **Depends**, dan **Baca dulu** (daftar bacaan baseline minimal yang sudah dikurasi). Task berstatus `✅ Done` diringkas jadi satu paragraf jejak tanpa checklist subtask, supaya file tetap ramping.
- **Amandemen aturan status.** Aturan "Status progress (% / ✅ / phase aktif) hanya di `PROJECT_STATE.md`" (aturan keras #10 `AGENTS.md`, Formatting Rules `PROJECT_RULES.md`) diberi **satu pengecualian**: status per-task dan per-subtask hidup di `TASKS.md` + `tickets/*.md`. Yang tetap **eksklusif** milik `PROJECT_STATE.md`: phase, milestone (M0–M9), overall progress, Active Conversation Mode, Known Issues, dan Blockers.
- `TASKS.md` dan `tickets/*.md` diklasifikasikan **Living Document** (sebelumnya hanya `PROJECT_STATE.md` yang bertipe ini).
- Section `Next Tasks` di `PROJECT_STATE.md` diringkas menjadi **pointer** — hanya ID + judul singkat + status, menunjuk ke `TASKS.md`. Detail task tidak lagi diduplikasi di sana.

### Reason

- Flat list 15 bullet prosa tidak bisa menjawab pertanyaan dasar perencanaan: mana yang harus dikerjakan lebih dulu, apa yang memblokir apa, dan seberapa jauh sebuah task sudah berjalan. Hierarki + `Depends` + ID membuat ketiganya terlihat tanpa membaca ulang seluruh daftar.
- Pola **indeks + file per unit** sudah terbukti di project ini pada ADR-060/061 untuk `DECISIONS.md` (3.564 → 69 baris). Menempatkan backlog penuh sampai v1.0 sebagai satu section di `PROJECT_STATE.md` akan mengulang masalah token yang baru saja diselesaikan; backlog ini saja sudah ±1.200 baris.
- Mengelompokkan per **release** menghindari lahirnya Source of Truth kedua — `release-roadmap.md` sudah menjadi baseline urutan rilis, jadi backlog hanya menurunkannya. Mengelompokkan per milestone M0–M9 ditolak karena hampir semua task akan menumpuk di M8.
- **ID tanpa kode release** dipilih karena King Rezi sendiri menyatakan urutan mungkin berubah seiring project berjalan. ID seperti `V03-T02` memaksa penomoran ulang setiap kali task bergeser antar release.
- **Rolling wave** dipilih supaya permintaan "rencanakan sampai task akhir" tetap terpenuhi (semua release punya file, ID, dan cakupan sejak sekarang) tanpa mengisi backlog dengan subtask tebakan untuk release yang desain dan ADR-nya belum ada.
- Field **Baca dulu** menjawab kelemahan nyata backlog untuk AI: tanpa itu, agent harus menebak dokumen baseline mana yang relevan atau menyisir `product-discovery/`. Dengan itu, satu task langsung membawa daftar bacaan minimalnya.
- Amandemen aturan status diperlukan karena backlog dengan subtask **tidak berguna** tanpa penanda status per item. Alternatif "backlog tanpa status" memaksa King Rezi membaca dua dokumen untuk tahu progres satu task. Batas pengecualiannya dibuat tegas dan sempit (status task saja, bukan phase/milestone/progress) supaya aturan aslinya tidak melunak menjadi "status boleh di mana saja".

### Alternatives Considered

- **Satu file `TASK_BACKLOG.md` tunggal.** Ditolak — backlog penuh sampai v1.0 realistis 800–1.500 baris; sama dengan mengulang masalah `DECISIONS.md` pra-ADR-060.
- **Board per status (kolom Backlog / In Progress / Done).** Ditolak — hierarki subtask jadi berantakan, dan memindahkan item antar section rawan membuat task hilang tanpa jejak.
- **GitHub Issues + Projects sebagai source of truth.** Ditolak — memaksa AI melakukan API call tiap sesi, tidak bisa dibaca offline, dan menyimpang dari konvensi dokumen-first project ini.
- **Grup per milestone M0–M9.** Ditolak — M8 terlalu besar, hampir seluruh task akan menumpuk di satu grup.
- **Grup per domain / bounded context.** Ditolak sebagai grup utama — cocok dengan arsitektur DDD tapi kehilangan urutan waktu pengerjaan. Domain tetap dicatat sebagai field per task, bukan sebagai pengelompokan file.
- **Hybrid Release × Domain.** Ditolak — paling informatif tapi dua dimensi harus dijaga konsisten sekaligus, overhead maintenance-nya tidak sepadan.
- **Detail penuh (subtask) untuk ketujuh release sekarang.** Ditolak — subtask untuk v0.4 ke atas akan disusun tanpa desain/ADR pendukung, jadi mayoritas akan direvisi. Backlog yang isinya tebakan lebih berbahaya daripada backlog yang jujur menyatakan bagian mana yang belum dirinci.
- **Backlog tanpa status sama sekali** (aturan #10 tetap utuh tanpa ADR). Ditolak — King Rezi tidak bisa melihat progres langsung di backlog, harus bolak-balik dua dokumen.
- **`PROJECT_STATE.md` menyimpan angka agregat progress backlog.** Ditolak — menambah satu lagi tempat yang harus disinkronkan manual dan rawan desync, tanpa memberi informasi yang tidak sudah ada di `TASKS.md`.
