"use client";

import { useCallback, useRef } from "react";

import { Alert, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Spinner } from "@/components/ui/spinner";

import { toast } from "sonner";

import { ContentStatus, type PostId } from "@postific/shared";
import {
  groupQueueItemsByDate,
  type CalendarPostItem,
  type QueueGroup,
  type QueueItemRecord,
} from "@/domains/publishing";
import { useConfirmAction } from "@/lib/hooks/use-confirm-action";
import { usePublishingPostsRealtime } from "@/lib/hooks/use-publishing-posts-realtime";
import { useSyncedState } from "@/lib/hooks/use-synced-state";

import { cancelScheduleAction, getQueuePostAction } from "../actions";
import { QueueList } from "./QueueList";

/**
 * Post hasil `getQueuePostAction` (bentuk `CalendarPostItem`) hanya
 * dianggap cocok tampil di Queue kalau statusnya `Scheduled` DAN
 * `scheduledAt` terisi (T-092.4, ADR-094 poin 5 — kriteria Queue: cuma
 * status Scheduled). `CalendarItemTargetRecord` adalah superset
 * `QueueItemTargetRecord` (field ekstra `platformPostUrl` diabaikan di
 * sini, structural typing) jadi tidak perlu mapping manual per-target.
 */
function toQueueItemRecord(item: CalendarPostItem): QueueItemRecord | null {
  if (item.status !== ContentStatus.Scheduled || !item.scheduledAt) {
    return null;
  }
  return {
    id: item.id,
    caption: item.caption,
    scheduledAt: item.scheduledAt,
    createdAt: item.createdAt,
    targets: item.targets,
  };
}

/**
 * Client wrapper untuk halaman Queue (T-032.4) — memisahkan state dialog
 * Cancel Schedule (T-030, ADR-049 Tier 2) dari `QueueList` supaya
 * `QueueList` tetap murni presentational + filter akun. Pola dialog persis
 * `MembersTable.tsx`, sekarang lewat hook bersama `useConfirmAction`.
 *
 * Copy dialog final dari mockup Claude Design (T-032.0, dikonfirmasi via
 * DesignSync): warning "Post kembali menjadi Draft dan tidak akan
 * dipublikasikan otomatis" + tombol aksi "Batalkan Jadwal" (danger).
 *
 * T-101.2: migrasi Astryx `AlertDialog`/`Banner`/`VStack` ke shadcn
 * `AlertDialog` (pola `AlertDialogAction` + `e.preventDefault()` supaya
 * dialog tetap terbuka sampai `confirm()` selesai, persis
 * `MembersTable.tsx` T-099.2) + `Alert variant="destructive"` untuk pesan
 * error, dibungkus Tailwind `flex flex-col gap-4` (layout-only).
 * T-102.6: `useToast` Astryx diganti `toast()` sonner (shadcn `Toaster`
 * dipasang sekali di `Providers.tsx`) — menuntaskan migrasi toast terakhir
 * di codebase.
 *
 * **T-092.4 (ADR-094 poin 5, 6) — client state + granular Realtime patch:**
 * `groups` (hasil `PublishingService.listQueue` dari `page.tsx`) disalin ke
 * `useState` lokal (pola sama `CalendarScreen`, T-092.3) — disinkronkan
 * ulang SAAT RENDER setiap kali prop `groups` berubah (`page.tsx` re-render
 * server-side lewat `revalidatePath("/publish/queue")`, mis. sesudah Cancel
 * Schedule), bukan `useEffect` + `setState` supaya tidak ada render
 * tambahan/cascading.
 *
 * `usePublishingPostsRealtime(workspaceId, {...})` subscribe selama screen
 * ini mount (lifecycle per-mount, ADR-094 poin 6). Event `INSERT`/`UPDATE`
 * memicu fetch SATU record via `getQueuePostAction` (Server Action → reuse
 * `PublishingService.getCalendarPostById`, bukan refetch seluruh Queue)
 * lalu di-upsert/remove ke state lokal berdasar kriteria tampilan Queue
 * (`toQueueItemRecord` — hanya status `Scheduled`; status lain, termasuk
 * `null` hasil post tidak ditemukan/soft-deleted, berarti item dihapus dari
 * local state) — echo dari aksi milik user sendiri diproses sama seperti
 * event orang lain, tanpa deteksi/skip apa pun (idempoten by design,
 * ADR-094 poin 5). Regroup per-tanggal reuse `groupQueueItemsByDate` (pure
 * function yang sama dipakai `PublishingService.listQueue`), dijalankan
 * di atas daftar `QueueItemRecord` flat supaya urutan group/tanggal selalu
 * konsisten meski patch terjadi lintas-grup (mis. reschedule ke tanggal
 * lain).
 */
export function QueueScreen({
  groups,
  workspaceId,
}: {
  groups: QueueGroup[];
  /** Workspace aktif — dipakai `usePublishingPostsRealtime` (T-092.4) untuk
   * subscribe channel `publishing_posts:{workspaceId}`, bukan dipakai
   * untuk fetch data apa pun langsung di komponen ini (AGENTS.md #5). */
  workspaceId: string;
}) {
  const cancelConfirm = useConfirmAction<PostId>(cancelScheduleAction, () =>
    toast("Jadwal dibatalkan — post kembali ke Drafts"),
  );

  const [localGroups, setLocalGroups] = useSyncedState(groups);
  const requestSeqRef = useRef<Map<string, number>>(new Map());

  const handlePublishingPostChange = useCallback(
    (event: { postId: CalendarPostItem["id"] }) => {
      const seq = (requestSeqRef.current.get(event.postId) ?? 0) + 1;
      requestSeqRef.current.set(event.postId, seq);

      void (async () => {
        const fetched = await getQueuePostAction(event.postId);

        // Buang hasil kalau sudah disusul event lain untuk postId yang sama
        // (out-of-order response) — jangan biarkan fetch yang lebih lama
        // menimpa state yang sudah diperbarui oleh event yang lebih baru.
        if (requestSeqRef.current.get(event.postId) !== seq) {
          return;
        }

        const queueItem = fetched ? toQueueItemRecord(fetched) : null;

        setLocalGroups((prev) => {
          const withoutStale = prev
            .map((group) => ({
              ...group,
              items: group.items.filter((item) => item.id !== event.postId),
            }))
            .filter((group) => group.items.length > 0);

          if (!queueItem) {
            return withoutStale;
          }

          const flatItems = withoutStale.flatMap((group) => group.items);
          return groupQueueItemsByDate(
            [...flatItems, queueItem].sort(
              (a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime(),
            ),
          );
        });
      })();
    },
    [setLocalGroups],
  );

  usePublishingPostsRealtime(workspaceId, {
    onInsert: handlePublishingPostChange,
    onUpdate: handlePublishingPostChange,
  });

  return (
    // eslint-disable-next-line no-restricted-syntax -- T-101.2: layout-only, file sudah dimigrasi shadcn
    <div className="flex flex-col gap-4">
      {cancelConfirm.error ? (
        <Alert variant="destructive">
          <AlertTitle>{cancelConfirm.error}</AlertTitle>
        </Alert>
      ) : null}

      <QueueList
        groups={localGroups}
        onCancelSchedule={(postId) => cancelConfirm.open(postId)}
      />

      <AlertDialog
        open={cancelConfirm.isOpen}
        onOpenChange={(open) => {
          if (!open) cancelConfirm.close();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Batalkan jadwal ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Post kembali menjadi Draft dan tidak akan dipublikasikan otomatis.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelConfirm.isLoading}>
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={cancelConfirm.isLoading}
              onClick={(e) => {
                e.preventDefault();
                void cancelConfirm.confirm();
              }}
            >
              {cancelConfirm.isLoading ? <Spinner /> : null}
              Batalkan Jadwal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
