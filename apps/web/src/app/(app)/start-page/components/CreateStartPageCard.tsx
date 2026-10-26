"use client";

import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  SLUG_MAX_LENGTH,
  START_PAGE_TITLE_MAX_LENGTH,
  type StartPageRecord,
} from "@/domains/start-page";

import { createStartPageAction } from "../actions";

/**
 * State "belum ada halaman": form "Buat halaman" (judul + slug). Halaman
 * baru selalu berstatus draft (Unpublished). Validasi/konflik slug datang
 * dari service lewat `error`.
 */
export function CreateStartPageCard({
  onCreated,
}: {
  onCreated: (page: StartPageRecord) => void;
}) {
  const id = useId();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canSubmit = title.trim() !== "" && slug.trim() !== "";

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    setError(null);
    startTransition(async () => {
      const result = await createStartPageAction({ title, slug });
      if (result.error !== undefined) {
        setError(result.error);
        return;
      }
      onCreated(result.data);
      toast.success("Halaman dibuat. Lengkapi profil dan tambahkan link.");
    });
  }

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>Buat Halaman</CardTitle>
        <CardDescription>
          Halaman publik berisi daftar link Anda, bisa dibagikan ke siapa saja
          tanpa login. Halaman baru berstatus Unpublished sampai Anda
          mempublikasikannya.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit} noValidate>
        <CardContent>
          <FieldGroup className="gap-5">
            {error ? (
              <Alert variant="destructive">
                <AlertTitle>{error}</AlertTitle>
              </Alert>
            ) : null}
            <Field>
              <FieldLabel htmlFor={`${id}-title`}>Judul Halaman</FieldLabel>
              <Input
                id={`${id}-title`}
                value={title}
                maxLength={START_PAGE_TITLE_MAX_LENGTH}
                placeholder="Kopi Selasar"
                disabled={isPending}
                onChange={(e) => setTitle(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-slug`}>Slug (URL Halaman)</FieldLabel>
              <Input
                id={`${id}-slug`}
                value={slug}
                maxLength={SLUG_MAX_LENGTH}
                placeholder="kopi-selasar"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                disabled={isPending}
                aria-describedby={`${id}-slug-desc`}
                onChange={(e) => setSlug(e.target.value)}
              />
              <FieldDescription id={`${id}-slug-desc`}>
                Huruf kecil, angka, dan tanda hubung. Menjadi alamat halaman
                publik: /u/{slug.trim().toLowerCase() || "slug-anda"}
              </FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className="mt-5 justify-end">
          <Button type="submit" disabled={!canSubmit || isPending}>
            {isPending ? <Spinner /> : null}
            Buat Halaman
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
