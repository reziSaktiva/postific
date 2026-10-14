import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { googleOAuthEnabled, requireEmailVerificationEnabled } from "@/lib/env";

import { RegisterForm } from "./components/RegisterForm";

export default function RegisterPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Buat Akun</CardTitle>
        <CardDescription>
          Mulai kelola publikasi konten tim Anda
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <RegisterForm
          isGoogleEnabled={googleOAuthEnabled()}
          requireEmailVerification={requireEmailVerificationEnabled()}
        />

        <Text variant="muted" className="text-center">
          Sudah punya akun?{" "}
          <Link
            href="/login"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Masuk
          </Link>
        </Text>
      </CardContent>
    </Card>
  );
}
