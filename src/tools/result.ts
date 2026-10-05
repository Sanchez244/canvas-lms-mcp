import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/** Every tool returns compact JSON as text so Claude can read it directly. */
export function jsonResult(data: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 1) }] };
}

export function errorResult(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}
