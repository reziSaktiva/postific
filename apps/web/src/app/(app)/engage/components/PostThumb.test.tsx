// @vitest-environment jsdom
import { MediaType } from "@postific/shared";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PostThumb } from "./PostThumb";

afterEach(cleanup);

const external = { url: "https://cdn.example/a.jpg", type: MediaType.Image };

describe("PostThumb (T-227)", () => {
  it("merender gambar eksternal tanpa Referer", () => {
    const { container } = render(<PostThumb thumbnail={external} />);
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe(external.url);
    expect(img?.getAttribute("referrerpolicy")).toBe("no-referrer");
  });

  it("jatuh ke ikon placeholder saat gambar gagal dimuat", () => {
    const { container } = render(<PostThumb thumbnail={external} />);
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("mencoba memuat thumbnail baru dengan URL berbeda setelah kegagalan", () => {
    const { container, rerender } = render(<PostThumb thumbnail={external} />);
    fireEvent.error(container.querySelector("img")!);
    rerender(
      <PostThumb
        thumbnail={{ ...external, url: "https://cdn.example/b.jpg" }}
      />,
    );
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "https://cdn.example/b.jpg",
    );
  });

  it("jatuh ke ikon bila gambar sudah gagal sebelum hydration (tanpa event error)", () => {
    const complete = vi
      .spyOn(HTMLImageElement.prototype, "complete", "get")
      .mockReturnValue(true);
    const width = vi
      .spyOn(HTMLImageElement.prototype, "naturalWidth", "get")
      .mockReturnValue(0);
    try {
      const { container } = render(<PostThumb thumbnail={external} />);
      expect(container.querySelector("img")).toBeNull();
      expect(container.querySelector("svg")).not.toBeNull();
    } finally {
      complete.mockRestore();
      width.mockRestore();
    }
  });

  it("tanpa thumbnail menampilkan ikon", () => {
    const { container } = render(<PostThumb thumbnail={null} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
  });
});
