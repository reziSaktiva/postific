"use client";

import type { ReactNode } from "react";

import { MemberRole, MemberStatus } from "@postific/shared";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { ConfirmActionDialog } from "@/components/shared/ConfirmActionDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Text } from "@/components/ui/text";

import {
  MEMBER_ROLE_LABEL,
  type MemberListRow,
  type WorkspaceInvitationRecord,
  type WorkspaceMemberWithUser,
} from "@/domains/workspace";
import { useConfirmAction } from "@/lib/hooks/use-confirm-action";
import { getInitials } from "@/lib/utils";

import {
  SETTINGS_BREADCRUMB_GROUP,
  SettingsPageHead,
} from "../../components/SettingsPageHead";
import {
  cancelInvitationAction,
  removeMemberAction,
  updateMemberRoleAction,
} from "../actions";

const STATUS_LABEL: Record<MemberStatus, string> = {
  [MemberStatus.Active]: "Active",
  [MemberStatus.Pending]: "Pending",
  [MemberStatus.Removed]: "Removed",
};

// KI-041 ditutup: token `--warning`/`--warning-foreground` sudah tersedia
// di globals.css (nilai final dikonfirmasi King Rezi via Claude Design).
// "Pending" sekarang pakai `Badge` variant="warning" (`badge.tsx`, code
// review PR #105) — menggantikan className warna warning ad-hoc yang
// sebelumnya dituliskan manual di sini.
const STATUS_BADGE_VARIANT: Record<MemberStatus, "secondary" | "warning"> = {
  [MemberStatus.Active]: "secondary",
  [MemberStatus.Pending]: "warning",
  [MemberStatus.Removed]: "secondary",
};

// Role yang bisa ditetapkan lewat "Change Role" — Owner tidak termasuk,
// karena perpindahan ke Owner hanya lewat alur Transfer Ownership (T-008.3),
// bukan lewat aksi member biasa di sini.
const ASSIGNABLE_ROLES = [MemberRole.Admin, MemberRole.Creator];

/**
 * Row berupa Owner atau baris milik diri sendiri tidak boleh punya aksi:
 * Owner tidak bisa diubah/dihapus, dan user tidak bisa remove/downgrade
 * dirinya sendiri.
 *
 * Konfirmasi (T-007.5, ADR-049 Tier 2): "Change Role" menampilkan pilihan
 * role via DropdownMenu (bukan langsung apply), lalu membuka AlertDialog
 * konfirmasi sebelum memanggil updateMemberRoleAction — role target belum
 * berubah tampilannya di mana pun sebelum dikonfirmasi, jadi tidak ada
 * state optimistic yang perlu di-revert kalau user Batal. "Remove" membuka
 * AlertDialog konfirmasi sebelum memanggil removeMemberAction.
 */
function MemberActions({
  member,
  currentUserId,
  onRequestRemove,
  onRequestRoleChange,
  // T-098.4 (KI-042) — dipakai di kartu mobile MembersTable: tombol jadi
  // full-width (baris terpisah di bawah, bukan rata-kanan di dalam sel
  // tabel) supaya tap target nyaman, sesuai rancangan Claude Design
  // components/table.html § "Mobile — card layout".
  fullWidth,
}: {
  member: WorkspaceMemberWithUser;
  currentUserId: string;
  onRequestRemove: (member: WorkspaceMemberWithUser) => void;
  onRequestRoleChange: (
    member: WorkspaceMemberWithUser,
    newRole: MemberRole,
  ) => void;
  fullWidth?: boolean;
}) {
  if (member.role === MemberRole.Owner || member.userId === currentUserId) {
    return null;
  }

  const roleOptions = ASSIGNABLE_ROLES.filter((role) => role !== member.role);

  return (
    /* eslint-disable-next-line no-restricted-syntax -- T-099.2: file ini
       sudah dimigrasi ke komposisi Tailwind shadcn (ADR-097), bukan lagi
       HStack Astryx. */
    <div
      className={
        fullWidth
          ? "flex items-center gap-2 border-t border-border pt-3"
          : "flex items-center justify-end gap-2"
      }
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className={fullWidth ? "flex-1" : undefined}
          >
            Change Role
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {roleOptions.map((role) => (
            <DropdownMenuItem
              key={role}
              onClick={() => onRequestRoleChange(member, role)}
            >
              {MEMBER_ROLE_LABEL[role]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        className={fullWidth ? "flex-1" : undefined}
        onClick={() => onRequestRemove(member)}
      >
        Remove
      </Button>
    </div>
  );
}

/**
 * Aksi untuk baris virtual Pending (T-007.8, ADR-101 poin 5) — HANYA
 * "Cancel Invitation", TIDAK ada "Change Role" (belum ada member sungguhan
 * untuk diubah rolenya, beda sengaja dari mockup lama Claude Design yang
 * belum sinkron, KI-047). `fullWidth` mengikuti pola `MemberActions` di
 * atas (kartu mobile).
 */
function InvitationActions({
  invitation,
  onRequestCancel,
  fullWidth,
}: {
  invitation: WorkspaceInvitationRecord;
  onRequestCancel: (invitation: WorkspaceInvitationRecord) => void;
  fullWidth?: boolean;
}) {
  return (
    /* eslint-disable-next-line no-restricted-syntax -- T-099.2: file ini
       sudah dimigrasi ke komposisi Tailwind shadcn (ADR-097), bukan lagi
       HStack Astryx. */
    <div
      className={
        fullWidth
          ? "flex items-center gap-2 border-t border-border pt-3"
          : "flex items-center justify-end gap-2"
      }
    >
      <Button
        type="button"
        variant="destructive"
        size="sm"
        className={fullWidth ? "flex-1" : undefined}
        onClick={() => onRequestCancel(invitation)}
      >
        Cancel Invitation
      </Button>
    </div>
  );
}

// `ConfirmActionDialog` dipindah ke `@/components/shared/ConfirmActionDialog`
// (code review PR #113) — sebelumnya di-re-inline di sini, sekarang dipakai
// bersama dengan `ConnectedAccountsList.tsx`.

/**
 * `MembersTable` (T-099.2, migrasi shadcn/ui). shadcn `Table` — beda dari
 * `@astryxdesign/core/Table` — cuma primitive semantik `<table>` tanpa
 * sistem kolom data-driven (tidak ada `TableColumn[]`/helper
 * `pixel()`/`proportional()` untuk lebar kolom). Baris ditulis langsung
 * sebagai JSX (`TableRow`/`TableCell` per member, bukan `buildColumns` +
 * `data`), dan lebar kolom "Actions" cukup dikunci via Tailwind `w-60`
 * (240px, sama seperti `pixel(240)` sebelumnya) di `<TableHead>`-nya —
 * kolom lain dibiarkan auto-size berdasar konten (bukan proporsi 2:1:1
 * eksplisit), pola yang sama dipakai demo resmi shadcn (`table-demo`,
 * MCP `get_item_examples_from_registries`).
 */
export function MembersTable({
  rows,
  currentUserId,
  headerAction,
}: {
  rows: MemberListRow[];
  currentUserId: string;
  headerAction?: ReactNode;
}) {
  const removeConfirm = useConfirmAction<WorkspaceMemberWithUser>((member) =>
    removeMemberAction(member.id),
  );

  const roleConfirm = useConfirmAction<{
    member: WorkspaceMemberWithUser;
    newRole: MemberRole;
  }>((change) => updateMemberRoleAction(change.member.id, change.newRole));

  const cancelInvitationConfirm = useConfirmAction<WorkspaceInvitationRecord>(
    (invitation) => cancelInvitationAction(invitation.id),
  );

  return (
    // eslint-disable-next-line no-restricted-syntax -- T-099.2, sama seperti di atas
    <div className="flex flex-col gap-4 p-4">
      <SettingsPageHead
        pageName="Members"
        breadcrumb={`${SETTINGS_BREADCRUMB_GROUP.organization} / Members`}
        action={headerAction}
      />

      {removeConfirm.error ? (
        <Alert variant="destructive">
          <AlertTitle>{removeConfirm.error}</AlertTitle>
        </Alert>
      ) : null}
      {roleConfirm.error ? (
        <Alert variant="destructive">
          <AlertTitle>{roleConfirm.error}</AlertTitle>
        </Alert>
      ) : null}
      {cancelInvitationConfirm.error ? (
        <Alert variant="destructive">
          <AlertTitle>{cancelInvitationConfirm.error}</AlertTitle>
        </Alert>
      ) : null}

      {rows.length === 0 ? (
        // eslint-disable-next-line no-restricted-syntax -- KI-055 (Members mengikuti pola final poin 1/3/5, tanpa Card)
        <div className="rounded-xl border border-border p-6">
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Belum ada anggota</EmptyTitle>
              <EmptyDescription>
                Workspace ini belum memiliki anggota.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      ) : (
        <>
          {/* T-098.4 (KI-042): kolom Actions (~800px) butuh scroll
              horizontal untuk dijangkau (temuan QA Najwa T-099, severity
              Moderate) — tabel desktop disembunyikan di bawah `md` (768px,
              sama seperti Mobile Shell), diganti kartu per anggota di
              bawah. Rancangan: Claude Design components/table.html
              § "Mobile — card layout". KI-055 (2026-09-10): `Card` dihapus
              — pola final poin 1/3/5 (border+rounded manual, `py-2` supaya
              hover baris pertama/terakhir tidak menembus sudut membulat).
              Kartu mobile di bawah TIDAK dibungkus wrapper border lagi di
              sini — tiap kartu per-anggota sudah punya border/rounded
              sendiri (`rounded-xl border border-border p-3`), jadi wrapper
              tambahan hanya akan jadi border ganda yang redundan. */}
          {/* eslint-disable-next-line no-restricted-syntax -- T-098.4, sama seperti di atas */}
          <div className="hidden rounded-xl border border-border py-2 md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-60 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) =>
                  row.kind === "member" ? (
                    <TableRow key={row.member.id}>
                      <TableCell>
                        {/* eslint-disable-next-line no-restricted-syntax -- T-099.2, sama seperti di atas */}
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback>
                              {getInitials(row.member.name)}
                            </AvatarFallback>
                          </Avatar>
                          {/* eslint-disable-next-line no-restricted-syntax -- T-099.2, sama seperti di atas */}
                          <div className="flex flex-col">
                            <Text variant="small">{row.member.name}</Text>
                            <Text variant="muted">{row.member.email}</Text>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {MEMBER_ROLE_LABEL[row.member.role]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={STATUS_BADGE_VARIANT[row.member.status]}
                        >
                          {STATUS_LABEL[row.member.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <MemberActions
                          member={row.member}
                          currentUserId={currentUserId}
                          onRequestRemove={(target) =>
                            removeConfirm.open(target)
                          }
                          onRequestRoleChange={(target, newRole) =>
                            roleConfirm.open({ member: target, newRole })
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    <TableRow key={row.invitation.id}>
                      <TableCell>
                        {/* eslint-disable-next-line no-restricted-syntax -- T-099.2, sama seperti di atas */}
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback>
                              {getInitials(row.invitation.email)}
                            </AvatarFallback>
                          </Avatar>
                          <Text variant="small">{row.invitation.email}</Text>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {MEMBER_ROLE_LABEL[row.invitation.role]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="warning">Pending</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <InvitationActions
                          invitation={row.invitation}
                          onRequestCancel={(target) =>
                            cancelInvitationConfirm.open(target)
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ),
                )}
              </TableBody>
            </Table>
          </div>

          {/* eslint-disable-next-line no-restricted-syntax -- T-098.4, sama seperti di atas */}
          <div className="flex flex-col gap-3 md:hidden">
            {rows.map((row) =>
              row.kind === "member" ? (
                // eslint-disable-next-line no-restricted-syntax -- T-098.4, sama seperti di atas
                <div
                  key={row.member.id}
                  className="flex flex-col gap-3 rounded-xl border border-border p-3"
                >
                  {/* eslint-disable-next-line no-restricted-syntax -- T-098.4, sama seperti di atas */}
                  <div className="flex items-center justify-between gap-2">
                    {/* eslint-disable-next-line no-restricted-syntax -- T-098.4, sama seperti di atas */}
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar>
                        <AvatarFallback>
                          {getInitials(row.member.name)}
                        </AvatarFallback>
                      </Avatar>
                      {/* eslint-disable-next-line no-restricted-syntax -- T-098.4, sama seperti di atas */}
                      <div className="flex min-w-0 flex-col">
                        <Text variant="small" className="truncate">
                          {row.member.name}
                        </Text>
                        <Text variant="muted" className="truncate">
                          {row.member.email}
                        </Text>
                      </div>
                    </div>
                    <Badge
                      variant={STATUS_BADGE_VARIANT[row.member.status]}
                      className="shrink-0"
                    >
                      {STATUS_LABEL[row.member.status]}
                    </Badge>
                  </div>
                  {/* eslint-disable-next-line no-restricted-syntax -- T-098.4, sama seperti di atas */}
                  <div className="flex items-center justify-between text-sm">
                    <Text variant="muted">Role</Text>
                    <Badge variant="secondary">
                      {MEMBER_ROLE_LABEL[row.member.role]}
                    </Badge>
                  </div>
                  <MemberActions
                    member={row.member}
                    currentUserId={currentUserId}
                    onRequestRemove={(target) => removeConfirm.open(target)}
                    onRequestRoleChange={(target, newRole) =>
                      roleConfirm.open({ member: target, newRole })
                    }
                    fullWidth
                  />
                </div>
              ) : (
                // eslint-disable-next-line no-restricted-syntax -- T-098.4, sama seperti di atas
                <div
                  key={row.invitation.id}
                  className="flex flex-col gap-3 rounded-xl border border-border p-3"
                >
                  {/* eslint-disable-next-line no-restricted-syntax -- T-098.4, sama seperti di atas */}
                  <div className="flex items-center justify-between gap-2">
                    {/* eslint-disable-next-line no-restricted-syntax -- T-098.4, sama seperti di atas */}
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar>
                        <AvatarFallback>
                          {getInitials(row.invitation.email)}
                        </AvatarFallback>
                      </Avatar>
                      <Text variant="small" className="truncate">
                        {row.invitation.email}
                      </Text>
                    </div>
                    <Badge variant="warning" className="shrink-0">
                      Pending
                    </Badge>
                  </div>
                  {/* eslint-disable-next-line no-restricted-syntax -- T-098.4, sama seperti di atas */}
                  <div className="flex items-center justify-between text-sm">
                    <Text variant="muted">Role</Text>
                    <Badge variant="secondary">
                      {MEMBER_ROLE_LABEL[row.invitation.role]}
                    </Badge>
                  </div>
                  <InvitationActions
                    invitation={row.invitation}
                    onRequestCancel={(target) =>
                      cancelInvitationConfirm.open(target)
                    }
                    fullWidth
                  />
                </div>
              ),
            )}
          </div>
        </>
      )}

      <ConfirmActionDialog
        isOpen={removeConfirm.isOpen}
        onClose={removeConfirm.close}
        title="Keluarkan anggota ini?"
        description={
          removeConfirm.target
            ? `Keluarkan ${removeConfirm.target.name} dari workspace ini? Mereka akan kehilangan akses (ADR-049, Tier 2).`
            : ""
        }
        confirmLabel="Keluarkan"
        isLoading={removeConfirm.isLoading}
        onConfirm={() => void removeConfirm.confirm()}
        variant="destructive"
      />

      <ConfirmActionDialog
        isOpen={roleConfirm.isOpen}
        onClose={roleConfirm.close}
        title="Ubah role anggota ini?"
        description={
          roleConfirm.target
            ? `Ubah role ${roleConfirm.target.member.name} dari ${MEMBER_ROLE_LABEL[roleConfirm.target.member.role]} ke ${MEMBER_ROLE_LABEL[roleConfirm.target.newRole]}?`
            : ""
        }
        confirmLabel="Ubah Role"
        isLoading={roleConfirm.isLoading}
        onConfirm={() => void roleConfirm.confirm()}
      />

      <ConfirmActionDialog
        isOpen={cancelInvitationConfirm.isOpen}
        onClose={cancelInvitationConfirm.close}
        title="Batalkan undangan ini?"
        description={
          cancelInvitationConfirm.target
            ? `Batalkan undangan untuk ${cancelInvitationConfirm.target.email}? Link undangan yang sudah dibagikan tidak akan bisa dipakai lagi.`
            : ""
        }
        confirmLabel="Batalkan Undangan"
        isLoading={cancelInvitationConfirm.isLoading}
        onConfirm={() => void cancelInvitationConfirm.confirm()}
        variant="destructive"
      />
    </div>
  );
}
