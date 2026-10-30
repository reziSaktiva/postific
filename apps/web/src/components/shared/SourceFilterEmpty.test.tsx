// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SourceFilterEmpty } from "./SourceFilterEmpty";

afterEach(cleanup);

describe("SourceFilterEmpty", () => {
  it.each([
    ["mcp", "Belum ada konten dari klien AI"],
    ["manual", "Belum ada konten yang dibuat manual"],
    ["generic", "Tidak ada hasil untuk filter ini"],
  ] as const)("kind %s menampilkan judul yang sesuai", (kind, title) => {
    render(<SourceFilterEmpty kind={kind} onShowAll={() => {}} />);
    expect(screen.getByText(title)).toBeTruthy();
  });

  it("tombol Tampilkan Semua memanggil callback", () => {
    const onShowAll = vi.fn();
    render(<SourceFilterEmpty kind="generic" onShowAll={onShowAll} />);
    fireEvent.click(screen.getByRole("button", { name: "Tampilkan Semua" }));
    expect(onShowAll).toHaveBeenCalledTimes(1);
  });
});
