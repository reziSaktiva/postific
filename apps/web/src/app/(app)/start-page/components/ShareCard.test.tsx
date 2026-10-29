// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { StartPageRecord } from "@/domains/start-page";

const { publishMock, toastMock } = vi.hoisted(() => ({
  publishMock: vi.fn(),
  toastMock: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("../actions", () => ({ setStartPagePublishedAction: publishMock }));
vi.mock("sonner", () => ({ toast: toastMock }));

import { ShareCard } from "./ShareCard";

function makePage(isPublished = false): StartPageRecord {
  return {
    id: "p1",
    slug: "kopi-selasar",
    isPublished,
  } as unknown as StartPageRecord;
}

const writeText = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  writeText.mockReset();
  writeText.mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
  publishMock.mockReset();
  toastMock.success.mockReset();
  toastMock.error.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

async function clickCopy() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /^Salin|Disalin/ }));
  });
}

describe("ShareCard copy button timer (T-167.5)", () => {
  it("shows 'Disalin!' then reverts to 'Salin' after 2s", async () => {
    render(
      <ShareCard
        page={makePage()}
        appOrigin="https://postific.test"
        onPublishedChange={vi.fn()}
      />,
    );
    await clickCopy();

    expect(writeText).toHaveBeenCalledWith(
      "https://postific.test/u/kopi-selasar",
    );
    expect(screen.getByRole("button", { name: "Disalin!" })).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(1999);
    });
    expect(screen.getByRole("button", { name: "Disalin!" })).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByRole("button", { name: "Salin" })).toBeTruthy();
  });

  it("restarts the 2s window when copied again", async () => {
    render(
      <ShareCard
        page={makePage()}
        appOrigin="https://postific.test"
        onPublishedChange={vi.fn()}
      />,
    );
    await clickCopy();
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    await clickCopy();
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    // 3s sejak klik pertama, tapi hanya 1,5s sejak klik kedua.
    expect(screen.getByRole("button", { name: "Disalin!" })).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByRole("button", { name: "Salin" })).toBeTruthy();
  });

  it("clears the pending timer on unmount", async () => {
    const { unmount } = render(
      <ShareCard
        page={makePage()}
        appOrigin="https://postific.test"
        onPublishedChange={vi.fn()}
      />,
    );
    await clickCopy();
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("falls back to window.location.origin when appOrigin is empty", async () => {
    render(
      <ShareCard
        page={makePage()}
        appOrigin={null}
        onPublishedChange={vi.fn()}
      />,
    );
    await clickCopy();
    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/u/kopi-selasar`,
    );
  });

  it("shows an error toast and no 'Disalin!' when the clipboard rejects", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    render(
      <ShareCard
        page={makePage()}
        appOrigin="https://postific.test"
        onPublishedChange={vi.fn()}
      />,
    );
    await clickCopy();
    expect(toastMock.error).toHaveBeenCalledWith(
      "Gagal menyalin. Salin URL secara manual.",
    );
    expect(screen.queryByRole("button", { name: "Disalin!" })).toBeNull();
  });
});

describe("ShareCard publish toggle", () => {
  it("publishes, reports the new page, and toasts", async () => {
    const published = makePage(true);
    publishMock.mockResolvedValue({ data: published });
    const onPublishedChange = vi.fn();
    render(
      <ShareCard
        page={makePage(false)}
        appOrigin="https://postific.test"
        onPublishedChange={onPublishedChange}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    });
    expect(publishMock).toHaveBeenCalledWith(true);
    expect(onPublishedChange).toHaveBeenCalledWith(published);
    expect(toastMock.success).toHaveBeenCalledWith("Halaman dipublish.");
  });

  it("surfaces the action error and does not change the page", async () => {
    publishMock.mockResolvedValue({ error: "Tidak diizinkan." });
    const onPublishedChange = vi.fn();
    render(
      <ShareCard
        page={makePage(true)}
        appOrigin="https://postific.test"
        onPublishedChange={onPublishedChange}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Unpublish" }));
    });
    expect(publishMock).toHaveBeenCalledWith(false);
    expect(toastMock.error).toHaveBeenCalledWith("Tidak diizinkan.");
    expect(onPublishedChange).not.toHaveBeenCalled();
  });
});
