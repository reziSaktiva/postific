"use client";

import { useEffect, useRef, useState } from "react";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import type { UnsavedNewPost } from "./Context";
import { useDraftEditor } from "./Context";
import { DraftEditorForm } from "./DraftEditorForm";
import type { LatestFormSnapshot } from "./form-shared";
import { ResumeDialog } from "./ResumeDialog";

// Standard variant's floating card + backdrop margins waste too much of a
// small phone's screen (ADR-065 only decided the desktop default; it never
// addressed small viewports). Below this breakpoint the Dialog always
// renders Fullscreen regardless of the user's toggle choice, restoring the
// edge-to-edge editing surface mobile needs.
const MOBILE_VIEWPORT_QUERY = "(max-width: 640px)";

function useIsMobileViewport() {
  const [isMobile, setIsMobile] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia(MOBILE_VIEWPORT_QUERY).matches,
  );
  useEffect(() => {
    const query = window.matchMedia(MOBILE_VIEWPORT_QUERY);
    const onChange = (event: MediaQueryListEvent) => setIsMobile(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return isMobile;
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
  const [dialogVariant, setDialogVariant] = useState<"standard" | "fullscreen">(
    "standard",
  );
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
  const isMobileViewport = useIsMobileViewport();
  const effectiveDialogVariant = isMobileViewport
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
              "top-0 left-0 h-dvh max-h-none w-screen max-w-none translate-none rounded-none",
          )}
          style={
            effectiveDialogVariant === "fullscreen"
              ? undefined
              : {
                  width: "min(960px, 94vw)",
                  maxWidth: "min(960px, 94vw)",
                  maxHeight: "88vh",
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
