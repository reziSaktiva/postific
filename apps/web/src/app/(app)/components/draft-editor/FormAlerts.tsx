import { Alert02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

import type { FormNotice } from "./form-shared";
import type { CrossNetworkIssue } from "./network-validation";

/**
 * Banner validasi kuning (T-202.5, ADR-155): dipakai di dalam blok jaringan
 * (pelanggaran per jaringan) dan di atas editor (lintas jaringan). Warna dari
 * token `warning`, bukan nilai mentah.
 */
export function ValidationBanner({
  message,
  className,
}: {
  message: string;
  className?: string;
}) {
  return (
    <Alert
      // Banner inline yang berubah saat pemakai mengetik: pengumuman sopan
      // (`status`), bukan `alert` yang memotong pembaca layar.
      role="status"
      className={cn(
        "border-warning/40 bg-warning/10 text-warning *:[svg]:text-warning",
        className,
      )}
    >
      <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} />
      <AlertTitle>{message}</AlertTitle>
    </Alert>
  );
}

/**
 * Di atas editor: pelanggaran lintas jaringan (banner kuning) dan notice hasil
 * aksi. Pesan jadwal ada di footer, dekat kontrol jadwal (T-205.2). Pelanggaran per jaringan ada di blok jaringan
 * masing-masing (`NetworkBlock`).
 */
export function FormAlerts({
  crossNetworkIssues,
  notice,
}: {
  crossNetworkIssues: CrossNetworkIssue[];
  notice: FormNotice | null;
}) {
  return (
    <>
      {crossNetworkIssues.map((issue) => (
        <ValidationBanner key={issue.code} message={issue.message} />
      ))}
      {notice ? (
        <Alert variant={notice.status === "error" ? "destructive" : "default"}>
          <AlertTitle>{notice.title}</AlertTitle>
        </Alert>
      ) : null}
    </>
  );
}
