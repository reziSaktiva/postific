import { beforeEach, describe, expect, it, vi } from "vitest";

const { createTransport } = vi.hoisted(() => ({
  createTransport: vi.fn(),
}));

vi.mock("nodemailer", () => ({
  default: {
    createTransport,
  },
}));

import { createSmtpTransport } from "./smtp-transport";

describe("createSmtpTransport", () => {
  beforeEach(() => {
    createTransport.mockReset();
    createTransport.mockReturnValue({ sendMail: vi.fn() });
  });

  const config = {
    host: "smtp.test.local",
    port: 587,
    user: "rezi@insvire.com",
    password: "secret",
    fromEmail: "rezi@insvire.com",
  };

  it("port 587 (STARTTLS): secure: false, requireTLS: true — supaya nodemailer throw alih-alih silent fallback ke plaintext kalau STARTTLS gagal dinegosiasikan", () => {
    createSmtpTransport(config);

    expect(createTransport).toHaveBeenCalledWith({
      host: "smtp.test.local",
      port: 587,
      secure: false,
      requireTLS: true,
      auth: { user: "rezi@insvire.com", pass: "secret" },
    });
  });

  it("port 465 (implicit TLS): secure: true, requireTLS: false (STARTTLS tidak relevan, sudah TLS sejak awal)", () => {
    createSmtpTransport({ ...config, port: 465 });

    expect(createTransport).toHaveBeenCalledWith({
      host: "smtp.test.local",
      port: 465,
      secure: true,
      requireTLS: false,
      auth: { user: "rezi@insvire.com", pass: "secret" },
    });
  });

  it("port custom non-465 (mis. 2525) tetap requireTLS: true", () => {
    createSmtpTransport({ ...config, port: 2525 });

    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ secure: false, requireTLS: true }),
    );
  });
});
