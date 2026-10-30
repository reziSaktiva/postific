import type { McpClientRegistration } from "../value-objects/client-identity";

/**
 * Pembaca identitas klien OAuth yang mendaftar sendiri (dynamic client
 * registration). Implementasi (Prisma) di src/lib/repositories/mcp-access
 * (T-151); hanya membaca tabel klien plugin OAuth, tidak pernah menulis.
 */
export interface IMcpClientIdentityRepository {
  /** Nama dan redirect URI klien; `null` bila `clientId` tidak terdaftar. */
  findRegistration(clientId: string): Promise<McpClientRegistration | null>;
}
