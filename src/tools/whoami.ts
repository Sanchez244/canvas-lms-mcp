import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CanvasClient } from "../canvas/client.js";
import { jsonResult } from "./result.js";

interface CanvasUser {
  id: number;
  name: string;
  short_name: string;
  login_id?: string;
  primary_email?: string;
}

export function registerWhoami(server: McpServer, canvas: CanvasClient): void {
  server.registerTool(
    "whoami",
    {
      title: "Who am I",
      description: "Return the Canvas user the configured token belongs to. Use it to verify the connection.",
      inputSchema: {},
    },
    async () => {
      const user = await canvas.get<CanvasUser>("/users/self");
      return jsonResult({ id: user.id, name: user.name, login_id: user.login_id, email: user.primary_email });
    },
  );
}
