"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

import { HugeiconsIcon } from "@hugeicons/react";
import { SquareLock02Icon } from "@hugeicons/core-free-icons";

import { authClient } from "@/lib/better-auth/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

import {
  acceptInviteAction,
  confirmAcceptInviteVerificationAction,
  requestAcceptInviteVerificationAction,
} from "../actions";

/** T-110/KI-053 — cooldown UX murni client-side tombol "Kirim ulang", bukan rate-limit server (itu `verificationAttempts`, per percobaan KODE, bukan per request kirim). */
const RESEND_COOLDOWN_SECONDS = 30;

export function AcceptInviteForm({
  token,
  email,
  isExistingUser,
  onAccepted,
}: {
  token: string;
  email: string;
  isExistingUser: boolean;
  /**
   * Dipanggil setelah `acceptInviteAction` berhasil — parent
   * (`AcceptInvitePageClient`) yang memutuskan kapan menampilkan state
   * "Success" dan redirect, BUKAN component ini. Lihat doc comment di
   * `AcceptInvitePageClient.tsx` untuk alasan pemisahan ini (Server Action
   * memicu refresh RSC route saat ini, yang akan meng-unmount component
   * ini begitu invitation tidak lagi berstatus `pending`).
   */
  onAccepted: () => void;
}) {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * T-110 (KI-053) — jalur `isExistingUser: false` melewati step tambahan
   * SEBELUM `authClient.signUp.email` dipanggil sama sekali: user harus
   * membuktikan kepemilikan inbox email undangan lewat kode OTP 6 digit
   * (dikirim Resend) dulu. `name`/`password` di atas TETAP dipertahankan
   * saat pindah ke step ini (bukan dibuang) — dipakai ulang persis di
   * `handleVerifyCodeSubmit` setelah kode dikonfirmasi benar. Jalur
   * `isExistingUser: true` (sign in) TIDAK PERNAH menyentuh step ini sama
   * sekali.
   */
  const [step, setStep] = useState<"form" | "verify-code">("form");
  const [code, setCode] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  async function finalizeMembership() {
    const result = await acceptInviteAction(token);
    if (result.error) {
      setIsSubmitting(false);
      setError(result.error);
      return;
    }
    setIsSubmitting(false);
    onAccepted();
  }

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

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (isExistingUser) {
        const { error: signInError } = await authClient.signIn.email({
          email,
          password,
        });
        if (signInError) {
          setIsSubmitting(false);
          setError(
            signInError.message ??
              "Password salah. Coba lagi atau reset password Anda.",
          );
          return;
        }

        await finalizeMembership();
        return;
      }

      // T-110 — TIDAK langsung `authClient.signUp.email` di sini. Akun baru
      // hanya boleh dibuat SETELAH kode verifikasi dikonfirmasi benar
      // (lihat `handleVerifyCodeSubmit`).
      const requestResult = await requestAcceptInviteVerificationAction(token);
      if (requestResult.error) {
        setIsSubmitting(false);
        setError(requestResult.error);
        return;
      }

      setIsSubmitting(false);
      setStep("verify-code");
      startResendCooldown();
    } catch {
      setIsSubmitting(false);
      setError("Terjadi kesalahan jaringan. Coba lagi.");
    }
  }

  async function handleVerifyCodeSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const confirmResult = await confirmAcceptInviteVerificationAction(
        token,
        code,
      );
      if (confirmResult.error) {
        setIsSubmitting(false);
        setError(confirmResult.error);
        return;
      }

      const { error: signUpError } = await authClient.signUp.email({
        name,
        email,
        password,
      });
      if (signUpError) {
        setIsSubmitting(false);
        setError(signUpError.message ?? "Gagal membuat akun. Coba lagi.");
        return;
      }

      await finalizeMembership();
    } catch {
      setIsSubmitting(false);
      setError("Terjadi kesalahan jaringan. Coba lagi.");
    }
  }

  async function handleResend() {
    setError(null);
    const result = await requestAcceptInviteVerificationAction(token);
    if (result.error) {
      setError(result.error);
      return;
    }
    startResendCooldown();
  }

  const emailField = (
    <Field>
      <FieldLabel htmlFor="accept-invite-email">
        {step === "verify-code" ? "Kode terkirim" : "Email"}
      </FieldLabel>
      <InputGroup>
        <InputGroupInput
          id="accept-invite-email"
          type="email"
          value={email}
          readOnly
        />
        <InputGroupAddon>
          <HugeiconsIcon
            icon={SquareLock02Icon}
            strokeWidth={2}
            aria-hidden="true"
          />
        </InputGroupAddon>
      </InputGroup>
      <FieldDescription>
        {step === "verify-code"
          ? "Masukkan kode 6 digit yang kami kirim ke email ini."
          : "Email terkunci sesuai undangan, tidak bisa diubah."}
      </FieldDescription>
    </Field>
  );

  return (
    <FieldGroup>
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>{error}</AlertTitle>
        </Alert>
      ) : null}

      {isExistingUser ? (
        <Alert>
          <AlertTitle>Email ini sudah terdaftar</AlertTitle>
          <AlertDescription>
            Masuk untuk melanjutkan bergabung ke workspace.
          </AlertDescription>
        </Alert>
      ) : null}

      {step === "form" ? (
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            {emailField}

            {isExistingUser ? null : (
              <Field>
                <FieldLabel htmlFor="accept-invite-name">
                  Nama Lengkap
                </FieldLabel>
                <Input
                  id="accept-invite-name"
                  name="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
            )}

            <Field>
              <FieldLabel htmlFor="accept-invite-password">Password</FieldLabel>
              <Input
                id="accept-invite-password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>

            <Field>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Spinner /> : null}
                {isExistingUser
                  ? "Masuk & Gabung ke Workspace"
                  : "Buat Akun & Gabung ke Workspace"}
              </Button>
            </Field>
          </FieldGroup>
        </form>
      ) : (
        <form onSubmit={handleVerifyCodeSubmit}>
          <FieldGroup>
            {emailField}

            <Field>
              <FieldLabel htmlFor="accept-invite-code">
                Kode Verifikasi
              </FieldLabel>
              <Input
                id="accept-invite-code"
                name="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                maxLength={6}
                // eslint-disable-next-line tailwindcss/no-arbitrary-value -- letter-spacing lebar untuk input kode OTP (desain Claude Design dikunci, T-110); tidak ada utility Tailwind native yang sedekat ini ke 0.5em (tracking-widest hanya 0.1em).
                className="text-center tracking-[0.5em]"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
              />
            </Field>

            <Field>
              <Button
                type="submit"
                disabled={isSubmitting || code.length !== 6}
              >
                {isSubmitting ? <Spinner /> : null}
                Verifikasi & Buat Akun
              </Button>
            </Field>
          </FieldGroup>
        </form>
      )}

      {isExistingUser ? (
        <Link
          href="/forgot-password"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Lupa password?
        </Link>
      ) : null}

      {step === "verify-code" ? (
        <button
          type="button"
          onClick={handleResend}
          disabled={resendCooldown > 0}
          className="text-sm font-medium text-primary underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
        >
          {resendCooldown > 0
            ? `Kirim ulang (${resendCooldown}s)`
            : "Kirim ulang"}
        </button>
      ) : null}
    </FieldGroup>
  );
}
