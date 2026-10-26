"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { DragEvent, KeyboardEvent } from "react";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Delete02Icon,
  DragDropVerticalIcon,
  PencilEdit01Icon,
  PlusSignIcon,
} from "@hugeicons/core-free-icons";

import { ConfirmActionDialog } from "@/components/shared/ConfirmActionDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  START_PAGE_MAX_LINKS,
  type StartPageLinkRecord,
} from "@/domains/start-page";
import { useConfirmAction } from "@/lib/hooks/use-confirm-action";
import { cn } from "@/lib/utils";

import {
  deleteStartPageLinkAction,
  reorderStartPageLinksAction,
} from "../actions";
import { CountText } from "./CountText";
import { LinkFormDialog, type LinkFormTarget } from "./LinkFormDialog";

function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0) return items;
  if (from >= items.length || to >= items.length) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

function LinkRow({
  link,
  index,
  total,
  isDragging,
  disabled,
  handleRef,
  onDragStart,
  onDrop,
  onDragEnd,
  onMove,
  onEdit,
  onDelete,
}: {
  link: StartPageLinkRecord;
  index: number;
  total: number;
  isDragging: boolean;
  disabled: boolean;
  handleRef: (element: HTMLButtonElement | null) => void;
  onDragStart: (e: DragEvent<HTMLLIElement>) => void;
  onDrop: (e: DragEvent<HTMLLIElement>) => void;
  onDragEnd: () => void;
  onMove: (delta: -1 | 1) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  function handleHandleKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      onMove(-1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      onMove(1);
    }
  }

  return (
    <li
      draggable={!disabled}
      onDragStart={onDragStart}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      data-testid="sp-link-row"
      className={cn(
        "flex flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-border p-3 last:border-b-0",
        isDragging && "opacity-50",
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        ref={handleRef}
        aria-label={`Urutkan link ${link.label}, posisi ${index + 1} dari ${total}. Seret, atau tekan panah atas/bawah untuk memindahkan.`}
        className="cursor-grab text-muted-foreground"
        onKeyDown={handleHandleKeyDown}
      >
        <HugeiconsIcon icon={DragDropVerticalIcon} strokeWidth={2} />
      </Button>

      <span className="flex min-w-0 flex-1 basis-36 flex-col gap-0.5">
        <span className="truncate text-sm font-medium text-foreground">
          {link.label}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {link.url}
        </span>
      </span>

      <CountText
        value={link.clickCount}
        unit="klik"
        showUnit
        className="shrink-0 text-xs text-muted-foreground"
      />

      {link.isActive ? (
        <Badge variant="success">Aktif</Badge>
      ) : (
        <span className="text-xs text-muted-foreground">Nonaktif</span>
      )}

      <span className="flex shrink-0 items-center gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Edit link ${link.label}`}
          onClick={onEdit}
        >
          <HugeiconsIcon icon={PencilEdit01Icon} strokeWidth={2} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Hapus link ${link.label}`}
          className="text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
        </Button>
      </span>
    </li>
  );
}

/**
 * Card "Link List" Page Editor — LOCKED PATTERN T-072 (King Rezi
 * 2026-10-16, dipertahankan T-073/T-074): baris komposisi TANPA header
 * kolom dan TANPA Card pembungkus untuk daftarnya (wrapper `rounded-xl
 * border`): drag handle + label/url + meta (klik, T-074) + status + aksi
 * edit/hapus. Bukan `Item`/`ItemGroup`, bukan card-per-item.
 *
 * Urutan: drag-and-drop HTML5 native (pola sama `ChannelsSection`, tanpa
 * pustaka DnD di repo) + handle yang bisa difokus dengan panah atas/bawah
 * (a11y keyboard). Optimistic, mengirim SEMUA id tautan, revert + toast
 * bila gagal.
 */
export function LinkListCard({
  links,
  showZeroHint,
  onLinksChange,
}: {
  links: StartPageLinkRecord[];
  showZeroHint: boolean;
  onLinksChange: (links: StartPageLinkRecord[]) => void;
}) {
  const [formTarget, setFormTarget] = useState<LinkFormTarget | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [isReordering, startReorder] = useTransition();
  // Fokus handle dipertahankan setelah dipindah lewat keyboard (elemen
  // dipindah di DOM saat urutan berubah, fokus browser bisa hilang).
  const handleRefs = useRef(new Map<string, HTMLButtonElement>());
  const focusAfterMove = useRef<string | null>(null);

  useEffect(() => {
    const id = focusAfterMove.current;
    if (id === null) return;
    focusAfterMove.current = null;
    handleRefs.current.get(id)?.focus();
  }, [links]);

  const remove = useConfirmAction<StartPageLinkRecord>(
    (link) => deleteStartPageLinkAction(link.id),
    (link) => {
      onLinksChange(links.filter((l) => l.id !== link.id));
      toast.success("Link dihapus.");
    },
  );

  const atLimit = links.length >= START_PAGE_MAX_LINKS;

  function commitOrder(
    next: StartPageLinkRecord[],
    moved: StartPageLinkRecord,
  ) {
    if (next === links || isReordering) return;
    const previous = links;
    onLinksChange(next);
    const position = next.findIndex((l) => l.id === moved.id) + 1;
    setAnnouncement(
      `${moved.label} dipindah ke posisi ${position} dari ${next.length}.`,
    );
    startReorder(async () => {
      const result = await reorderStartPageLinksAction(next.map((l) => l.id));
      if (result.error !== undefined) {
        onLinksChange(previous);
        toast.error(result.error);
      }
    });
  }

  function handleMove(index: number, delta: -1 | 1) {
    focusAfterMove.current = links[index].id;
    commitOrder(moveItem(links, index, index + delta), links[index]);
  }

  function handleDragStart(id: string) {
    return (e: DragEvent<HTMLLIElement>) => {
      setDraggedId(id);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", id);
    };
  }

  function handleDrop(targetId: string) {
    return (e: DragEvent<HTMLLIElement>) => {
      e.preventDefault();
      // Sumber dibaca dari dataTransfer (bukan state) — kebal race render,
      // pola sama `ChannelsSection.handleDrop`.
      const sourceId = e.dataTransfer.getData("text/plain");
      setDraggedId(null);
      if (!sourceId || sourceId === targetId) return;
      const from = links.findIndex((l) => l.id === sourceId);
      const to = links.findIndex((l) => l.id === targetId);
      if (from === -1 || to === -1) return;
      commitOrder(moveItem(links, from, to), links[from]);
    };
  }

  function handleSaved(link: StartPageLinkRecord, isNew: boolean) {
    onLinksChange(
      isNew
        ? [...links, link]
        : links.map((l) => (l.id === link.id ? link : l)),
    );
    setFormTarget(null);
    toast.success(isNew ? "Link ditambahkan." : "Link diperbarui.");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Link List</CardTitle>
        <CardAction>
          <Button
            type="button"
            size="sm"
            disabled={atLimit}
            onClick={() => setFormTarget({ link: null })}
          >
            <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} />
            Tambah Link
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-2.5">
        <ul className="rounded-xl border border-border py-1">
          {links.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">
              Belum ada link. Klik Tambah Link untuk membuat yang pertama.
            </li>
          ) : (
            links.map((link, index) => (
              <LinkRow
                key={link.id}
                link={link}
                index={index}
                total={links.length}
                isDragging={draggedId === link.id}
                disabled={isReordering}
                handleRef={(element) => {
                  if (element) handleRefs.current.set(link.id, element);
                  else handleRefs.current.delete(link.id);
                }}
                onDragStart={handleDragStart(link.id)}
                onDrop={handleDrop(link.id)}
                onDragEnd={() => setDraggedId(null)}
                onMove={(delta) => handleMove(index, delta)}
                onEdit={() => setFormTarget({ link })}
                onDelete={() => remove.open(link)}
              />
            ))
          )}
        </ul>
        <p className="text-sm text-muted-foreground">
          Seret handle untuk mengurutkan, atau fokus ke handle lalu tekan panah
          atas/bawah.
          {atLimit ? ` Batas ${START_PAGE_MAX_LINKS} link tercapai.` : ""}
        </p>
        {showZeroHint ? (
          <p className="text-sm text-muted-foreground">
            Klik dihitung setelah halaman dipublish dan dikunjungi.
          </p>
        ) : null}
        <span className="sr-only" role="status" aria-live="polite">
          {announcement}
        </span>
      </CardContent>

      <LinkFormDialog
        target={formTarget}
        onClose={() => setFormTarget(null)}
        onSaved={handleSaved}
      />
      <ConfirmActionDialog
        isOpen={remove.isOpen}
        onClose={remove.close}
        title="Hapus link?"
        description={
          remove.target
            ? `Link "${remove.target.label}" akan dihapus dari halaman publik beserta hitungan kliknya. Tindakan ini tidak dapat dibatalkan.`
            : ""
        }
        confirmLabel="Hapus"
        isLoading={remove.isLoading}
        error={remove.error}
        onConfirm={remove.confirm}
        variant="destructive"
      />
    </Card>
  );
}
