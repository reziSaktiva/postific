"use client";

import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type FormEvent,
} from "react";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

import {
  ALLOWED_AVATAR_ACCEPT,
  MAX_AVATAR_BYTES,
  buildTimeZoneOptionGroups,
  MAX_NAME_LENGTH,
  normalizeDetectedTimeZone,
  type UserProfileRecord,
} from "@/domains/identity";
import { getInitials } from "@/lib/utils";

import {
  SETTINGS_BREADCRUMB_GROUP,
  SettingsPageHead,
} from "../../components/SettingsPageHead";
import { updateProfileAction } from "../actions";

// T-099.1: FileInput Astryx (label sr-only + description) diganti native
// `<input type="file">` (Input shadcn) — dipakai satu FieldDescription
// visible di bawahnya, bukan lagi dobel render (sr-only + Text terpisah)
// seperti versi Astryx; hack ganda itu khusus mengakali FileInput Astryx
// yang selalu merender description-nya sendiri, sudah tidak relevan di sini.
const AVATAR_HINT_TEXT = "JPG/PNG, maks 2MB";

// T-147 (ADR-146), rancangan terkunci artifact Postific (ScreenSettingsProfile).
const TIME_ZONE_HINT_TEXT =
  "Jadwal dan riwayat posting ditampilkan di zona waktu ini. Waktu tetap disimpan dalam UTC.";
const TIME_ZONE_DETECTED_TEXT = "Terdeteksi otomatis dari browser Anda.";

// Zona browser hanya ada di client: `getServerSnapshot` null supaya render
// server dan hidrasi pertama identik, lalu nilai browser muncul setelahnya.
const subscribeNever = () => () => {};
const getBrowserTimeZone = () =>
  normalizeDetectedTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
const getNullSnapshot = () => null;
const getTrue = () => true;
const getFalse = () => false;

export function ProfileForm({ profile }: { profile: UserProfileRecord }) {
  const [name, setName] = useState(profile.name);
  const [image, setImage] = useState(profile.image);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  // Zona tersimpan (server) vs pilihan saat ini (belum disimpan, T-147).
  const [savedTimeZone, setSavedTimeZone] = useState(profile.timeZone);
  const [savedTimeZoneSource, setSavedTimeZoneSource] = useState(
    profile.timeZoneSource,
  );
  const [timeZone, setTimeZone] = useState(profile.timeZone);
  const [usedBrowserZone, setUsedBrowserZone] = useState(false);
  // Auto-deteksi (layout) bisa mengubah zona tersimpan sesudah form dirender;
  // sinkronkan state zona dari prop tanpa mereset field lain.
  const profileZoneKey = `${profile.timeZone}|${profile.timeZoneSource}`;
  const [syncedZoneKey, setSyncedZoneKey] = useState(profileZoneKey);
  if (syncedZoneKey !== profileZoneKey) {
    setSyncedZoneKey(profileZoneKey);
    setSavedTimeZone(profile.timeZone);
    setSavedTimeZoneSource(profile.timeZoneSource);
    setTimeZone(profile.timeZone);
    setUsedBrowserZone(false);
  }
  const browserTimeZone = useSyncExternalStore(
    subscribeNever,
    getBrowserTimeZone,
    getNullSnapshot,
  );
  const mounted = useSyncExternalStore(subscribeNever, getTrue, getFalse);
  // Label offset/singkatan dihitung klien (DST ikut), hanya setelah mount.
  const timeZoneGroups = useMemo(
    () => (mounted ? buildTimeZoneOptionGroups(new Date(), savedTimeZone) : []),
    [mounted, savedTimeZone],
  );
  const showDetectedNote =
    savedTimeZoneSource === "detected" && timeZone === savedTimeZone;
  const showUseBrowserZone =
    browserTimeZone !== null && timeZone !== browserTimeZone;
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // File baru yang belum tersimpan didahulukan sebagai preview, jatuh balik
  // ke avatar tersimpan (`image`), lalu ke initials via `AvatarFallback`
  // (`getInitials`, @/lib/utils — shadcn `Avatar` tidak otomatis menurunkan
  // inisial dari nama seperti Astryx).
  const avatarPreviewUrl = useMemo(
    () => (avatarFile ? URL.createObjectURL(avatarFile) : (image ?? undefined)),
    [avatarFile, image],
  );

  // Revoke blob URL di atas begitu diganti (file lain dipilih) atau komponen
  // unmount — mencegah blob URL menumpuk tiap kali user ganti pilihan avatar
  // sebelum submit. Bukan setState, jadi tidak melanggar react-hooks/set-state-in-effect.
  useEffect(() => {
    if (!avatarFile || !avatarPreviewUrl) return;
    return () => URL.revokeObjectURL(avatarPreviewUrl);
  }, [avatarPreviewUrl, avatarFile]);

  function handleAvatarChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setIsSuccess(false);

    // Validasi ukuran client-side (UX, bukan otoritatif) — sebelumnya
    // ditegakkan otomatis oleh `maxSize` Astryx `FileInput`; native
    // `<input type="file">` shadcn tidak punya mekanisme setara, jadi
    // dicek manual di sini. Validasi otoritatif tetap di
    // `IdentityService.updateProfile` (server, `MAX_AVATAR_BYTES` sama).
    if (file && file.size > MAX_AVATAR_BYTES) {
      setError(`Ukuran file maksimal ${MAX_AVATAR_BYTES / (1024 * 1024)}MB.`);
      e.target.value = "";
      return;
    }

    setError(null);
    setAvatarFile(file);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsSuccess(false);

    if (name.trim().length > MAX_NAME_LENGTH) {
      setError(`Nama maksimal ${MAX_NAME_LENGTH} karakter.`);
      return;
    }

    setIsSubmitting(true);

    const formData = new FormData();
    formData.set("name", name);
    if (avatarFile) {
      formData.set("avatar", avatarFile);
    }
    if (timeZone !== savedTimeZone) {
      formData.set("timeZone", timeZone);
      formData.set(
        "timeZoneSource",
        usedBrowserZone && timeZone === browserTimeZone ? "detected" : "manual",
      );
    }

    try {
      const result = await updateProfileAction(formData);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setName(result.name);
      setImage(result.image);
      setAvatarFile(null);
      setSavedTimeZone(result.timeZone);
      setSavedTimeZoneSource(result.timeZoneSource);
      setTimeZone(result.timeZone);
      setUsedBrowserZone(false);
      setIsSuccess(true);
    } catch {
      setError("Gagal menyimpan profil. Coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    /* eslint-disable-next-line no-restricted-syntax -- T-099.1: file ini
       sudah dimigrasi ke komposisi Tailwind shadcn (ADR-097), bukan lagi
       VStack Astryx. */
    <div className="flex flex-col gap-4 p-4">
      <SettingsPageHead
        pageName="Profile"
        breadcrumb={`${SETTINGS_BREADCRUMB_GROUP.account} / Profile`}
      />

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>{error}</AlertTitle>
        </Alert>
      ) : null}
      {isSuccess ? (
        <Alert>
          <AlertTitle>Profil berhasil diperbarui.</AlertTitle>
        </Alert>
      ) : null}

      <Card>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              {/* eslint-disable-next-line no-restricted-syntax -- T-099.1, sama seperti di atas */}
              <div className="flex items-center gap-5">
                {/* KI-055 (poin 2): `size="lg"` (40px, ukuran terbesar
                    yang tersedia di `avatar.tsx`) masih jauh lebih kecil
                    dari mockup `templates/settings-profile.html`
                    (`.avatar-lg`, 88px). Di-override langsung ke
                    `size-22` (22 * 4px = 88px, token spacing default
                    Tailwind v4, match persis) + font initial diperbesar
                    mengikuti proporsi mockup (28px, dibulatkan ke
                    `text-2xl` 24px — token terdekat yang tersedia). */}
                <Avatar className="size-22">
                  <AvatarImage src={avatarPreviewUrl} alt={name} />
                  <AvatarFallback className="text-2xl font-bold">
                    {getInitials(name)}
                  </AvatarFallback>
                </Avatar>
                <Field>
                  <FieldLabel htmlFor="profile-avatar">Foto Profil</FieldLabel>
                  <Input
                    id="profile-avatar"
                    type="file"
                    accept={ALLOWED_AVATAR_ACCEPT}
                    onChange={handleAvatarChange}
                  />
                  <FieldDescription>{AVATAR_HINT_TEXT}</FieldDescription>
                </Field>
              </div>

              <Field>
                <FieldLabel htmlFor="profile-name">Nama</FieldLabel>
                <Input
                  id="profile-name"
                  name="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="profile-email">Email</FieldLabel>
                <Input
                  id="profile-email"
                  type="email"
                  value={profile.email}
                  disabled
                  readOnly
                />
                <FieldDescription>
                  Email tidak dapat diubah di sini
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="profile-time-zone">Zona waktu</FieldLabel>
                <Select
                  value={timeZone}
                  onValueChange={(value) => {
                    setTimeZone(value);
                    setUsedBrowserZone(false);
                    setIsSuccess(false);
                  }}
                >
                  <SelectTrigger id="profile-time-zone" className="w-full">
                    {mounted ? (
                      <SelectValue />
                    ) : (
                      <SelectValue>{timeZone}</SelectValue>
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {timeZoneGroups.map((group) => (
                      <SelectGroup key={group.region}>
                        <SelectLabel>{group.region}</SelectLabel>
                        {group.options.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription>{TIME_ZONE_HINT_TEXT}</FieldDescription>
                {showDetectedNote ? (
                  <FieldDescription>{TIME_ZONE_DETECTED_TEXT}</FieldDescription>
                ) : null}
                {showUseBrowserZone ? (
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="self-start"
                    onClick={() => {
                      setTimeZone(browserTimeZone);
                      setUsedBrowserZone(true);
                      setIsSuccess(false);
                    }}
                  >
                    Pakai zona waktu browser ({browserTimeZone})
                  </Button>
                ) : null}
              </Field>

              <Field>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <Spinner /> : null}
                  Simpan Perubahan
                </Button>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
