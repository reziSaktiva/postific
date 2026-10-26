import { describe, expect, it } from "vitest";
import { isLikelyBot } from "./bot-detection";

describe("isLikelyBot", () => {
  it.each([
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36 Instagram 330.0",
  ])("treats a normal browser as human", (ua) => {
    expect(isLikelyBot(ua)).toBe(false);
  });

  it.each([
    "Googlebot/2.1 (+http://www.google.com/bot.html)",
    "facebookexternalhit/1.1",
    "Slackbot-LinkExpanding 1.0",
    "WhatsApp/2.23.20",
    "curl/8.4.0",
    "python-requests/2.31",
    "HeadlessChrome/126",
    "Mozilla/5.0 (compatible; bingbot/2.0)",
    "",
    "   ",
    null,
    undefined,
  ])("treats %j as bot", (ua) => {
    expect(isLikelyBot(ua)).toBe(true);
  });
});
