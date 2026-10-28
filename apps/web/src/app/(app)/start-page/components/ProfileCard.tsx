"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
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
  START_PAGE_AVATAR_ACCEPT,
  START_PAGE_AVATAR_MAX_BYTES,
  START_PAGE_AVATAR_MIME_TYPES,
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
 * Card "Profil Halaman" Page Editor (T-072/T-073/T-159): judul, slug, bio,
 * foto profil (unggah JPG/PNG, pola sama Settings → Akun) dan selector tema.
 * Draft di-lift ke `StartPageEditor` supaya Preview langsung mengikuti
 * isian; tersimpan lewat tombol "Simpan Perubahan".
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDraftChange(patch: Partial<ProfileDraft>) {
    setError(null);
    onDraftChange(patch);
  }

  const dirty = isProfileDirty(page, draft);
  const slugWarning = isPublishedSlugChange(page, draft);
  const avatarPreview = draft.removeAvatar
    ? null
    : (draft.avatarObjectUrl ?? sanitizeAvatarUrl(draft.avatarUrl));
  const previousObjectUrl = useRef<string | null>(null);

  useEffect(() => {
    const previous = previousObjectUrl.current;
    previousObjectUrl.current = draft.avatarObjectUrl;
    if (previous && previous !== draft.avatarObjectUrl) {
      URL.revokeObjectURL(previous);
    }
  }, [draft.avatarObjectUrl]);

  useEffect(
    () => () => {
      if (previousObjectUrl.current) {
        URL.revokeObjectURL(previousObjectUrl.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!draft.avatarFile && fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [draft.avatarFile]);

  function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    if (!START_PAGE_AVATAR_MIME_TYPES[file.type]) {
      event.target.value = "";
      setError("Format avatar harus JPG atau PNG.");
      return;
    }
    if (file.size > START_PAGE_AVATAR_MAX_BYTES) {
      event.target.value = "";
      setError("Ukuran avatar maksimal 2MB.");
      return;
    }
    handleDraftChange({
      avatarFile: file,
      avatarObjectUrl: URL.createObjectURL(file),
      removeAvatar: false,
    });
  }

  function handleRemoveAvatar() {
    handleDraftChange({
      avatarFile: null,
      avatarObjectUrl: null,
      removeAvatar: true,
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const patch = buildProfilePatch(page, draft);
    if (Object.keys(patch).length === 0 && !draft.avatarFile) return;
    setError(null);
    const avatarForm = new FormData();
    if (draft.avatarFile) avatarForm.set("avatar", draft.avatarFile);
    startTransition(async () => {
      const result = await updateStartPageProfileAction(
        patch,
        draft.avatarFile ? avatarForm : undefined,
      );
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

            {/* eslint-disable-next-line no-restricted-syntax -- T-159, pola sama ProfileForm Settings (avatar + input file) */}
            <div className="flex items-center gap-5">
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
              <Field>
                <FieldLabel htmlFor={`${id}-avatar`}>Foto Profil</FieldLabel>
                <Input
                  ref={fileInputRef}
                  id={`${id}-avatar`}
                  type="file"
                  accept={START_PAGE_AVATAR_ACCEPT}
                  disabled={isPending}
                  aria-describedby={`${id}-avatar-desc`}
                  onChange={handleAvatarChange}
                />
                <FieldDescription id={`${id}-avatar-desc`}>
                  JPG/PNG, maks 2MB. Hapus foto untuk memakai inisial.
                </FieldDescription>
                {avatarPreview ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={handleRemoveAvatar}
                  >
                    Hapus foto
                  </Button>
                ) : null}
              </Field>
            </div>

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
