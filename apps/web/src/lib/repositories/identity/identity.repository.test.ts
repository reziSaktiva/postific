import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUnique, update } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/prisma/client", () => ({
  prisma: {
    user: { findUnique, update },
  },
}));

import { identityRepository } from "./identity.repository";

const RAW_USER = {
  id: "user-1",
  name: "Raka",
  email: "raka@example.com",
  image: null as string | null,
};

describe("identityRepository", () => {
  beforeEach(() => {
    findUnique.mockReset();
    update.mockReset();
  });

  describe("findById()", () => {
    it("maps the Prisma user row to a UserProfileRecord with a branded UserId", async () => {
      findUnique.mockResolvedValue(RAW_USER);

      const result = await identityRepository.findById("user-1" as never);

      expect(findUnique).toHaveBeenCalledWith({
        where: { id: "user-1" },
        select: { id: true, name: true, email: true, image: true },
      });
      expect(result).toEqual({
        id: "user-1",
        name: "Raka",
        email: "raka@example.com",
        image: null,
      });
    });

    it("returns null when Prisma finds no matching user", async () => {
      findUnique.mockResolvedValue(null);

      const result = await identityRepository.findById("missing" as never);

      expect(result).toBeNull();
    });
  });

  describe("updateProfile()", () => {
    it("only forwards fields present in data (name only) — image left untouched", async () => {
      update.mockResolvedValue({ ...RAW_USER, name: "Sinta" });

      await identityRepository.updateProfile("user-1" as never, {
        name: "Sinta",
      });

      expect(update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { name: "Sinta" },
        select: { id: true, name: true, email: true, image: true },
      });
    });

    it("only forwards fields present in data (image only) — name left untouched", async () => {
      update.mockResolvedValue({
        ...RAW_USER,
        image: "https://storage.example/avatar.jpg",
      });

      await identityRepository.updateProfile("user-1" as never, {
        image: "https://storage.example/avatar.jpg",
      });

      expect(update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { image: "https://storage.example/avatar.jpg" },
        select: { id: true, name: true, email: true, image: true },
      });
    });

    it("forwards both fields when both are present and maps the result", async () => {
      update.mockResolvedValue({
        id: "user-1",
        name: "Dimas",
        email: "raka@example.com",
        image: "https://storage.example/avatar.png",
      });

      const result = await identityRepository.updateProfile("user-1" as never, {
        name: "Dimas",
        image: "https://storage.example/avatar.png",
      });

      expect(update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { name: "Dimas", image: "https://storage.example/avatar.png" },
        select: { id: true, name: true, email: true, image: true },
      });
      expect(result).toEqual({
        id: "user-1",
        name: "Dimas",
        email: "raka@example.com",
        image: "https://storage.example/avatar.png",
      });
    });
  });
});
