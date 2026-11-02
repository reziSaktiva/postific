import type { McpClientRegistration } from "../value-objects/client-identity";

/**
 * Pembaca identitas klien OAuth yang mendaftar sendiri (dynamic client
 * registration). Implementasi (Prisma) di src/lib/repositories/mcp-access
 * (T-151); membaca tabel klien plugin OAuth, dan hanya menghapus pendaftaran
 * yang tidak terpakai (T-150.9).
 */
export interface IMcpClientIdentityRepository {
  /** Nama dan redirect URI klien; `null` bila `clientId` tidak terdaftar. */
  findRegistration(clientId: string): Promise<McpClientRegistration | null>;
  /**
   * Hapus klien hasil pendaftaran dinamis tanpa pemilik, terdaftar sebelum
   * `registeredBefore`, yang tidak punya consent, token, maupun grant (aktif
   * atau dicabut). Idempoten; mengembalikan jumlah baris terhapus.
   */
  deleteUnusedRegistrations(registeredBefore: Date): Promise<number>;
}
