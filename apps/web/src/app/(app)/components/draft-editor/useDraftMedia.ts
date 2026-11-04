"use client";

import { useState } from "react";

import { toast } from "sonner";

import type { ContentFormat } from "@postific/shared";
import { maxMediaCountForFormats } from "@/domains/publishing";
import { useConfirmAction } from "@/lib/hooks/use-confirm-action";

import type { DraftMediaDto } from "./actions";
import { deleteMediaAction, uploadMediaAction } from "./actions";

/**
 * Media satu post (T-024.4) — dipisah dari `useDraftEditorForm` (T-202).
 * Setiap file diupload segera saat dipilih/didrop (`uploadMediaAction`, bukan
 * disimpan sebagai `File` mentah di state), supaya preview + validasi
 * mime/ukuran terjadi langsung, bukan ditunda sampai Save/Schedule.
 * `mediaItems` adalah SATU set untuk seluruh post (bukan per-akun, ADR-107);
 * "hapus" menghapus PERMANEN (file Storage + record `MediaItem`, lewat dialog
 * konfirmasi Tier 2/ADR-049).
 *
 * `activeFormats` = format semua akun terpilih, dipakai menghitung batas
 * media efektif (ADR-107).
 */
export function useDraftMedia(activeFormats: ContentFormat[]) {
  const [mediaItems, setMediaItems] = useState<DraftMediaDto[]>([]);
  const [uploadingMediaCount, setUploadingMediaCount] = useState(0);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const effectiveMaxMedia = maxMediaCountForFormats(activeFormats);
  const isMediaLimitReached =
    mediaItems.length + uploadingMediaCount >= effectiveMaxMedia;
  /**
   * KI-061 (ADR-107): kalau user upload media dulu lalu menambah akun
   * target dengan format lebih ketat, `effectiveMaxMedia` bisa turun di
   * bawah `mediaItems.length` yang sudah ada. Server menolak berdasarkan
   * TOTAL count, bukan per-item. Item index >= `effectiveMaxMedia` adalah
   * ekor array (media paling baru) yang perlu dihapus dulu.
   */
  const overLimitMediaCount = Math.max(
    0,
    mediaItems.length - effectiveMaxMedia,
  );

  async function handleFilesSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) {
      return;
    }
    const files = Array.from(fileList);
    const max = maxMediaCountForFormats(activeFormats);
    const availableSlots = Math.max(
      0,
      max - mediaItems.length - uploadingMediaCount,
    );

    if (availableSlots === 0) {
      setMediaError(
        `Batas maksimum ${max} media untuk format yang sedang dipilih sudah tercapai.`,
      );
      return;
    }

    const toUpload = files.slice(0, availableSlots);
    if (files.length > toUpload.length) {
      setMediaError(
        `Hanya ${toUpload.length} dari ${files.length} file diunggah — batas maksimum media untuk format ini adalah ${max}.`,
      );
    } else {
      setMediaError(null);
    }

    setUploadingMediaCount((count) => count + toUpload.length);
    await Promise.all(
      toUpload.map(async (file) => {
        try {
          const formData = new FormData();
          formData.append("file", file);
          const result = await uploadMediaAction(formData);
          if ("error" in result) {
            setMediaError(result.error);
          } else {
            setMediaItems((prev) => [...prev, result.media]);
          }
        } catch {
          setMediaError("Gagal mengunggah salah satu file. Coba lagi.");
        } finally {
          setUploadingMediaCount((count) => count - 1);
        }
      }),
    );
  }

  // T-024.5 (ADR-049 Tier 2): hapus media = hapus PERMANEN, pola sama
  // `deleteConfirm` di `DraftsList.tsx`. `ConfirmActionDialog` adalah
  // `AlertDialog` modal, jadi tombol hapus item lain otomatis tidak bisa
  // diklik selama satu proses berjalan.
  const deleteMediaConfirm = useConfirmAction<DraftMediaDto>(
    (item) => deleteMediaAction(item.id),
    (item) => {
      setMediaItems((prev) => prev.filter((m) => m.id !== item.id));
      toast("Media berhasil dihapus");
    },
  );

  return {
    mediaItems,
    setMediaItems,
    uploadingMediaCount,
    mediaError,
    effectiveMaxMedia,
    isMediaLimitReached,
    overLimitMediaCount,
    handleFilesSelected,
    deleteMediaConfirm,
  };
}
