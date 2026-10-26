import { beforeEach, describe, expect, it, vi } from "vitest";

const { send } = vi.hoisted(() => ({
  send: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));

import { createResendAuthEmailSender } from "./resend-auth-email-sender";

describe("createResendAuthEmailSender", () => {
  beforeEach(() => {
    send.mockReset();
    send.mockResolvedValue({ error: null });
  });

  describe("sendPasswordResetEmail", () => {
    it("mengirim email dari fromEmail ke user dengan link reset di body", async () => {
      const sender = createResendAuthEmailSender(
        "re_test",
        "onboarding@resend.dev",
      );

      await sender.sendPasswordResetEmail({
        email: "raka@example.com",
        name: "Raka",
        url: "https://app.test/reset-password?token=abc",
      });

      expect(send).toHaveBeenCalledTimes(1);
      const payload = send.mock.calls[0]?.[0] as {
        from: string;
        to: string;
        subject: string;
        html: string;
      };
      expect(payload.from).toBe("onboarding@resend.dev");
      expect(payload.to).toBe("raka@example.com");
      expect(payload.html).toContain(
        "https://app.test/reset-password?token=abc",
      );
    });

    it("escapes nama dan url di html", async () => {
      const sender = createResendAuthEmailSender(
        "re_test",
        "onboarding@resend.dev",
      );

      await sender.sendPasswordResetEmail({
        email: "maya@example.com",
        name: '<Maya> & "Admin"',
        url: 'https://app.test/reset-password?token=abc&x="1"',
      });

      const html = send.mock.calls[0]?.[0]?.html as string;
      expect(html).toContain("&lt;Maya&gt; &amp; &quot;Admin&quot;");
      expect(html).toContain(
        "https://app.test/reset-password?token=abc&amp;x=&quot;1&quot;",
      );
      expect(html).not.toContain("<Maya>");
    });

    it("throws kalau Resend mengembalikan error", async () => {
      send.mockResolvedValueOnce({ error: { message: "rate limited" } });
      const sender = createResendAuthEmailSender(
        "re_test",
        "onboarding@resend.dev",
      );

      await expect(
        sender.sendPasswordResetEmail({
          email: "raka@example.com",
          name: "Raka",
          url: "https://app.test/reset-password?token=abc",
        }),
      ).rejects.toThrow(/rate limited/);
    });
  });

  describe("sendVerificationEmail", () => {
    it("mengirim email dari fromEmail ke user dengan link verifikasi di body", async () => {
      const sender = createResendAuthEmailSender(
        "re_test",
        "onboarding@resend.dev",
      );

      await sender.sendVerificationEmail({
        email: "raka@example.com",
        name: "Raka",
        url: "https://app.test/api/auth/verify-email?token=abc",
      });

      expect(send).toHaveBeenCalledTimes(1);
      const payload = send.mock.calls[0]?.[0] as {
        from: string;
        to: string;
        subject: string;
        html: string;
      };
      expect(payload.from).toBe("onboarding@resend.dev");
      expect(payload.to).toBe("raka@example.com");
      expect(payload.html).toContain(
        "https://app.test/api/auth/verify-email?token=abc",
      );
    });

    it("throws kalau Resend mengembalikan error", async () => {
      send.mockResolvedValueOnce({ error: { message: "invalid from" } });
      const sender = createResendAuthEmailSender(
        "re_test",
        "onboarding@resend.dev",
      );

      await expect(
        sender.sendVerificationEmail({
          email: "raka@example.com",
          name: "Raka",
          url: "https://app.test/api/auth/verify-email?token=abc",
        }),
      ).rejects.toThrow(/invalid from/);
    });
  });
});
