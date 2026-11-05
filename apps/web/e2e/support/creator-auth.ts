import fs from "node:fs";
import path from "node:path";

import { type Browser, type BrowserContext } from "@playwright/test";

import { CREATOR_AUTH_FILE, creatorCredentials } from "./auth";
import { activateExistingE2eWorkspace } from "./workspace";

/**
 * Konteks browser berisi sesi Creator dengan workspace E2E aktif (T-214).
 * Memakai ulang sesi tersimpan bila masih berlaku (sign-in dibatasi 5
 * permintaan per 60 detik); selain itu login lewat `/login`. Tidak menyentuh
 * sesi Owner dan tidak membuat workspace.
 */
export async function creatorContext(
  browser: Browser,
  baseURL: string | undefined,
): Promise<BrowserContext> {
  const creds = creatorCredentials();
  if (!creds) throw new Error("E2E_CREATOR_EMAIL/PASSWORD tidak diisi");

  if (fs.existsSync(CREATOR_AUTH_FILE)) {
    const saved = await browser.newContext({
      baseURL,
      storageState: CREATOR_AUTH_FILE,
    });
    try {
      const page = await saved.newPage();
      await page.goto("/start-page");
      if (!/\/login/.test(page.url())) {
        await activateExistingE2eWorkspace(page);
        await saved.storageState({ path: CREATOR_AUTH_FILE });
        return saved;
      }
    } catch (error) {
      await saved.close();
      throw error;
    }
    await saved.close();
  }

  const context = await browser.newContext({
    baseURL,
    storageState: { cookies: [], origins: [] },
  });
  try {
    const page = await context.newPage();
    await page.goto("/login");
    await page.getByLabel("Email").fill(creds.email);
    await page.getByLabel("Password").fill(creds.password);
    await page.getByRole("button", { name: "Masuk" }).click();
    // Tunggu redirect login benar-benar mendarat (Home atau pemilih workspace);
    // `goto` yang terlalu cepat beradu dengan redirect itu.
    await page.waitForURL((u) => /^\/(select-workspace)?$/.test(u.pathname), {
      timeout: 60_000,
    });
    await page.waitForLoadState("load");
    await activateExistingE2eWorkspace(page);
    fs.mkdirSync(path.dirname(CREATOR_AUTH_FILE), { recursive: true });
    await context.storageState({ path: CREATOR_AUTH_FILE });
    return context;
  } catch (error) {
    await context.close();
    throw error;
  }
}
