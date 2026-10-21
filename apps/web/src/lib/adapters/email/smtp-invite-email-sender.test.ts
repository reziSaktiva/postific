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

import { createSmtpInviteEmailSender } from "./smtp-invite-email-sender";

describe("createSmtpInviteEmailSender", () => {
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

  describe("sendInviteVerificationCode", () => {
    it("mengirim kode verifikasi ke email dengan subject berisi nama workspace", async () => {
      const sender = createSmtpInviteEmailSender(config);

      await sender.sendInviteVerificationCode({
        email: "maya@example.com",
        code: "123456",
        workspaceName: "Kopi Selasar",
      });

      expect(sendMail).toHaveBeenCalledTimes(1);
      const payload = sendMail.mock.calls[0]?.[0] as {
        from: string;
        to: string;
        subject: string;
        html: string;
      };
      expect(payload.from).toBe("rezi@insvire.com");
      expect(payload.to).toBe("maya@example.com");
      expect(payload.subject).toContain("Kopi Selasar");
      expect(payload.html).toContain("123456");
    });

    it("throws kalau transport SMTP gagal mengirim", async () => {
      sendMail.mockRejectedValueOnce(new Error("connection refused"));
      const sender = createSmtpInviteEmailSender(config);

      await expect(
        sender.sendInviteVerificationCode({
          email: "maya@example.com",
          code: "123456",
          workspaceName: "Kopi Selasar",
        }),
      ).rejects.toThrow(/connection refused/);
    });
  });

  describe("sendMemberInvitation", () => {
    it("escapes workspace, inviter, role, and the invite link in the html", async () => {
      const sender = createSmtpInviteEmailSender(config);

      await sender.sendMemberInvitation({
        email: "maya@example.com",
        inviteLink: 'https://app.test/invite/abc?x=1&y="2"',
        workspaceName: 'Kopi <Selasar> & "Raka"',
        roleLabel: "Admin",
        invitedByName: "<Raka>",
      });

      const html = sendMail.mock.calls[0]?.[0]?.html as string;
      expect(html).toContain("Kopi &lt;Selasar&gt; &amp; &quot;Raka&quot;");
      expect(html).toContain("&lt;Raka&gt;");
      expect(html).toContain(
        "https://app.test/invite/abc?x=1&amp;y=&quot;2&quot;",
      );
      expect(html).not.toContain("<script");
      expect(html).not.toContain('y="2"');
    });

    it("throws kalau transport SMTP gagal mengirim", async () => {
      sendMail.mockRejectedValueOnce(new Error("mailbox unavailable"));
      const sender = createSmtpInviteEmailSender(config);

      await expect(
        sender.sendMemberInvitation({
          email: "maya@example.com",
          inviteLink: "https://app.test/invite/abc",
          workspaceName: "Kopi Selasar",
          roleLabel: "Admin",
          invitedByName: "Raka",
        }),
      ).rejects.toThrow(/mailbox unavailable/);
    });
  });
});
