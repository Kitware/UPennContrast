/**
 * Return to an in-app route after logging in.
 *
 * A page that needs a logged-in user (the MCP OAuth consent page) saves its
 * route here and sends the user to the root page, whose login dialog handles
 * both password and Outseta login. Outseta leaves the app and comes back to
 * the root in the same tab, so the target lives in sessionStorage. After
 * login, UserMenu takes it and navigates there.
 *
 * Only in-app router paths are accepted ("/oauth/consent?request=..."),
 * never a URL: anything else, or anything older than MAX_AGE_MS, is dropped
 * so a stale or planted value cannot redirect a later login.
 */

const STORAGE_KEY = "nimbus.returnTo";
export const MAX_AGE_MS = 15 * 60 * 1000;

export function isInAppPath(path: unknown): path is string {
  return (
    typeof path === "string" &&
    path.length > 1 &&
    path.length <= 2048 &&
    path.startsWith("/") &&
    !path.startsWith("//") &&
    !/[\\:\s]/.test(path)
  );
}

export function saveReturnTo(path: string): void {
  if (!isInAppPath(path)) return;
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ path, savedAt: Date.now() }),
    );
  } catch {
    // Storage blocked: the user lands on the root page after login.
  }
}

function read(): string | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const { path, savedAt } = JSON.parse(raw);
    const age = Date.now() - savedAt;
    if (!isInAppPath(path) || !(age >= 0 && age <= MAX_AGE_MS)) return null;
    return path;
  } catch {
    return null;
  }
}

/** Whether a valid return target is waiting. */
export function hasReturnTo(): boolean {
  return read() !== null;
}

/** The waiting return target, removed so it is used once. */
export function takeReturnTo(): string | null {
  const path = read();
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // nothing to clean up
  }
  return path;
}
