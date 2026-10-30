// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { SourceFilterSelect } from "./SourceFilterSelect";
import { SourceFilter } from "./source-filter";

beforeAll(() => {
  // Radix Select membutuhkan API ini yang tidak ada di jsdom.
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
});

afterEach(cleanup);

describe("SourceFilterSelect", () => {
  it("menampilkan nilai terpilih, tiga opsi, dan memanggil onValueChange", () => {
    const onValueChange = vi.fn();
    render(
      <SourceFilterSelect
        value={SourceFilter.All}
        onValueChange={onValueChange}
      />,
    );
    const trigger = screen.getByRole("combobox", { name: "Filter sumber" });
    expect(trigger.textContent).toContain("Semua Sumber");

    fireEvent.keyDown(trigger, { key: "Enter" });
    const labels = screen.getAllByRole("option").map((o) => o.textContent);
    expect(labels).toEqual(["Semua Sumber", "Dibuat Manual", "Lewat MCP"]);

    fireEvent.click(screen.getByRole("option", { name: "Lewat MCP" }));
    expect(onValueChange).toHaveBeenCalledWith(SourceFilter.Mcp);
  });
});
