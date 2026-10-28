-- T-147 (ADR-146): batasi `time_zone_source` ke nilai yang dikenal aplikasi.
-- Tulis lewat jalur lain (SQL manual, seed) tidak bisa menyimpan nilai ilegal.
ALTER TABLE "identity_user"
  ADD CONSTRAINT "identity_user_time_zone_source_check"
  CHECK ("time_zone_source" IN ('pending', 'legacy', 'detected', 'manual'));
