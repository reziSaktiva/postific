import { describe, expect, it } from "vitest";
import {
  MCP_AUDIT_SUMMARY_MAX_LENGTH,
  redactUrl,
  summarizeToolInput,
} from "./audit-summary";

describe("summarizeToolInput", () => {
  it("returns null for missing, non-object, array, or empty input", () => {
    expect(summarizeToolInput(undefined)).toBeNull();
    expect(summarizeToolInput(null)).toBeNull();
    expect(summarizeToolInput("caption")).toBeNull();
    expect(summarizeToolInput(["a"])).toBeNull();
    expect(summarizeToolInput({})).toBeNull();
    expect(summarizeToolInput({ skipped: undefined })).toBeNull();
  });

  it("never records the full caption, whatever its length", () => {
    const longCaption = "Rahasia kampanye peluncuran produk baru ".repeat(10);
    const shortCaption = "Halo dunia";

    const long = summarizeToolInput({ caption: longCaption });
    const short = summarizeToolInput({ caption: shortCaption });

    expect(long).toBe(`caption=[teks ${longCaption.length} karakter]`);
    expect(short).toBe("caption=[teks 10 karakter]");
    expect(long).not.toContain("Rahasia");
    expect(short).not.toContain("Halo");
  });

  it("masks other free-text keys case- and separator-insensitively", () => {
    const summary = summarizeToolInput({
      Message: "isi pesan",
      reply: "balasan",
      comment: "komentar pengguna",
    });

    expect(summary).not.toContain("isi pesan");
    expect(summary).not.toContain("komentar pengguna");
    expect(summary).toContain("Message=[teks 9 karakter]");
    expect(summary).toContain("comment=[teks 17 karakter]");
    expect(summary).toContain("reply=[teks 7 karakter]");
  });

  it("masks long strings under unexpected keys as a safety net", () => {
    const longValue = "x".repeat(41);
    expect(summarizeToolInput({ whatever: longValue })).toBe(
      "whatever=[teks 41 karakter]",
    );
    expect(summarizeToolInput({ whatever: "x".repeat(40) })).toBe(
      `whatever="${"x".repeat(40)}"`,
    );
  });

  it("drops query string, fragment, and user info from URLs", () => {
    const summary = summarizeToolInput({
      url: "https://user:pass@cdn.example.com/media/a.jpg?X-Amz-Signature=abc123&token=secret#frag",
    });

    expect(summary).toBe(
      "url=https://cdn.example.com/media/a.jpg?[disamarkan]",
    );
    expect(summary).not.toContain("abc123");
    expect(summary).not.toContain("secret");
    expect(summary).not.toContain("user:pass");
  });

  it("drops user info from non-http(s) URLs", () => {
    const summary = summarizeToolInput({
      target: "ftp://user:pass@h/f",
      cache: "redis://:s3cr3t@cache.local:6379/0",
    });

    expect(summary).toBe("cache=redis://cache.local:6379/0, target=ftp://h/f");
    expect(summary).not.toContain("user");
    expect(summary).not.toContain("pass");
    expect(summary).not.toContain("s3cr3t");
  });

  it("redacts a non-http(s) URL with credentials embedded in a short string", () => {
    const summary = summarizeToolInput({ ref: "at ftp://u:p@h/f?x=1" });
    expect(summary).toBe('ref="at ftp://h/f?[disamarkan]"');
  });

  it("keeps a plain URL without parameters", () => {
    expect(summarizeToolInput({ url: "https://cdn.example.com/a.jpg" })).toBe(
      "url=https://cdn.example.com/a.jpg",
    );
  });

  it("redacts a URL embedded in a short string", () => {
    const summary = summarizeToolInput({ ref: "see http://a.co/?k=v" });
    expect(summary).not.toContain("k=v");
    expect(summary).toContain("http://a.co/?[disamarkan]");
  });

  it("masks values of sensitive keys whatever their type", () => {
    const summary = summarizeToolInput({
      accessToken: "abc",
      api_key: 12345,
      Authorization: "Bearer xyz",
      clientSecret: { a: 1 },
    });

    expect(summary).toBe(
      "Authorization=[disamarkan], accessToken=[disamarkan], api_key=[disamarkan], clientSecret=[disamarkan]",
    );
  });

  it("masks short values under key/auth/session/jwt/bearer style keys", () => {
    const summary = summarizeToolInput({
      accessKey: "AKIA1",
      privateKey: "pk",
      key: "k1",
      secret_key: "sk",
      session: "s1",
      sessionId: "s2",
      jwt: "a.b.c",
      bearer: "b1",
      auth: "x",
      oauthCode: "c1",
    });

    expect(summary).toBe(
      [
        "accessKey=[disamarkan]",
        "auth=[disamarkan]",
        "bearer=[disamarkan]",
        "jwt=[disamarkan]",
        "key=[disamarkan]",
        "oauthCode=[disamarkan]",
        "privateKey=[disamarkan]",
        "secret_key=[disamarkan]",
        "session=[disamarkan]",
        "sessionId=[disamarkan]",
      ].join(", "),
    );
    for (const leaked of ["AKIA1", "pk", "k1", "a.b.c", "b1", "c1"]) {
      expect(summary).not.toContain(`"${leaked}"`);
    }
  });

  it("keeps ordinary MVP tool argument names intact (no over-masking)", () => {
    const summary = summarizeToolInput({
      workspaceId: "ws-1",
      postId: "p-1",
      cursor: "c-2",
      limit: 10,
      platform: "instagram",
      author: "maya",
      authorId: "u-1",
      keyword: "diskon",
      status: "draft",
    });

    expect(summary).toBe(
      [
        'author="maya"',
        'authorId="u-1"',
        'cursor="c-2"',
        'keyword="diskon"',
        "limit=10",
        'platform="instagram"',
        'postId="p-1"',
        'status="draft"',
        'workspaceId="ws-1"',
      ].join(", "),
    );
  });

  it("records only the shape of arrays and nested objects", () => {
    const summary = summarizeToolInput({
      accountIds: ["a", "b", "c"],
      platformOptions: { instagram: { caption: "rahasia" } },
    });

    expect(summary).toBe("accountIds=[3 item], platformOptions={1 kunci}");
    expect(summary).not.toContain("rahasia");
  });

  it("records numbers and booleans and sorts keys deterministically", () => {
    expect(
      summarizeToolInput({ limit: 20, includeMedia: true, cursor: null }),
    ).toBe("cursor=null, includeMedia=true, limit=20");
    expect(summarizeToolInput({ n: Number.NaN })).toBe("n=[angka]");
  });

  it("escapes control characters in short strings", () => {
    expect(summarizeToolInput({ format: "a\nb" })).toBe('format="a\\nb"');
  });

  it("truncates the whole summary to the maximum length", () => {
    const input = Object.fromEntries(
      Array.from({ length: 60 }, (_, i) => [`key${i}`, i]),
    );
    const summary = summarizeToolInput(input);
    expect(summary).not.toBeNull();
    expect(summary!.length).toBe(MCP_AUDIT_SUMMARY_MAX_LENGTH);
    expect(summary!.endsWith("…")).toBe(true);
  });
});

describe("redactUrl", () => {
  it("strips parameters and returns [url] for non-URLs", () => {
    expect(redactUrl("https://a.com/p?q=1")).toBe(
      "https://a.com/p?[disamarkan]",
    );
    expect(redactUrl("ftp://user:pass@h/f")).toBe("ftp://h/f");
    expect(redactUrl("not a url")).toBe("[url]");
    expect(redactUrl("javascript:alert(1)")).toBe("[url]");
  });
});
