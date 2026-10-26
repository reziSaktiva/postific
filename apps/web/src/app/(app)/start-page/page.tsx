import { Alert, AlertTitle } from "@/components/ui/alert";
import { getServerEnv } from "@/lib/env";

import { getStartPageAction } from "./actions";
import { StartPageEditor } from "./components/StartPageEditor";

/**
 * Route `/start-page` (T-072/T-073/T-074) — Server Component tipis: baca
 * data editor lewat Server Action `getStartPageAction` (RBAC + RLS di
 * service) lalu serahkan ke `StartPageEditor` (Client Component).
 * `data: null` = workspace belum punya halaman (state "Buat Halaman").
 * Origin URL publik dari `BETTER_AUTH_URL` (pola sama halaman publik).
 */
export default async function Page() {
  const result = await getStartPageAction();

  if (result.error !== undefined) {
    return (
      <Alert variant="destructive">
        <AlertTitle>{result.error}</AlertTitle>
      </Alert>
    );
  }

  return (
    <StartPageEditor
      initialPage={result.data}
      appOrigin={getServerEnv().BETTER_AUTH_URL || null}
    />
  );
}
