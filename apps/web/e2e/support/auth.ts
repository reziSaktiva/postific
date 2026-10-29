import path from "node:path";

/** Sesi login tersimpan; folder `e2e/.auth/` di-gitignore. */
export const AUTH_FILE = path.join(__dirname, "..", ".auth", "user.json");
