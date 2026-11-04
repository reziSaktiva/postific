"use client";

import { useRef, useState } from "react";

import { listPinterestBoardsAction } from "./actions";
import type { PinterestBoardState } from "./form-shared";

/**
 * Daftar board ASLI per akun Pinterest (KI-072, bukan mock) — di-fetch saat
 * akun Pinterest dicentang atau ter-restore, keyed by `connectedAccountId`
 * supaya beberapa akun Pinterest yang dicentang bersamaan tidak saling
 * menimpa status loading/error satu sama lain. Dipisah dari
 * `useDraftEditorForm` (T-202); state pilihan board (`boardIdByAccount`)
 * tetap di hook induk.
 */
export function usePinterestBoards() {
  const [pinterestBoardsByAccount, setPinterestBoardsByAccount] = useState<
    Record<string, PinterestBoardState>
  >({});
  // Respons fetch yang lebih lama tidak boleh menimpa hasil request yang
  // lebih baru (retry sukses, lalu error request sebelumnya datang belakangan).
  const requestSeq = useRef<Record<string, number>>({});

  /** Fetch daftar board Pinterest asli (KI-072) — dipanggil saat akun
   * Pinterest dicentang, dan sebagai retry manual dari tombol "Coba lagi"
   * pada state error. */
  function fetchPinterestBoards(connectedAccountId: string) {
    const seq = (requestSeq.current[connectedAccountId] ?? 0) + 1;
    requestSeq.current[connectedAccountId] = seq;
    setPinterestBoardsByAccount((prev) => ({
      ...prev,
      [connectedAccountId]: { status: "loading" },
    }));
    listPinterestBoardsAction(connectedAccountId)
      .then((boards) => {
        if (requestSeq.current[connectedAccountId] !== seq) {
          return;
        }
        setPinterestBoardsByAccount((prev) => ({
          ...prev,
          [connectedAccountId]: { status: "success", boards },
        }));
      })
      .catch((error) => {
        if (requestSeq.current[connectedAccountId] !== seq) {
          return;
        }
        setPinterestBoardsByAccount((prev) => ({
          ...prev,
          [connectedAccountId]: {
            status: "error",
            message:
              error instanceof Error
                ? error.message
                : "Gagal memuat daftar board.",
          },
        }));
      });
  }

  /** `true` bila fetch untuk akun ini pernah dimulai (dipakai effect restore, KI-060). */
  function hasRequestedBoards(connectedAccountId: string): boolean {
    return Boolean(requestSeq.current[connectedAccountId]);
  }

  return { pinterestBoardsByAccount, fetchPinterestBoards, hasRequestedBoards };
}
