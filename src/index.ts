#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readConfig, type Config } from "./config.js";
import { buildServer } from "./server.js";

// stdout is the MCP transport. Anything else goes to stderr.
const log = (msg: string) => process.stderr.write(`[canvas-mcp] ${msg}\n`);

let config: Config;
try {
  config = readConfig();
} catch (err) {
  log(err instanceof Error ? err.message : String(err));
  process.exit(1);
}

if (!config.baseUrl) {
  log("CANVAS_BASE_URL is not set. Copy .env.example to .env and set it to your Canvas host, e.g. https://canvas.yourschool.edu");
  process.exit(1);
}
if (config.auth === "token" && !config.token) {
  log("CANVAS_TOKEN is not set. Copy .env.example to .env and paste a token from Canvas > Account > Settings.");
  process.exit(1);
}
if (config.auth === "gateway") {
  // Presence only — the proxy URL is never logged.
  log(`auth=gateway proxy=${process.env.HTTPS_PROXY ? "set" : "MISSING"}`);
}
if (config.readOnly) log("read-only: submit_assignment_file not registered");

const server = buildServer(config);
await server.connect(new StdioServerTransport());
log(`connected to ${config.baseUrl}`);
