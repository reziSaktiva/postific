import { describe, expect, it } from "vitest";
import { escapeHtml } from "./html-escape";

describe("escapeHtml", () => {
  it('escapes &, <, >, dan " tanpa mengubah teks biasa', () => {
    expect(escapeHtml('<Maya> & "Admin"')).toBe(
      "&lt;Maya&gt; &amp; &quot;Admin&quot;",
    );
    expect(escapeHtml("Kopi Selasar")).toBe("Kopi Selasar");
  });

  it("mencegah payload HTML/script injection berbahaya", () => {
    const escaped = escapeHtml('<script>alert("x")</script>');
    expect(escaped).not.toContain("<script>");
    expect(escaped).toBe("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
  });
});
