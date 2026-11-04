// Logika murni varian tampilan Draft Editor (T-206): Standard 1120px,
// Fullscreen, dan layar sempit. Dipisah dari komponen supaya aturan
// visibilitas toggle bisa diuji tanpa DOM.

export type DialogVariant = "standard" | "fullscreen";

/** Lebar viewport (px) sampai dengan nilai ini dianggap layar sempit. */
export const NARROW_VIEWPORT_MAX_WIDTH = 767;
export const NARROW_VIEWPORT_QUERY = `(max-width: ${NARROW_VIEWPORT_MAX_WIDTH}px)`;

export type EditorTab = "editor" | "preview";

export type DialogLayout = {
  /** Di layar sempit modal selalu penuh, apa pun pilihan toggle. */
  effectiveVariant: DialogVariant;
  showVariantToggle: boolean;
  showPreviewToggle: boolean;
  /** Tab "Editor | Pratinjau" menggantikan kolom Pratinjau di samping. */
  showEditorPreviewTabs: boolean;
  /** Kolom Pratinjau di samping form (hanya layar lebar). */
  showSidePreview: boolean;
};

export function resolveDialogLayout({
  variant,
  isNarrow,
  isPreviewVisible,
  isConfirming,
}: {
  variant: DialogVariant;
  isNarrow: boolean;
  isPreviewVisible: boolean;
  /** Layar konfirmasi Schedule/Publish Now: tanpa toggle dan tab. */
  isConfirming: boolean;
}): DialogLayout {
  return {
    effectiveVariant: isNarrow ? "fullscreen" : variant,
    showVariantToggle: !isNarrow && !isConfirming,
    showPreviewToggle: !isNarrow && !isConfirming,
    showEditorPreviewTabs: isNarrow && !isConfirming,
    showSidePreview: !isNarrow && isPreviewVisible,
  };
}
