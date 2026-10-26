"use client";

import { useState } from "react";
import Link from "next/link";

import { authClient } from "@/lib/better-auth/client";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";

/** Cooldown UX murni client-side, pola sama `AcceptInviteForm.tsx` (T-110). */
const RESEND_COOLDOWN_SECONDS = 30;

export function VerifyEmailCard({ email }: { email: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  function startResendCooldown() {
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
    const interval = setInterval(() => {
      setResendCooldown((current) => {
        if (current <= 1) {
          clearInterval(interval);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
  }

  async function handleResend() {
    setError(null);
    setIsResending(true);

    const { error: resendError } = await authClient.sendVerificationEmail({
      email,
      callbackURL: "/",
    });

    setIsResending(false);

    if (resendError) {
      setError(
        resendError.message ??
          "Gagal mengirim ulang email verifikasi. Coba lagi.",
      );
      return;
    }

    startResendCooldown();
  }

  return (
    <>
      <Text variant="h3">Verifikasi Email Anda</Text>
      <Text variant="muted">
        Kami sudah mengirim tautan verifikasi ke{" "}
        <strong className="font-semibold text-foreground">{email}</strong>. Klik
        tautan tersebut untuk mengaktifkan akun.
      </Text>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>{error}</AlertTitle>
        </Alert>
      ) : null}

      <Button
        className="w-full"
        disabled={isResending || resendCooldown > 0}
        onClick={handleResend}
      >
        {isResending ? <Spinner /> : null}
        {resendCooldown > 0
          ? `Kirim Ulang Email (${resendCooldown}s)`
          : "Kirim Ulang Email"}
      </Button>

      <Text variant="muted">
        Salah alamat email?{" "}
        <Link
          href="/register"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Kembali ke pendaftaran
        </Link>
      </Text>
    </>
  );
}
