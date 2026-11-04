import { describe, expect, it } from "vitest";

import { resolveDialogLayout } from "./dialog-layout";

const base = {
  variant: "standard" as const,
  isNarrow: false,
  isPreviewVisible: true,
  isConfirming: false,
};

describe("resolveDialogLayout", () => {
  it("layar lebar: toggle Fullscreen dan Pratinjau tampil, Pratinjau di samping", () => {
    expect(resolveDialogLayout(base)).toEqual({
      effectiveVariant: "standard",
      showVariantToggle: true,
      showPreviewToggle: true,
      showEditorPreviewTabs: false,
      showSidePreview: true,
    });
  });

  it("layar lebar: pilihan Fullscreen diikuti", () => {
    expect(
      resolveDialogLayout({ ...base, variant: "fullscreen" }).effectiveVariant,
    ).toBe("fullscreen");
  });

  it("layar lebar: Pratinjau disembunyikan lewat toggle", () => {
    const layout = resolveDialogLayout({ ...base, isPreviewVisible: false });
    expect(layout.showSidePreview).toBe(false);
    expect(layout.showPreviewToggle).toBe(true);
  });

  it("layar sempit: selalu penuh, toggle disembunyikan, tab Editor|Pratinjau tampil", () => {
    expect(resolveDialogLayout({ ...base, isNarrow: true })).toEqual({
      effectiveVariant: "fullscreen",
      showVariantToggle: false,
      showPreviewToggle: false,
      showEditorPreviewTabs: true,
      showSidePreview: false,
    });
  });

  it("layar sempit: preferensi Pratinjau tersembunyi tidak mematikan tab", () => {
    const layout = resolveDialogLayout({
      ...base,
      isNarrow: true,
      isPreviewVisible: false,
    });
    expect(layout.showEditorPreviewTabs).toBe(true);
    expect(layout.showSidePreview).toBe(false);
  });

  it("layar konfirmasi: tanpa toggle dan tanpa tab di lebar apa pun", () => {
    for (const isNarrow of [false, true]) {
      const layout = resolveDialogLayout({
        ...base,
        isNarrow,
        isConfirming: true,
      });
      expect(layout.showVariantToggle).toBe(false);
      expect(layout.showPreviewToggle).toBe(false);
      expect(layout.showEditorPreviewTabs).toBe(false);
    }
  });
});
