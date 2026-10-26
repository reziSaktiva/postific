import { notFound, redirect } from "next/navigation";

import { getCachedSession } from "@/lib/better-auth/session";
import { mcpSpikeEnabled } from "@/lib/better-auth/mcp-spike";

import { ConsentForm } from "./ConsentForm";

// T-148 (spike MCP) — langkah 2 dari 2. SEMENTARA; T-151 membangun layar final.
export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ client_id?: string; scope?: string }>;
}) {
  if (!mcpSpikeEnabled()) {
    notFound();
  }
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }

  const { client_id: clientId, scope } = await searchParams;
  const requestedAll = (scope ?? "").split(" ").filter(Boolean);
  const requested = requestedAll.filter((value) => value.startsWith("mcp:"));
  // `offline_access` (refresh token) dan `openid` bukan pilihan pengguna di layar
  // ini, tetapi harus ikut dikirim agar tidak dibuang dari consent.
  const passthrough = requestedAll.filter(
    (value) => value === "offline_access" || value === "openid",
  );

  return (
    <ConsentForm
      clientId={clientId ?? "(tanpa client_id)"}
      requested={requested}
      passthrough={passthrough}
    />
  );
}
