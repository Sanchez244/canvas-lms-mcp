import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CanvasClient } from "./canvas/client.js";
import type { Config } from "./config.js";
import { registerAssignments } from "./tools/assignments.js";
import { registerCourses } from "./tools/courses.js";
import { registerDocuments } from "./tools/documents.js";
import { registerFiles } from "./tools/files.js";
import { registerModules } from "./tools/modules.js";
import { registerPlanner } from "./tools/planner.js";
import { registerSubmit } from "./tools/submit.js";
import { registerWhoami } from "./tools/whoami.js";

/** Assemble the MCP server for a config. Pure: no transport, no process access. */
export function buildServer(config: Config): McpServer {
  const token = config.auth === "gateway" ? null : config.token;
  const canvas = new CanvasClient(config.baseUrl, token, config.maxItems);
  const server = new McpServer({ name: "canvas-mcp", version: "0.1.0" });

  registerWhoami(server, canvas);
  registerCourses(server, canvas);
  registerPlanner(server, canvas, config.baseUrl);
  registerAssignments(server, canvas);
  registerModules(server, canvas);
  registerFiles(server, canvas, config.downloadDir);
  registerDocuments(server);
  // Read-only deployments never learn the write tool exists.
  if (!config.readOnly) registerSubmit(server, canvas);

  return server;
}
