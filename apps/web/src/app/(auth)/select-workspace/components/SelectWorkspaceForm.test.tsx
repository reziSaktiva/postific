// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { consent, proceed, chooseWorkspace } = vi.hoisted(() => ({
  consent: vi.fn(),
  proceed: vi.fn(),
  chooseWorkspace: vi.fn(),
}));

vi.mock("@/lib/better-auth/client", () => ({
  authClient: { oauth2: { consent, continue: proceed } },
}));
vi.mock("../../_mcp-oauth/actions", () => ({
  chooseWorkspaceAction: chooseWorkspace,
}));

import { SelectWorkspaceForm } from "./SelectWorkspaceForm";

const CLAUDE = { name: "Claude", hosts: ["claude.ai"], isUnusual: false };
const WORKSPACES = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Kopi Selasar",
    roleLabel: "Owner",
    connectedAccountCount: 3,
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Roti Selasar",
    roleLabel: "Admin",
    connectedAccountCount: 2,
  },
];

function renderForm(
  overrides: Partial<React.ComponentProps<typeof SelectWorkspaceForm>> = {},
) {
  return render(
    <SelectWorkspaceForm
      email="raka@kopiselasar.com"
      client={CLAUDE}
      workspaces={WORKSPACES}
      initialSelectedId={null}
      {...overrides}
    />,
  );
}

beforeEach(() => {
  consent.mockReset();
  proceed.mockReset();
  chooseWorkspace.mockReset();
  chooseWorkspace.mockResolvedValue({ ok: true });
  proceed.mockResolvedValue({ error: null });
  consent.mockResolvedValue({ error: null });
});
afterEach(cleanup);

describe("SelectWorkspaceForm (T-151, KSP-09 langkah 1)", () => {
  it("lists each workspace as a radio with name, role and connected account count", () => {
    renderForm();

    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(2);
    expect(screen.getByText("Claude ingin tersambung")).toBeTruthy();
    expect(screen.getByText(/raka@kopiselasar\.com/)).toBeTruthy();
    expect(screen.getByText("Owner")).toBeTruthy();
    expect(screen.getByText("Admin")).toBeTruthy();
    expect(screen.getByText("3 akun terhubung")).toBeTruthy();
    expect(screen.getByText("2 akun terhubung")).toBeTruthy();
  });

  it("preselects the first workspace, or the one already chosen (back from step 2)", () => {
    renderForm();
    expect(radio("Kopi Selasar").getAttribute("aria-checked")).toBe("true");
    cleanup();

    renderForm({ initialSelectedId: WORKSPACES[1]!.id });
    expect(radio("Roti Selasar").getAttribute("aria-checked")).toBe("true");
    expect(radio("Kopi Selasar").getAttribute("aria-checked")).toBe("false");
  });

  it("saves the picked workspace, then continues the OAuth flow", async () => {
    renderForm();

    fireEvent.click(radio("Roti Selasar"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Lanjut" }));
    });

    expect(chooseWorkspace).toHaveBeenCalledWith(WORKSPACES[1]!.id);
    expect(proceed).toHaveBeenCalledWith({ postLogin: true });
    expect(chooseWorkspace.mock.invocationCallOrder[0]).toBeLessThan(
      proceed.mock.invocationCallOrder[0]!,
    );
  });

  it("shows the server's error and does not continue when saving the choice is refused", async () => {
    chooseWorkspace.mockResolvedValue({
      ok: false,
      error: "Anda bukan lagi anggota aktif workspace ini.",
    });
    renderForm();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Lanjut" }));
    });

    expect(
      screen.getByText("Anda bukan lagi anggota aktif workspace ini."),
    ).toBeTruthy();
    expect(proceed).not.toHaveBeenCalled();
    expect(
      (screen.getByRole("button", { name: "Lanjut" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it("shows an error when continuing fails or the action throws, and unlocks the buttons", async () => {
    proceed.mockResolvedValue({ error: { message: "sig kedaluwarsa" } });
    renderForm();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Lanjut" }));
    });
    expect(screen.getByText("sig kedaluwarsa")).toBeTruthy();

    chooseWorkspace.mockRejectedValue(new Error("network"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Lanjut" }));
    });
    expect(
      screen.getByText(/Gagal melanjutkan\. Periksa koneksi/),
    ).toBeTruthy();
  });

  it("locks the controls while saving", async () => {
    let finish: (value: { ok: true }) => void = () => {};
    chooseWorkspace.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    renderForm();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Lanjut" }));
    });

    expect(
      (screen.getByRole("button", { name: "Batal" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: /Lanjut/ }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    await act(async () => finish({ ok: true }));
  });

  it("Batal denies the authorization (accept false) without saving a workspace", async () => {
    renderForm();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Batal" }));
    });

    expect(consent).toHaveBeenCalledWith({ accept: false });
    expect(chooseWorkspace).not.toHaveBeenCalled();
  });

  describe("user without any workspace", () => {
    it("shows the empty state with a Buat Workspace link and a disabled Lanjut", () => {
      renderForm({ workspaces: [] });

      expect(
        screen.getByText("Anda belum menjadi anggota workspace mana pun"),
      ).toBeTruthy();
      expect(
        screen
          .getByRole("link", { name: "Buat Workspace" })
          .getAttribute("href"),
      ).toBe("/onboarding");
      expect(screen.queryAllByRole("radio")).toHaveLength(0);
      expect(
        (screen.getByRole("button", { name: "Lanjut" }) as HTMLButtonElement)
          .disabled,
      ).toBe(true);
      expect(
        (screen.getByRole("button", { name: "Batal" }) as HTMLButtonElement)
          .disabled,
      ).toBe(false);
    });
  });

  it("names an unnamed client as 'Klien tanpa nama'", () => {
    renderForm({ client: { name: null, hosts: [], isUnusual: true } });

    expect(screen.getByText("Klien tanpa nama ingin tersambung")).toBeTruthy();
  });
});

function radio(workspaceName: string) {
  return screen.getByRole("radio", { name: new RegExp(workspaceName) });
}
