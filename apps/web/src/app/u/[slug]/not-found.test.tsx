import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import StartPageNotFound from "./not-found";

describe("StartPageNotFound (T-166)", () => {
  const html = renderToStaticMarkup(<StartPageNotFound />);

  it("menampilkan copy yang dikonfirmasi", () => {
    expect(html).toContain("Halaman tidak ditemukan");
    expect(html).toContain(
      "Alamat ini tidak mengarah ke halaman yang tersedia. Periksa kembali tautannya, atau hubungi orang yang membagikannya.",
    );
    expect(html).toContain("Powered by");
    expect(html).toContain("Postific");
  });

  it("punya landmark main dan tepat satu heading level 1", () => {
    expect(html.match(/<main[\s>]/g)).toHaveLength(1);
    const h1 = html.match(/<h1[\s>]|role="heading"[^>]*aria-level="1"/g);
    expect(h1).toHaveLength(1);
  });

  it("tanpa inline style (CSP bernonce, ADR-144)", () => {
    expect(html).not.toMatch(/\sstyle=/);
    expect(html).not.toContain("<style");
  });

  it("tanpa tautan atau tombol ke beranda", () => {
    expect(html).not.toContain("<a ");
    expect(html).not.toContain("<button");
  });
});
