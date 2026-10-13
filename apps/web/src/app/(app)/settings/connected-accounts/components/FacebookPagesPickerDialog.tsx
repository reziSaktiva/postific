"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { SocialPlatform, type FacebookPendingPage } from "@postific/shared";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { getInitials } from "@/lib/utils";

import {
  confirmFacebookPagesConnectionAction,
  initiateConnectAccountAction,
  listFacebookPendingPagesAction,
} from "../actions";

/**
 * Dialog Facebook Pages Picker (T-025.4, KI-070, ADR-115 §10/ADR-116) —
 * dibuka `ConnectedAccountsList` begitu Route Handler callback redirect
 * balik dengan `?connectFacebook=1&connectFacebookState=` (session token
 * di cookie httpOnly, dibaca Server Action — bukan props). 4 state
 * mengikuti struktur `templates/settings-connect-facebook-pages.html`
 * (Claude Design, CONFIRMED King Rezi): Loading (skeleton) →
 * Default/Selected (checkbox list) atau Empty (0 Page) → submit.
 *
 * CATATAN (flag ke Mark UI Engineer delegator, bukan asumsi diam-diam):
 * `DesignSync` tidak berhasil dimuat di sesi subagent ini (pola gagal
 * yang sama sudah tercatat berulang kali di
 * `.claude/agents/README.md` § "Keterbatasan teknis DesignSync di sesi
 * subagent", termasuk untuk task KI-070 UI ini sendiri) — struktur di
 * sini disusun dari deskripsi eksplisit ADR-115 §10/ADR-116 (nama class
 * `.dialog-md`/`.fbpage-*`, 4 state) yang DITULIS dari desain confirmed,
 * bukan dari HTML mentah langsung. Satu keputusan struktural yang TIDAK
 * eksplisit dikunci di ADR — apakah baris Page klik-penuh (bukan cuma
 * checkbox-nya) memicu toggle — sengaja dipilih "klik-penuh" di sini
 * (area klik checkbox diperluas ke seluruh `<label>` baris, pola yang
 * sama seperti `WorkspacePickableRow.tsx` di codebase ini) sebagai
 * default yang aman/umum untuk picker checkbox, BUKAN pola shadcn lain
 * yang bersaing — tapi ini persis kategori "row klik-penuh atau tidak"
 * yang disebut eksplisit di AGENTS.md rule 17 sebagai kandidat ambigu.
 * Read-only sanity: dampaknya murni UX (area klik lebih luas), checkbox
 * itu sendiri tetap fungsional independen. Wajib diverifikasi Najwa QA
 * Engineer (akses `DesignSync` untuk gate T-103.3) terhadap template asli
 * sebelum task ini ditandai selesai penuh.
 */
export function FacebookPagesPickerDialog({
  open,
  state,
  onOpenChange,
}: {
  open: boolean;
  state: string;
  onOpenChange: (open: boolean) => void;
}) {
  const [pages, setPages] = useState<FacebookPendingPage[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [isConfirming, startConfirmTransition] = useTransition();
  const [isRestarting, startRestartTransition] = useTransition();

  // Reset state saat "sesi" dialog berganti (dialog dibuka ulang dengan
  // state berbeda) — diadaptasi SELAMA render (bukan di dalam
  // `useEffect`), pola yang sama dengan penyesuaian
  // `hasCheckedAutoAdvance` di `draft-editor/Modal.tsx`, supaya tidak
  // memicu render effect tambahan (`react-hooks/set-state-in-effect`)
  // untuk reset state turunan sederhana seperti ini.
  const sessionKey = open ? state : null;
  const [trackedSessionKey, setTrackedSessionKey] = useState(sessionKey);
  if (sessionKey !== trackedSessionKey) {
    setTrackedSessionKey(sessionKey);
    setPages(null);
    setListError(null);
    setSelectedIds(new Set());
    setConfirmError(null);
  }

  // Fetch daftar Page pending setiap dialog dibuka (state Loading →
  // Default/Empty/Error). Session token dibaca Server Action dari cookie
  // httpOnly (bound ke `state.nonce`) — client tidak pernah melihatnya.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    void (async () => {
      const result = await listFacebookPendingPagesAction(state);
      if (cancelled) return;
      if (result.error) {
        setListError(result.error);
        return;
      }
      setPages(result.pages ?? []);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, state]);

  function toggleSelection(pageId: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(pageId);
      } else {
        next.delete(pageId);
      }
      return next;
    });
  }

  function handleConfirm() {
    if (selectedIds.size === 0) return;
    setConfirmError(null);
    startConfirmTransition(async () => {
      const result = await confirmFacebookPagesConnectionAction(
        state,
        Array.from(selectedIds),
      );
      if (result.error) {
        setConfirmError(result.error);
        return;
      }
      toast(`${result.connectedCount ?? 0} Page terhubung`);
      onOpenChange(false);
    });
  }

  function handleRestartConnect() {
    startRestartTransition(async () => {
      const result = await initiateConnectAccountAction(
        SocialPlatform.Facebook,
      );
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      // Bug #2 (T-025.4/KI-070) — lihat docstring
      // `initiateConnectAccountAction` (`../actions.ts`). Facebook SELALU
      // butuh hard navigation dari client, bukan redirect() server.
      if (result?.redirectUrl) {
        window.location.href = result.redirectUrl;
      }
    });
  }

  const isLoading = pages === null && !listError;
  const isEmpty = pages !== null && pages.length === 0 && !listError;
  const selectedCount = selectedIds.size;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // T-025.4 poin 6 (ADR-115 §9): cancel/close TIDAK memanggil action
        // apa pun — nonce cookie tetap hidup di server, expire sendiri
        // lewat TTL yang sudah ada.
        if (!next) onOpenChange(false);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Hubungkan Facebook Page</DialogTitle>
          <DialogDescription>
            Pilih Page yang ingin dihubungkan ke workspace ini.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <ItemGroup className="gap-2">
            {[0, 1, 2].map((index) => (
              <Item key={index} variant="outline">
                <ItemMedia>
                  <Skeleton className="size-4 rounded-sm" />
                </ItemMedia>
                <ItemMedia>
                  <Skeleton className="size-8 rounded-full" />
                </ItemMedia>
                <ItemContent className="gap-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </ItemContent>
              </Item>
            ))}
          </ItemGroup>
        ) : listError ? (
          <Alert variant="destructive">
            <AlertTitle>{listError}</AlertTitle>
          </Alert>
        ) : isEmpty ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Tidak ada Page ditemukan</EmptyTitle>
              <EmptyDescription>
                Tidak ada Facebook Page yang bisa dihubungkan dari login ini.
                Pastikan Anda memiliki akses admin ke minimal satu Page, lalu
                login ulang.
              </EmptyDescription>
            </EmptyHeader>
            <Button
              type="button"
              onClick={handleRestartConnect}
              disabled={isRestarting}
            >
              Login Ulang dengan Facebook
            </Button>
          </Empty>
        ) : (
          <>
            {confirmError ? (
              <Alert variant="destructive">
                <AlertTitle>{confirmError}</AlertTitle>
              </Alert>
            ) : null}
            <ItemGroup className="max-h-80 gap-2 overflow-y-auto">
              {(pages ?? []).map((page) => {
                const checkboxId = `facebook-page-${page.pageId}`;
                const checked = selectedIds.has(page.pageId);
                return (
                  <Item
                    key={page.pageId}
                    asChild
                    variant="outline"
                    className="cursor-pointer"
                  >
                    <label htmlFor={checkboxId}>
                      <ItemMedia>
                        <Checkbox
                          id={checkboxId}
                          checked={checked}
                          onCheckedChange={(value) =>
                            toggleSelection(page.pageId, value === true)
                          }
                        />
                      </ItemMedia>
                      <ItemMedia>
                        <Avatar>
                          {page.pictureUrl ? (
                            <AvatarImage
                              src={page.pictureUrl}
                              alt={page.name}
                            />
                          ) : null}
                          <AvatarFallback>
                            {getInitials(page.name)}
                          </AvatarFallback>
                        </Avatar>
                      </ItemMedia>
                      <ItemContent>
                        <ItemTitle>{page.name}</ItemTitle>
                        {page.category ? (
                          <ItemDescription>{page.category}</ItemDescription>
                        ) : null}
                      </ItemContent>
                    </label>
                  </Item>
                );
              })}
            </ItemGroup>
          </>
        )}

        {!isLoading && !listError && !isEmpty ? (
          <DialogFooter>
            <Button
              type="button"
              disabled={selectedCount === 0 || isConfirming}
              onClick={handleConfirm}
            >
              {selectedCount > 0
                ? `Hubungkan ${selectedCount} Page Terpilih`
                : "Hubungkan Page Terpilih"}
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
