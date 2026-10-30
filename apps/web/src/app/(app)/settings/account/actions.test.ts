import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExternalServiceError, ValidationError } from "@/lib/utils/errors";

const { getSessionMock, redirectMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  redirectMock: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

const { revalidatePathMock } = vi.hoisted(() => ({
  revalidatePathMock: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));

vi.mock("@/lib/better-auth/auth", () => ({
  auth: { api: { getSession: getSessionMock } },
}));

vi.mock("@/lib/repositories/identity", () => ({ identityRepository: {} }));
vi.mock("@/lib/adapters/avatar-storage", () => ({
  supabaseAvatarStorageAdapter: {},
}));

import { IdentityService } from "@/domains/identity";
import { detectTimeZoneAction, updateProfileAction } from "./actions";

function profileForm(name = "Raka") {
  const formData = new FormData();
  formData.set("name", name);
  return formData;
}

describe("updateProfileAction", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    getSessionMock.mockReset();
    getSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    redirectMock.mockClear();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("meneruskan pesan ValidationError ke form", async () => {
    vi.spyOn(IdentityService.prototype, "updateProfile").mockRejectedValue(
      new ValidationError("Nama wajib diisi."),
    );

    const result = await updateProfileAction(profileForm("   "));

    expect(result).toEqual({ ok: false, error: "Nama wajib diisi." });
  });

  it("menyembunyikan teks provider dari ExternalServiceError", async () => {
    vi.spyOn(IdentityService.prototype, "updateProfile").mockRejectedValue(
      new ExternalServiceError("Gagal upload avatar.", {
        cause: { message: "bucket not found" },
      }),
    );

    const result = await updateProfileAction(profileForm());

    expect(result).toEqual({
      ok: false,
      error: "Gagal menyimpan profil. Coba lagi.",
    });
    if ("error" in result) {
      expect(result.error).not.toContain("bucket not found");
    }
  });

  it("menyembunyikan error tak terduga di balik pesan generik", async () => {
    vi.spyOn(IdentityService.prototype, "updateProfile").mockRejectedValue(
      new Error("prisma exploded"),
    );

    const result = await updateProfileAction(profileForm());

    expect(result).toEqual({
      ok: false,
      error: "Gagal menyimpan profil. Coba lagi.",
    });
  });
});

describe("detectTimeZoneAction (T-147)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    getSessionMock.mockReset();
    getSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    redirectMock.mockClear();
    revalidatePathMock.mockClear();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("menyimpan zona terdeteksi dan me-revalidate layout saat diterapkan", async () => {
    vi.spyOn(
      IdentityService.prototype,
      "applyDetectedTimeZone",
    ).mockResolvedValue({ timeZone: "Europe/London" } as never);

    const result = await detectTimeZoneAction("Europe/London");

    expect(result).toEqual({
      ok: true,
      applied: true,
      timeZone: "Europe/London",
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/", "layout");
  });

  it("tidak menimpa zona yang sudah terdeteksi atau dipilih manual", async () => {
    vi.spyOn(
      IdentityService.prototype,
      "applyDetectedTimeZone",
    ).mockResolvedValue(null);

    const result = await detectTimeZoneAction("Europe/London");

    expect(result).toEqual({
      ok: true,
      applied: false,
      timeZone: "Europe/London",
    });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("meneruskan pesan ValidationError untuk zona tidak valid", async () => {
    vi.spyOn(
      IdentityService.prototype,
      "applyDetectedTimeZone",
    ).mockRejectedValue(new ValidationError("Zona waktu tidak valid."));

    const result = await detectTimeZoneAction("Bukan/Zona");

    expect(result).toEqual({ ok: false, error: "Zona waktu tidak valid." });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("mengarahkan ke /login tanpa sesi", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(detectTimeZoneAction("Europe/London")).rejects.toThrow(
      "REDIRECT:/login",
    );
  });
});
