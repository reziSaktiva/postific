-- T-217.4 (ADR-157, jawaban Q1 2026-11-05): status komentar Engage `done`
-- menjadi `resolved`. Kolom `status` bertipe TEXT tanpa constraint, jadi
-- hanya data yang berubah (tanpa DDL). Idempoten: menjalankan ulang tidak
-- menemukan baris `done` lagi.
--
-- DITULIS, BELUM DITERAPKAN. Terapkan ke DB bersama hanya atas izin King Rezi.
-- Urutan rilis: terapkan setelah kode T-217 tersebar, atau segera sesudahnya;
-- selama baris `done` masih ada, kode baru memperlakukannya sebagai status
-- tak dikenal (tidak terhitung unread, tidak cocok filter status apa pun).
UPDATE "engagement_inbox_items"
SET "status" = 'resolved'
WHERE "status" = 'done';
