// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { PostCreatedVia } from "@postific/shared";
import { afterEach, describe, expect, it } from "vitest";

import { McpSourceBadge } from "./McpSourceBadge";

afterEach(cleanup);

describe("McpSourceBadge", () => {
  it("tidak merender apa pun untuk item manual atau createdVia undefined", () => {
    const { container, rerender } = render(
      <McpSourceBadge createdVia={PostCreatedVia.App} clientName="Claude" />,
    );
    expect(container.innerHTML).toBe("");
    rerender(<McpSourceBadge />);
    expect(container.innerHTML).toBe("");
  });

  it("merender nama klien dan teks sr-only untuk item MCP", () => {
    render(
      <McpSourceBadge createdVia={PostCreatedVia.Mcp} clientName="Claude" />,
    );
    expect(screen.getByText("Claude")).toBeTruthy();
    const sr = screen.getByText(/Dibuat lewat MCP oleh/);
    expect(sr.className).toContain("sr-only");
  });

  it.each([null, undefined, "   "])(
    "memakai fallback Klien AI untuk nama %j",
    (clientName) => {
      render(
        <McpSourceBadge
          createdVia={PostCreatedVia.Mcp}
          clientName={clientName}
        />,
      );
      expect(screen.getByText("Klien AI")).toBeTruthy();
    },
  );
});
