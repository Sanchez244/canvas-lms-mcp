import { config as loadEnv } from "dotenv";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// .env lives at the repo root, one level above src/ (or dist/). Loading it relative to
// this file means the server works no matter which cwd Claude Code launches it from.
// quiet: true is essential — dotenv would otherwise print to stdout and corrupt the
// MCP stdio stream.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadEnv({ path: path.join(repoRoot, ".env"), quiet: true });

function expandHome(p: string): string {
  return p.startsWith("~") ? path.join(os.homedir(), p.slice(1)) : p;
}

/**
 * How requests to Canvas are authenticated.
 * - "token": this process sends `Authorization: Bearer CANVAS_TOKEN` (the default, local use).
 * - "gateway": an outbound proxy injects the header; this process holds no
 *   token and sends no Authorization header at all.
 */
export type AuthMode = "token" | "gateway";

export interface Config {
  baseUrl: string;
  auth: AuthMode;
  /** Empty in gateway mode. */
  token: string;
  downloadDir: string;
  /** When true the write tool (submit_assignment_file) is never registered. */
  readOnly: boolean;
  /** Hard cap on items returned by any paginated list call. */
  maxItems: number;
}

function isTruthy(value: string | undefined): boolean {
  return value === "1" || value?.toLowerCase() === "true";
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const auth = env.CANVAS_AUTH ?? "token";
  if (auth !== "token" && auth !== "gateway") {
    throw new Error(`CANVAS_AUTH must be "token" or "gateway", got "${auth}"`);
  }
  return {
    baseUrl: (env.CANVAS_BASE_URL ?? "").replace(/\/+$/, ""),
    auth,
    token: auth === "gateway" ? "" : (env.CANVAS_TOKEN ?? ""),
    downloadDir: path.resolve(expandHome(env.CANVAS_DOWNLOAD_DIR ?? "~/Canvas")),
    readOnly: isTruthy(env.CANVAS_READ_ONLY),
    maxItems: 500,
  };
}
