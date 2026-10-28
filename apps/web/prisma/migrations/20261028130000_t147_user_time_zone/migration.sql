-- T-147 (ADR-146): zona waktu per pengguna di `identity_user`.
--
-- `time_zone`: nama IANA, default 'Asia/Jakarta' — pengguna lama otomatis WIB
-- lewat default ini (tidak ada backfill terpisah). DB tetap UTC; kolom ini
-- tidak mengubah data waktu tersimpan, `occurred_at` (T-145) tidak terkait.
--
-- `time_zone_source`: penanda asal nilai supaya auto-deteksi browser jalan
-- SEKALI dan tidak menimpa pilihan manual. Baris yang sudah ada diberi
-- 'legacy' (tetap WIB, tidak dideteksi diam-diam); default SESUDAH migrasi
-- 'pending' sehingga pengguna baru dideteksi pada kunjungan pertama.
-- Nilai: 'pending' | 'legacy' | 'detected' | 'manual' (divalidasi aplikasi).

ALTER TABLE "identity_user" ADD COLUMN "time_zone" TEXT NOT NULL DEFAULT 'Asia/Jakarta';

ALTER TABLE "identity_user" ADD COLUMN "time_zone_source" TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE "identity_user" ALTER COLUMN "time_zone_source" SET DEFAULT 'pending';
