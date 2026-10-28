"use client";

import { useId, useState, useTransition } from "react";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  START_PAGE_LINK_LABEL_MAX_LENGTH,
  type StartPageLinkRecord,
} from "@/domains/start-page";

import { addStartPageLinkAction, updateStartPageLinkAction } from "../actions";

/** `null` = tambah tautan baru; objek = edit tautan itu. */
export type LinkFormTarget = { link: StartPageLinkRecord | null };

function LinkForm({
  link,
  onClose,
  onSaved,
}: {
  link: StartPageLinkRecord | null;
  onClose: () => void;
  onSaved: (link: StartPageLinkRecord, isNew: boolean) => void;
}) {
  const id = useId();
  const [label, setLabel] = useState(link?.label ?? "");
  const [url, setUrl] = useState(link?.url ?? "");
  const [isActive, setIsActive] = useState(link?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canSubmit = label.trim() !== "" && url.trim() !== "";

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    setError(null);

    startTransition(async () => {
      if (link === null) {
        const result = await addStartPageLinkAction({ label, url, isActive });
        if (result.error !== undefined) return setError(result.error);
        onSaved(result.data, true);
        return;
      }
      // Edit: kirim hanya field yang berubah (service menolak patch kosong).
      const patch: { label?: string; url?: string; isActive?: boolean } = {};
      if (label.trim() !== link.label) patch.label = label;
      if (url.trim() !== link.url) patch.url = url;
      if (isActive !== link.isActive) patch.isActive = isActive;
      if (Object.keys(patch).length === 0) {
        onClose();
        return;
      }
      const result = await updateStartPageLinkAction(link.id, patch);
      if (result.error !== undefined) return setError(result.error);
      onSaved(result.data, false);
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{link ? "Edit Link" : "Tambah Link"}</DialogTitle>
        <DialogDescription>
          Link tampil di halaman publik sebagai kartu, sesuai urutan di daftar.
        </DialogDescription>
      </DialogHeader>

      <FieldGroup className="gap-4">
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>{error}</AlertTitle>
          </Alert>
        ) : null}

        <Field>
          <FieldLabel htmlFor={`${id}-label`}>Label</FieldLabel>
          <Input
            id={`${id}-label`}
            value={label}
            maxLength={START_PAGE_LINK_LABEL_MAX_LENGTH}
            placeholder="Promo Minggu Ini"
            autoFocus
            disabled={isPending}
            onChange={(e) => setLabel(e.target.value)}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor={`${id}-url`}>URL Tujuan</FieldLabel>
          <Input
            id={`${id}-url`}
            type="url"
            inputMode="url"
            value={url}
            placeholder="https://contoh.com/promo"
            disabled={isPending}
            aria-describedby={`${id}-url-desc`}
            onChange={(e) => setUrl(e.target.value)}
          />
          <FieldDescription id={`${id}-url-desc`}>
            Harus diawali http:// atau https://.
          </FieldDescription>
        </Field>

        <Field orientation="horizontal">
          <Checkbox
            id={`${id}-active`}
            checked={isActive}
            disabled={isPending}
            onCheckedChange={(checked) => setIsActive(checked === true)}
          />
          <FieldLabel htmlFor={`${id}-active`} className="font-normal">
            Tampilkan di halaman publik
          </FieldLabel>
        </Field>
      </FieldGroup>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={onClose}
        >
          Batal
        </Button>
        <Button type="submit" disabled={!canSubmit || isPending}>
          {isPending ? <Spinner /> : null}
          {link ? "Simpan" : "Tambah"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/**
 * Dialog tambah/edit link Page Editor (T-072). Form dirender hanya saat
 * dialog terbuka sehingga state-nya selalu segar tiap dibuka. Mengikuti
 * preseden `InviteMemberDialog` (Dialog shadcn + Field).
 */
export function LinkFormDialog({
  target,
  onClose,
  onSaved,
}: {
  target: LinkFormTarget | null;
  onClose: () => void;
  onSaved: (link: StartPageLinkRecord, isNew: boolean) => void;
}) {
  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        {target ? (
          <LinkForm
            key={target.link?.id ?? "new"}
            link={target.link}
            onClose={onClose}
            onSaved={onSaved}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
