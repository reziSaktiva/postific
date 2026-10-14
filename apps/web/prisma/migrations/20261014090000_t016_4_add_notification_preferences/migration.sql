-- T-016.4: preferensi notifikasi email user — 3 kolom boolean terpisah di
-- `identity_user`, bukan JSON tunggal (konsisten dengan pola kolom boolean
-- flat yang sudah ada di model ini, mis. `email_verified`). Default
-- mengikuti rancangan Claude Design (`templates/settings-notifications.html`):
-- "Balasan & Mention" dan "Jadwal Publish" default ON, "Laporan Analytics"
-- default OFF.

ALTER TABLE "identity_user" ADD COLUMN "notifyRepliesAndMentions" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "identity_user" ADD COLUMN "notifyPublishSchedule" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "identity_user" ADD COLUMN "notifyAnalyticsReport" BOOLEAN NOT NULL DEFAULT false;
