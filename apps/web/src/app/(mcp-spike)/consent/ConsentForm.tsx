"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { authClient } from "@/lib/better-auth/client";

const SCOPE_COPY: Record<string, { title: string; description: string }> = {
  "mcp:read": {
    title: "read — Baca",
    description: "Melihat data workspace. Tidak mengubah apa pun.",
  },
  "mcp:draft": {
    title: "draft — Buat dan ubah draft",
    description: "Membuat dan mengedit draft. Tidak menjadwalkan.",
  },
  "mcp:schedule": {
    title: "schedule — Jadwalkan post",
    description: "Berdampak: post terbit otomatis. Tidak aktif bawaan.",
  },
};

export function ConsentForm({
  clientId,
  requested,
}: {
  clientId: string;
  requested: string[];
}) {
  const [granted, setGranted] = useState<string[]>(
    requested.filter((scope) => scope !== "mcp:schedule"),
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function toggle(scope: string, checked: boolean) {
    setGranted((current) =>
      checked ? [...current, scope] : current.filter((s) => s !== scope),
    );
  }

  async function respond(accept: boolean) {
    setError(null);
    setIsSubmitting(true);
    const { error: consentError } = await authClient.oauth2.consent({
      accept,
      scope: accept ? granted.join(" ") : undefined,
    });
    if (consentError) {
      setIsSubmitting(false);
      setError(consentError.message ?? "Persetujuan gagal disimpan.");
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center p-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Izinkan klien AI?</CardTitle>
          <CardDescription>
            Klien <code>{clientId}</code> (terdaftar sendiri). Langkah 2 dari 2
            (spike T-148).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ItemGroup className="gap-2">
            {requested.map((scope) => (
              <Item key={scope} variant="outline" asChild>
                <label htmlFor={scope}>
                  <ItemMedia>
                    <Checkbox
                      id={scope}
                      checked={granted.includes(scope)}
                      onCheckedChange={(checked) =>
                        toggle(scope, checked === true)
                      }
                    />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>{SCOPE_COPY[scope]?.title ?? scope}</ItemTitle>
                    <ItemDescription>
                      {SCOPE_COPY[scope]?.description}
                    </ItemDescription>
                  </ItemContent>
                </label>
              </Item>
            ))}
          </ItemGroup>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {/* eslint-disable-next-line no-restricted-syntax -- T-148 spike: komposisi Tailwind shadcn (ADR-097), sementara sampai T-151 */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              disabled={isSubmitting}
              onClick={() => respond(false)}
            >
              Tolak
            </Button>
            <Button
              className="flex-1"
              disabled={isSubmitting || granted.length === 0}
              onClick={() => respond(true)}
            >
              Izinkan
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
