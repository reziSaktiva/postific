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
  const requested = (scope ?? "")
    .split(" ")
    .filter((value) => value.startsWith("mcp:"));

  return (
    <ConsentForm
      clientId={clientId ?? "(tanpa client_id)"}
      requested={requested}
    />
  );
}
