"use client";

import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
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
import { Textarea } from "@/components/ui/textarea";
import { START_PAGE_THEME_META } from "@/components/start-page/start-page-theme";
import {
  SLUG_MAX_LENGTH,
  START_PAGE_BIO_MAX_LENGTH,
  START_PAGE_TITLE_MAX_LENGTH,
  sanitizeAvatarUrl,
  type StartPageRecord,
} from "@/domains/start-page";
import { getInitials } from "@/lib/utils";

import { updateStartPageProfileAction } from "../actions";
import {
  buildProfilePatch,
  isProfileDirty,
  isPublishedSlugChange,
  type ProfileDraft,
} from "./profile-draft";
import { ThemeToggleGroup } from "./ThemeToggleGroup";

/**
 * Card "Profil Halaman" Page Editor (T-072/T-073): judul, slug, bio, avatar
 * (URL https) dan selector tema. Draft di-lift ke `StartPageEditor` supaya
 * Preview langsung mengikuti isian; tersimpan lewat tombol "Simpan
 * Perubahan" (patch hanya field yang berubah).
 */
export function ProfileCard({
  page,
  draft,
  onDraftChange,
  onSaved,
}: {
  page: StartPageRecord;
  draft: ProfileDraft;
  onDraftChange: (patch: Partial<ProfileDraft>) => void;
  onSaved: (page: StartPageRecord) => void;
}) {
  const id = useId();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDraftChange(patch: Partial<ProfileDraft>) {
    setError(null);
    onDraftChange(patch);
  }

  const dirty = isProfileDirty(page, draft);
  const slugWarning = isPublishedSlugChange(page, draft);
  const avatarPreview = sanitizeAvatarUrl(draft.avatarUrl);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const patch = buildProfilePatch(page, draft);
    if (Object.keys(patch).length === 0) return;
    setError(null);
    startTransition(async () => {
      const result = await updateStartPageProfileAction(patch);
      if (result.error !== undefined) {
        setError(result.error);
        return;
      }
      onSaved(result.data);
      toast.success("Perubahan profil disimpan.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profil Halaman</CardTitle>
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
                value={draft.title}
                maxLength={START_PAGE_TITLE_MAX_LENGTH}
                disabled={isPending}
                onChange={(e) => handleDraftChange({ title: e.target.value })}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor={`${id}-slug`}>Slug (URL Halaman)</FieldLabel>
              <Input
                id={`${id}-slug`}
                value={draft.slug}
                maxLength={SLUG_MAX_LENGTH}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                disabled={isPending}
                aria-describedby={`${id}-slug-desc`}
                onChange={(e) => handleDraftChange({ slug: e.target.value })}
              />
              <FieldDescription id={`${id}-slug-desc`}>
                Huruf kecil, angka, dan tanda hubung. Menjadi alamat halaman
                publik: /u/{draft.slug.trim().toLowerCase() || "slug-anda"}
              </FieldDescription>
              {slugWarning ? (
                <Alert variant="destructive">
                  <AlertTitle>Halaman sedang Published</AlertTitle>
                  <AlertDescription>
                    Mengubah slug akan mematikan tautan lama yang sudah Anda
                    bagikan. Pengunjung yang membuka alamat lama akan melihat
                    halaman tidak ditemukan.
                  </AlertDescription>
                </Alert>
              ) : null}
            </Field>

            <Field>
              <FieldLabel htmlFor={`${id}-bio`}>Bio (opsional)</FieldLabel>
              <Textarea
                id={`${id}-bio`}
                rows={2}
                value={draft.bio}
                maxLength={START_PAGE_BIO_MAX_LENGTH}
                disabled={isPending}
                onChange={(e) => handleDraftChange({ bio: e.target.value })}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor={`${id}-avatar`}>
                URL Avatar (opsional)
              </FieldLabel>
              <span className="flex items-center gap-3">
                <Avatar className="size-10">
                  {avatarPreview ? (
                    <AvatarImage
                      src={avatarPreview}
                      alt=""
                      referrerPolicy="no-referrer"
                    />
                  ) : null}
                  <AvatarFallback className="bg-primary text-sm font-bold text-primary-foreground">
                    {getInitials(draft.title || page.title)}
                  </AvatarFallback>
                </Avatar>
                <Input
                  id={`${id}-avatar`}
                  type="url"
                  inputMode="url"
                  placeholder="https://contoh.com/foto.jpg"
                  value={draft.avatarUrl}
                  disabled={isPending}
                  aria-describedby={`${id}-avatar-desc`}
                  onChange={(e) =>
                    handleDraftChange({ avatarUrl: e.target.value })
                  }
                />
              </span>
              <FieldDescription id={`${id}-avatar-desc`}>
                Hanya tautan https. Kosongkan untuk memakai inisial.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel id={`${id}-theme-label`}>Tema Halaman</FieldLabel>
              <ThemeToggleGroup
                value={draft.theme}
                labelledBy={`${id}-theme-label`}
                disabled={isPending}
                onValueChange={(theme) => handleDraftChange({ theme })}
              />
              <FieldDescription data-testid="theme-description">
                {START_PAGE_THEME_META[draft.theme].description}
              </FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className="mt-5 justify-end">
          <Button type="submit" disabled={!dirty || isPending}>
            {isPending ? <Spinner /> : null}
            Simpan Perubahan
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
