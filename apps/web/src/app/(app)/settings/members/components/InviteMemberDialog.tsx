"use client";

import { useState } from "react";

import { EMAIL_PATTERN, MemberRole } from "@postific/shared";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

import { inviteMemberAction } from "../actions";

// EMAIL_PATTERN (dari @postific/shared) dipakai di sini hanya untuk gating
// tombol submit (disabled-until-valid, pola sama seperti
// WorkspaceGeneralSettings). Validasi otoritatif tetap di
// WorkspaceService.inviteMember (backend) — sumber pattern sama supaya
// tidak drift (temuan CodeRabbit PR #73).

// Role yang bisa dipilih saat invite — Owner tidak ditawarkan, konsisten
// dengan WorkspaceService.inviteMember yang menolak role Owner (ADR-080).
const ROLE_OPTIONS = [
  { value: MemberRole.Admin, label: "Admin" },
  { value: MemberRole.Creator, label: "Creator" },
];

type InviteMethod = "copy-link" | "email";

interface Props {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Dialog "Undang Anggota Baru" (T-007.6, ADR-080, migrasi shadcn/ui
 * T-099.2). Dua metode: Copy Link (aktif, default) dan Kirim via Email
 * (disabled, badge "Segera", menunggu T-005). Pola pilihan kartu
 * (label+description+radio dot per baris, satu baris bisa diklik penuh)
 * ikut contoh resmi shadcn `field-choice-card` (MCP
 * `get_item_examples_from_registries`) — `FieldLabel` membungkus `Field
 * orientation="horizontal"` supaya seluruh baris jadi target klik, bukan
 * cuma radio dot-nya.
 */
export function InviteMemberDialog({ isOpen, onOpenChange }: Props) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>(MemberRole.Admin);
  const [method, setMethod] = useState<InviteMethod>("copy-link");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [invitedEmail, setInvitedEmail] = useState<string | null>(null);
  const [copyLabel, setCopyLabel] = useState("Salin");

  const isEmailValid = EMAIL_PATTERN.test(email.trim());

  function resetState() {
    setEmail("");
    setRole(MemberRole.Admin);
    setMethod("copy-link");
    setError(null);
    setInviteLink(null);
    setInvitedEmail(null);
    setCopyLabel("Salin");
  }

  async function handleSubmit() {
    if (!isEmailValid) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await inviteMemberAction(email.trim(), role as MemberRole);
      if (result.error) {
        setError(result.error);
        return;
      }
      setInviteLink(result.inviteLink ?? null);
      setInvitedEmail(email.trim());
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCopyLink() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopyLabel("Disalin!");
      setTimeout(() => setCopyLabel("Salin"), 2000);
    } catch {
      setCopyLabel("Gagal, salin manual");
      setTimeout(() => setCopyLabel("Salin"), 2000);
    }
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        onOpenChange(open);
        if (!open) resetState();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Undang Anggota Baru</DialogTitle>
        </DialogHeader>

        <FieldGroup>
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>{error}</AlertTitle>
            </Alert>
          ) : null}

          <Field>
            <FieldLabel htmlFor="invite-email">Email Calon Anggota</FieldLabel>
            <Input
              id="invite-email"
              type="email"
              required
              disabled={inviteLink !== null}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@perusahaan.com"
            />
            <FieldDescription>
              Link/undangan hanya bisa dipakai oleh email ini.
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="invite-role">Role</FieldLabel>
            <Select
              value={role}
              onValueChange={setRole}
              disabled={inviteLink !== null}
            >
              <SelectTrigger id="invite-role" className="w-full">
                <SelectValue placeholder="Pilih role" />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <FieldSet>
            <FieldLabel>Metode Undangan</FieldLabel>
            <RadioGroup
              value={method}
              onValueChange={(value) => setMethod(value as InviteMethod)}
              disabled={inviteLink !== null}
            >
              <FieldLabel htmlFor="invite-method-copy-link">
                <Field orientation="horizontal">
                  <FieldContent>
                    <FieldTitle>Copy Link</FieldTitle>
                    <FieldDescription>
                      Buat link undangan, lalu bagikan sendiri ke calon anggota
                      (WhatsApp, Slack, dll)
                    </FieldDescription>
                  </FieldContent>
                  <RadioGroupItem
                    value="copy-link"
                    id="invite-method-copy-link"
                  />
                </Field>
              </FieldLabel>
              <FieldLabel htmlFor="invite-method-email">
                <Field orientation="horizontal">
                  <FieldContent>
                    {/* eslint-disable-next-line no-restricted-syntax -- T-099.2: file ini
                        sudah dimigrasi ke komposisi Tailwind shadcn (ADR-097), bukan lagi
                        HStack Astryx. */}
                    <div className="flex items-center gap-2">
                      <FieldTitle className="text-muted-foreground">
                        Kirim via Email
                      </FieldTitle>
                      <Badge variant="outline">Segera</Badge>
                    </div>
                    <FieldDescription>
                      Undangan terkirim otomatis ke email calon anggota.
                      Menunggu provider email disiapkan (T-005).
                    </FieldDescription>
                  </FieldContent>
                  <RadioGroupItem
                    value="email"
                    id="invite-method-email"
                    disabled
                  />
                </Field>
              </FieldLabel>
            </RadioGroup>
          </FieldSet>

          {inviteLink ? (
            <Field>
              <FieldLabel htmlFor="invite-link">Link Undangan</FieldLabel>
              <InputGroup>
                <InputGroupInput id="invite-link" readOnly value={inviteLink} />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    type="button"
                    variant="secondary"
                    onClick={handleCopyLink}
                  >
                    {copyLabel}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
              <FieldDescription>
                Link untuk {invitedEmail} dibuat.
              </FieldDescription>
            </Field>
          ) : null}
        </FieldGroup>

        <DialogFooter>
          {inviteLink ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
            >
              Tutup
            </Button>
          ) : (
            <Button
              type="button"
              disabled={!isEmailValid || !role || isSubmitting}
              onClick={handleSubmit}
            >
              {isSubmitting ? <Spinner /> : null}
              Buat Link Undangan
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
