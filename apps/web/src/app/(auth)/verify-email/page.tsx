import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { VerifyEmailCard } from "./components/VerifyEmailCard";

/**
 * Halaman "menunggu verifikasi" (T-005.4, AS-D04) — desain dikunci Claude
 * Design `templates/auth-verify-email.html` (dicek sebelum delegasi,
 * AGENTS.md rule 17 terpenuhi). Diisi lewat query `?email=` yang dikirim
 * `RegisterForm` setelah `authClient.signUp.email()` sukses — BUKAN dari
 * sesi, karena begitu `requireEmailVerification` di-flip jadi `true`
 * (T-005.5, masih `false` untuk saat ini) `signUp.email()` Better Auth
 * tidak lagi membuat session (lihat `requireEmailVerificationEnabled()` di
 * `lib/env.ts`), jadi tidak ada sesi untuk dibaca RSC pada titik ini.
 */
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  if (!email) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tautan Tidak Valid</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Alert variant="destructive">
            <AlertTitle>Email tidak ditemukan.</AlertTitle>
            <AlertDescription>
              Daftar ulang untuk mendapatkan tautan verifikasi baru.
            </AlertDescription>
          </Alert>
          <Link
            href="/register"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Kembali ke pendaftaran
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 text-center">
        <VerifyEmailCard email={email} />
      </CardContent>
    </Card>
  );
}
