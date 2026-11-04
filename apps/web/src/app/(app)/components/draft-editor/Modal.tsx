"use client";

import { useEffect, useRef, useState } from "react";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import type { UnsavedNewPost } from "./Context";
import { useDraftEditor } from "./Context";
import { DraftEditorForm } from "./DraftEditorForm";
import type { LatestFormSnapshot } from "./form-shared";
import { NARROW_VIEWPORT_QUERY, type DialogVariant } from "./dialog-layout";
import { ResumeDialog } from "./ResumeDialog";

// Di bawah lebar ini modal selalu penuh dan Pratinjau pindah ke tab (T-206.3);
// aturan lengkapnya di `dialog-layout.ts`.
function useIsNarrowViewport() {
  const [isNarrow, setIsNarrow] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia(NARROW_VIEWPORT_QUERY).matches,
  );
  useEffect(() => {
    const query = window.matchMedia(NARROW_VIEWPORT_QUERY);
    const onChange = (event: MediaQueryListEvent) => setIsNarrow(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return isNarrow;
}

export function DraftEditorModal() {
  const {
    state,
    resume,
    discardAndStartNew,
    close,
    persistUnsavedNewPost,
    clearUnsavedNewPost,
  } = useDraftEditor();

  const isEditorOpen = state.mode === "create" || state.mode === "edit";
  const sessionKey =
    state.mode === "edit"
      ? `edit:${state.postId}`
      : state.mode === "create"
        ? "create"
        : "none";

  // Remembers the last resume-check payload, and the currently-mounted
  // form's live caption/savedPostId — both adjusted during render (not in
  // an effect) purely so exit animations / close handling have data to work
  // with after `state` has already moved on.
  const [resumeData, setResumeData] = useState<UnsavedNewPost | null>(null);
  if (state.mode === "resume-check" && state.unsaved !== resumeData) {
    setResumeData(state.unsaved);
  }

  // Fullscreen/Standard toggle (ADR-065): official, user-switchable, never
  // persisted — reset to the default (Standard) every time a new session
  // starts. `DraftEditorForm` itself remounts per session via `key=
  // {sessionKey}`, but this state has to live here because it drives the
  // wrapping `Dialog`'s own `variant`/`width`, so it's reset the same way
  // `resumeData` above is: adjusted during render when `sessionKey` changes,
  // not in an effect.
  const [dialogVariant, setDialogVariant] = useState<DialogVariant>("standard");
  const [prevSessionKey, setPrevSessionKey] = useState(sessionKey);
  if (prevSessionKey !== sessionKey) {
    setPrevSessionKey(sessionKey);
    if (dialogVariant !== "standard") {
      setDialogVariant("standard");
    }
  }
  function toggleDialogVariant() {
    setDialogVariant((current) =>
      current === "standard" ? "fullscreen" : "standard",
    );
  }
  const isNarrow = useIsNarrowViewport();
  const effectiveDialogVariant: DialogVariant = isNarrow
    ? "fullscreen"
    : dialogVariant;

  const latestFormRef = useRef<LatestFormSnapshot>({
    mode: "create",
    caption: "",
    savedPostId: undefined,
  });

  function handleOpenChange(open: boolean) {
    if (open) {
      return;
    }
    const { mode, caption, savedPostId } = latestFormRef.current;
    if (mode === "create") {
      const trimmed = caption.trim();
      if (trimmed && !savedPostId) {
        persistUnsavedNewPost(trimmed);
      } else {
        clearUnsavedNewPost();
      }
    }
    close();
  }

  return (
    <>
      <ResumeDialog
        isOpen={state.mode === "resume-check"}
        unsaved={resumeData}
        onDiscard={discardAndStartNew}
        onResume={resume}
      />

      <Dialog
        open={isEditorOpen}
        onOpenChange={(open) => handleOpenChange(open)}
      >
        <DialogContent
          showCloseButton={false}
          onEscapeKeyDown={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
          className={cn(
            "flex flex-col gap-0 overflow-hidden p-0",
            effectiveDialogVariant === "fullscreen" &&
              // `sm:max-w-none` wajib: DialogContent membawa `sm:max-w-md`
              // yang mengalahkan `max-w-none` tanpa prefiks (temuan QA T-206.1).
              "top-0 left-0 h-dvh max-h-none w-screen max-w-none translate-none rounded-none sm:max-w-none",
          )}
          style={
            effectiveDialogVariant === "fullscreen"
              ? undefined
              : {
                  width: "min(1120px, 94vw)",
                  maxWidth: "min(1120px, 94vw)",
                  height: "min(calc(100dvh - 40px), 820px)",
                }
          }
        >
          {isEditorOpen ? (
            <DraftEditorForm
              key={sessionKey}
              mode={state.mode === "edit" ? "edit" : "create"}
              postId={state.mode === "edit" ? state.postId : undefined}
              prefillCaption={
                state.mode === "create" ? state.prefillCaption : undefined
              }
              preSelectedAccountId={
                state.mode === "create" ? state.preSelectedAccountId : undefined
              }
              initialPendingAction={
                state.mode === "edit" ? state.initialPendingAction : undefined
              }
              onOpenChange={handleOpenChange}
              dialogVariant={dialogVariant}
              isNarrow={isNarrow}
              onToggleDialogVariant={toggleDialogVariant}
              onLatestChange={(snapshot) => {
                latestFormRef.current = snapshot;
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
