import { Alert, AlertTitle } from "@/components/ui/alert";

import type { FormNotice } from "./form-shared";

/** Alert validasi dan notice di atas form (urutan sama dengan Modal sebelum dipecah). */
export function FormAlerts({
  pinterestConstraintMessage,
  mediaMinimumMessage,
  mixedStoryCaptionMessage,
  scheduleTimeMessage,
  notice,
}: {
  pinterestConstraintMessage: string | null;
  mediaMinimumMessage: string | null;
  mixedStoryCaptionMessage: string | null;
  scheduleTimeMessage: string | null;
  notice: FormNotice | null;
}) {
  return (
    <>
      {pinterestConstraintMessage ? (
        <Alert variant="destructive">
          <AlertTitle>{pinterestConstraintMessage}</AlertTitle>
        </Alert>
      ) : null}
      {mediaMinimumMessage ? (
        <Alert variant="destructive">
          <AlertTitle>{mediaMinimumMessage}</AlertTitle>
        </Alert>
      ) : null}
      {mixedStoryCaptionMessage ? (
        <Alert variant="destructive">
          <AlertTitle>{mixedStoryCaptionMessage}</AlertTitle>
        </Alert>
      ) : null}
      {scheduleTimeMessage ? (
        <Alert variant="destructive">
          <AlertTitle>{scheduleTimeMessage}</AlertTitle>
        </Alert>
      ) : null}
      {notice ? (
        <Alert variant={notice.status === "error" ? "destructive" : "default"}>
          <AlertTitle>{notice.title}</AlertTitle>
        </Alert>
      ) : null}
    </>
  );
}
