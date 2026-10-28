"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  buildPublicPagePath,
  type StartPageRecord,
} from "@/domains/start-page";

import { setStartPagePublishedAction } from "../actions";

/**
 * Card "Share" Page Editor — LOCKED PATTERN T-072: URL halaman publik
 * (readonly + tombol Salin) dan baris "Status Halaman" dengan chip +
 * tombol Published/Unpublished. URL memakai slug TERSIMPAN (bukan draft).
 * `appOrigin` dari `BETTER_AUTH_URL` (server); bila kosong, origin diambil
 * dari `window.location` saat menyalin dan yang tampil hanya path.
 */
export function ShareCard({
  page,
  appOrigin,
  onPublishedChange,
}: {
  page: StartPageRecord;
  appOrigin: string | null;
  onPublishedChange: (page: StartPageRecord) => void;
}) {
  const id = useId();
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (copiedTimer.current !== null) clearTimeout(copiedTimer.current);
    },
    [],
  );

  const path = buildPublicPagePath(page.slug);
  const displayUrl = appOrigin ? `${appOrigin}${path}` : path;

  async function handleCopy() {
    const url = appOrigin ? displayUrl : `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (copiedTimer.current !== null) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => {
        copiedTimer.current = null;
        setCopied(false);
      }, 2000);
    } catch {
      toast.error("Gagal menyalin. Salin URL secara manual.");
    }
  }

  function handleTogglePublished() {
    startTransition(async () => {
      const result = await setStartPagePublishedAction(!page.isPublished);
      if (result.error !== undefined) {
        toast.error(result.error);
        return;
      }
      onPublishedChange(result.data);
      toast.success(
        result.data.isPublished
          ? "Halaman dipublish."
          : "Halaman di-unpublish.",
      );
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Share</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <Field>
          <FieldLabel htmlFor={`${id}-url`}>URL Halaman Publik</FieldLabel>
          <span className="flex gap-2">
            <Input id={`${id}-url`} readOnly value={displayUrl} />
            <Button type="button" variant="outline" onClick={handleCopy}>
              {copied ? "Disalin!" : "Salin"}
            </Button>
          </span>
          <FieldDescription>
            URL ini aktif begitu halaman di-publish.
          </FieldDescription>
        </Field>

        <Field orientation="horizontal" className="items-center">
          <span className="flex flex-1 flex-col gap-0.5">
            <span className="text-sm font-semibold text-foreground">
              Status Halaman
            </span>
            <span className="text-sm text-muted-foreground">
              Saat Published, halaman ini bisa diakses publik tanpa login.
            </span>
          </span>
          <span className="flex items-center gap-2.5">
            <Badge variant={page.isPublished ? "success" : "secondary"}>
              {page.isPublished ? "Published" : "Unpublished"}
            </Badge>
            <Button
              type="button"
              variant={page.isPublished ? "outline" : "default"}
              size="sm"
              disabled={isPending}
              onClick={handleTogglePublished}
            >
              {isPending ? <Spinner /> : null}
              {page.isPublished ? "Unpublish" : "Publish"}
            </Button>
          </span>
        </Field>
      </CardContent>
    </Card>
  );
}
