import { beforeEach, describe, expect, it, vi } from "vitest";

const { send } = vi.hoisted(() => ({
  send: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));

import { createResendInviteEmailSender } from "./resend-invite-email-sender";

describe("createResendInviteEmailSender.sendMemberInvitation", () => {
  beforeEach(() => {
    send.mockReset();
    send.mockResolvedValue({ error: null });
  });

  it("escapes workspace, inviter, role, and the invite link in the html", async () => {
    const sender = createResendInviteEmailSender(
      "re_test",
      "onboarding@resend.dev",
    );

    await sender.sendMemberInvitation({
      email: "maya@example.com",
      inviteLink: 'https://app.test/invite/abc?x=1&y="2"',
      workspaceName: 'Kopi <Selasar> & "Raka"',
      roleLabel: "Admin",
      invitedByName: "<Raka>",
    });

    const html = send.mock.calls[0]?.[0]?.html as string;
    expect(html).toContain("Kopi &lt;Selasar&gt; &amp; &quot;Raka&quot;");
    expect(html).toContain("&lt;Raka&gt;");
    expect(html).toContain(
      "https://app.test/invite/abc?x=1&amp;y=&quot;2&quot;",
    );
    expect(html).not.toContain("<script");
    expect(html).not.toContain('y="2"');
  });
});

describe("createResendInviteEmailSender.sendInviteVerificationCode", () => {
  beforeEach(() => {
    send.mockReset();
    send.mockResolvedValue({ error: null });
  });

  it("escapes workspace name and code in the html (KI-098, T-138)", async () => {
    const sender = createResendInviteEmailSender(
      "re_test",
      "onboarding@resend.dev",
    );

    await sender.sendInviteVerificationCode({
      email: "maya@example.com",
      code: '<script>123</script>&"456"',
      workspaceName: 'Kopi <Selasar> & "Raka"',
    });

    const html = send.mock.calls[0]?.[0]?.html as string;
    expect(html).toContain("Kopi &lt;Selasar&gt; &amp; &quot;Raka&quot;");
    expect(html).toContain(
      "&lt;script&gt;123&lt;/script&gt;&amp;&quot;456&quot;",
    );
    expect(html).not.toContain("<script>");
    expect(html).not.toContain('"456"');
  });
});
