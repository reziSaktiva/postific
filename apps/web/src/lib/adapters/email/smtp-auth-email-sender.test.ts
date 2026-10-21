import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendMail, createTransport } = vi.hoisted(() => ({
  sendMail: vi.fn(),
  createTransport: vi.fn(),
}));

vi.mock("nodemailer", () => ({
  default: {
    createTransport,
  },
}));

import { createSmtpAuthEmailSender } from "./smtp-auth-email-sender";

describe("createSmtpAuthEmailSender", () => {
  beforeEach(() => {
    sendMail.mockReset();
    sendMail.mockResolvedValue({ messageId: "test" });
    createTransport.mockReset();
    createTransport.mockReturnValue({ sendMail });
  });

  const config = {
    host: "smtp.test.local",
    port: 587,
    user: "rezi@insvire.com",
    password: "secret",
    fromEmail: "rezi@insvire.com",
  };

  it("membentuk transport dari host/port/user/password yang diberikan", () => {
    createSmtpAuthEmailSender(config);

    expect(createTransport).toHaveBeenCalledWith({
      host: "smtp.test.local",
      port: 587,
      secure: false,
      auth: { user: "rezi@insvire.com", pass: "secret" },
    });
  });

  it("secure: true saat port 465", () => {
    createSmtpAuthEmailSender({ ...config, port: 465 });

    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ secure: true }),
    );
  });

  describe("sendPasswordResetEmail", () => {
    it("mengirim email dari fromEmail ke user dengan link reset di body", async () => {
      const sender = createSmtpAuthEmailSender(config);

      await sender.sendPasswordResetEmail({
        email: "raka@example.com",
        name: "Raka",
        url: "https://app.test/reset-password?token=abc",
      });

      expect(sendMail).toHaveBeenCalledTimes(1);
      const payload = sendMail.mock.calls[0]?.[0] as {
        from: string;
        to: string;
        subject: string;
        html: string;
      };
      expect(payload.from).toBe("rezi@insvire.com");
      expect(payload.to).toBe("raka@example.com");
      expect(payload.html).toContain(
        "https://app.test/reset-password?token=abc",
      );
    });

    it("escapes nama dan url di html", async () => {
      const sender = createSmtpAuthEmailSender(config);

      await sender.sendPasswordResetEmail({
        email: "maya@example.com",
        name: '<Maya> & "Admin"',
        url: 'https://app.test/reset-password?token=abc&x="1"',
      });

      const html = sendMail.mock.calls[0]?.[0]?.html as string;
      expect(html).toContain("&lt;Maya&gt; &amp; &quot;Admin&quot;");
      expect(html).toContain(
        "https://app.test/reset-password?token=abc&amp;x=&quot;1&quot;",
      );
      expect(html).not.toContain("<Maya>");
    });

    it("throws kalau transport SMTP gagal mengirim", async () => {
      sendMail.mockRejectedValueOnce(new Error("connection timeout"));
      const sender = createSmtpAuthEmailSender(config);

      await expect(
        sender.sendPasswordResetEmail({
          email: "raka@example.com",
          name: "Raka",
          url: "https://app.test/reset-password?token=abc",
        }),
      ).rejects.toThrow(/connection timeout/);
    });
  });

  describe("sendVerificationEmail", () => {
    it("mengirim email dari fromEmail ke user dengan link verifikasi di body", async () => {
      const sender = createSmtpAuthEmailSender(config);

      await sender.sendVerificationEmail({
        email: "raka@example.com",
        name: "Raka",
        url: "https://app.test/api/auth/verify-email?token=abc",
      });

      expect(sendMail).toHaveBeenCalledTimes(1);
      const payload = sendMail.mock.calls[0]?.[0] as {
        from: string;
        to: string;
        subject: string;
        html: string;
      };
      expect(payload.from).toBe("rezi@insvire.com");
      expect(payload.to).toBe("raka@example.com");
      expect(payload.html).toContain(
        "https://app.test/api/auth/verify-email?token=abc",
      );
    });

    it("throws kalau transport SMTP gagal mengirim", async () => {
      sendMail.mockRejectedValueOnce(new Error("auth failed"));
      const sender = createSmtpAuthEmailSender(config);

      await expect(
        sender.sendVerificationEmail({
          email: "raka@example.com",
          name: "Raka",
          url: "https://app.test/api/auth/verify-email?token=abc",
        }),
      ).rejects.toThrow(/auth failed/);
    });
  });
});
