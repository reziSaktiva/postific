// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { consent, chooseWorkspace } = vi.hoisted(() => ({
  consent: vi.fn(),
  chooseWorkspace: vi.fn(),
}));

vi.mock("@/lib/better-auth/client", () => ({
  authClient: { oauth2: { consent } },
}));
vi.mock("../../_mcp-oauth/actions", () => ({
  chooseWorkspaceAction: chooseWorkspace,
}));

import { selectableConsentScopes } from "../../_mcp-oauth/scope-copy";
import { ConsentForm } from "./ConsentForm";

const CLAUDE = { name: "Claude", hosts: ["claude.ai"], isUnusual: false };
const UNUSUAL = { name: null, hosts: ["localhost:6274"], isUnusual: true };
const WORKSPACE = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Kopi Selasar",
  roleLabel: "Owner",
};
const REQUESTED = ["mcp:read", "mcp:draft", "mcp:schedule", "offline_access"];

function renderForm(
  overrides: Partial<React.ComponentProps<typeof ConsentForm>> = {},
) {
  return render(
    <ConsentForm
      client={CLAUDE}
      workspace={WORKSPACE}
      changeWorkspaceHref="/select-workspace?client_id=c1&sig=abc"
      scopes={selectableConsentScopes(REQUESTED)}
      passthroughScopes={["offline_access"]}
      {...overrides}
    />,
  );
}

function checkbox(scope: string) {
  return screen.getByRole("checkbox", {
    name: new RegExp(`^${scope.replace("mcp:", "")}`),
  });
}

beforeEach(() => {
  consent.mockReset();
  chooseWorkspace.mockReset();
  chooseWorkspace.mockResolvedValue({ ok: true });
  consent.mockResolvedValue({ error: null });
});
afterEach(cleanup);

describe("ConsentForm (T-151, KSP-09 langkah 2)", () => {
  it("shows client name and host, workspace with role and a link to change it", () => {
    renderForm();

    expect(screen.getByText("Claude meminta akses")).toBeTruthy();
    expect(screen.getByText("claude.ai")).toBeTruthy();
    expect(screen.getByText("Kopi Selasar")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Ubah" }).getAttribute("href"),
    ).toBe("/select-workspace?client_id=c1&sig=abc");
  });

  it("checks read and draft by default, leaves schedule unchecked and flags it as impactful", () => {
    renderForm();

    expect(checkbox("mcp:read").getAttribute("aria-checked")).toBe("true");
    expect(checkbox("mcp:draft").getAttribute("aria-checked")).toBe("true");
    expect(checkbox("mcp:schedule").getAttribute("aria-checked")).toBe("false");
    expect(screen.getByText("Berdampak")).toBeTruthy();
  });

  it("never lists publish or reply", () => {
    renderForm({
      scopes: selectableConsentScopes([
        ...REQUESTED,
        "mcp:publish",
        "mcp:reply",
      ]),
    });

    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
    expect(screen.queryByText(/publish/i)).toBeNull();
    expect(screen.queryByText(/reply/i)).toBeNull();
  });

  it("does not restrict scopes by role: every scope stays enabled for Creator", () => {
    renderForm({ workspace: { ...WORKSPACE, roleLabel: "Creator" } });

    for (const box of screen.getAllByRole("checkbox")) {
      expect((box as HTMLButtonElement).disabled).toBe(false);
    }
  });

  it("re-saves the displayed workspace, then sends only the checked scopes plus offline_access", async () => {
    renderForm();

    fireEvent.click(checkbox("mcp:schedule"));
    fireEvent.click(checkbox("mcp:draft"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Izinkan" }));
    });

    expect(chooseWorkspace).toHaveBeenCalledWith(WORKSPACE.id);
    expect(consent).toHaveBeenCalledWith({
      accept: true,
      scope: "mcp:read mcp:schedule offline_access",
    });
    expect(chooseWorkspace.mock.invocationCallOrder[0]).toBeLessThan(
      consent.mock.invocationCallOrder[0]!,
    );
  });

  it("Tolak denies without sending scopes or touching the workspace choice", async () => {
    renderForm();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Tolak" }));
    });

    expect(consent).toHaveBeenCalledWith({ accept: false, scope: undefined });
    expect(chooseWorkspace).not.toHaveBeenCalled();
  });

  it("disables Izinkan when every scope is unchecked", () => {
    renderForm();

    fireEvent.click(checkbox("mcp:read"));
    fireEvent.click(checkbox("mcp:draft"));

    expect(
      (screen.getByRole("button", { name: "Izinkan" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("locks every control and shows 'Menyimpan…' while saving", async () => {
    let finish: (value: { error: null }) => void = () => {};
    consent.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    renderForm();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Izinkan" }));
    });

    expect(screen.getByRole("button", { name: /Menyimpan…/ })).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Tolak" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    for (const box of screen.getAllByRole("checkbox")) {
      expect((box as HTMLButtonElement).disabled).toBe(true);
    }
    expect(screen.queryByRole("link", { name: "Ubah" })).toBeNull();

    await act(async () => finish({ error: null }));
  });

  it("shows the error banner and 'Coba Lagi' when saving fails, keeping the user's choices", async () => {
    consent.mockResolvedValue({ error: { message: "boom" } });
    renderForm();

    fireEvent.click(checkbox("mcp:schedule"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Izinkan" }));
    });

    expect(
      screen.getByText(/Persetujuan gagal disimpan\. Tidak ada akses/),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Coba Lagi" })).toBeTruthy();
    expect(checkbox("mcp:schedule").getAttribute("aria-checked")).toBe("true");
  });

  it("treats a thrown Server Action as a failed save (no access granted)", async () => {
    chooseWorkspace.mockRejectedValue(new Error("network"));
    renderForm();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Izinkan" }));
    });

    expect(consent).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Coba Lagi" })).toBeTruthy();
  });

  it("does not send consent when re-saving the workspace is refused", async () => {
    chooseWorkspace.mockResolvedValue({ ok: false, error: "bukan anggota" });
    renderForm();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Izinkan" }));
    });

    expect(consent).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Coba Lagi" })).toBeTruthy();
  });

  describe("unnamed client or unusual host", () => {
    it("warns loudly, shows the host, and renames the allow button", () => {
      renderForm({ client: UNUSUAL });

      expect(screen.getByText("Klien tanpa nama")).toBeTruthy();
      expect(screen.getByText("localhost:6274")).toBeTruthy();
      expect(
        screen.getByText(/Postific tidak dapat memastikan siapa pemilik/),
      ).toBeTruthy();
      expect(
        screen.getByRole("button", { name: "Saya paham, izinkan" }),
      ).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Izinkan" })).toBeNull();
    });

    it("makes Tolak the primary button and Izinkan the secondary one", () => {
      renderForm({ client: UNUSUAL });

      expect(
        screen
          .getByRole("button", { name: "Tolak" })
          .getAttribute("data-variant"),
      ).toBe("default");
      expect(
        screen
          .getByRole("button", { name: "Saya paham, izinkan" })
          .getAttribute("data-variant"),
      ).toBe("outline");
    });

    it("keeps Izinkan primary and Tolak secondary for a usual client", () => {
      renderForm();

      expect(
        screen
          .getByRole("button", { name: "Izinkan" })
          .getAttribute("data-variant"),
      ).toBe("default");
      expect(
        screen
          .getByRole("button", { name: "Tolak" })
          .getAttribute("data-variant"),
      ).toBe("outline");
    });

    it("shows a placeholder host when none could be read", () => {
      renderForm({ client: { name: "X", hosts: [], isUnusual: true } });

      expect(screen.getByText("host tidak diketahui")).toBeTruthy();
    });
  });

  it("explains and blocks approval when the client requested no known scope", () => {
    renderForm({ scopes: [], passthroughScopes: [] });

    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.getByText(/tidak meminta izin yang dikenal/)).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Izinkan" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});
