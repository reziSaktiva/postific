-- KI-076 (ADR-120) — avatar/foto profil akun terhubung (Instagram/Facebook
-- dst.) tidak pernah tampil di sidebar Channels karena field ini tidak
-- pernah didesain masuk ke pipeline data sama sekali (kontrak ACL, adapter,
-- schema, domain type). Kolom baru nullable, default NULL — akun yang
-- sudah terhubung sebelum migrasi ini tetap valid tanpa foto sampai
-- di-reconnect (reconnect akan mengisi ulang lewat WorkspaceService).
ALTER TABLE "workspace_connected_accounts" ADD COLUMN "avatar_url" TEXT;
