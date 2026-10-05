import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { readConfig } from "../src/config.js";
import { buildServer } from "../src/server.js";

const READ_TOOLS = [
  "download_file",
  "get_assignment",
  "get_course",
  "get_page",
  "list_assignments",
  "list_courses",
  "list_files",
  "list_modules",
  "list_upcoming",
  "read_document",
  "whoami",
];

/** Connect a real MCP client over an in-memory pipe and read the advertised tool names. */
async function advertisedTools(env: NodeJS.ProcessEnv): Promise<string[]> {
  const server = buildServer(readConfig(env));
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  const client = new Client({ name: "test", version: "0.0.0" });
  await client.connect(clientSide);
  try {
    const { tools } = await client.listTools();
    return tools.map((t) => t.name).sort();
  } finally {
    await client.close();
    await server.close();
  }
}

describe("buildServer", () => {
  it("advertises every tool including submit_assignment_file by default", async () => {
    expect(await advertisedTools({ CANVAS_TOKEN: "tok" })).toEqual([...READ_TOOLS, "submit_assignment_file"].sort());
  });

  it("never registers submit_assignment_file when read-only", async () => {
    expect(await advertisedTools({ CANVAS_TOKEN: "tok", CANVAS_READ_ONLY: "1" })).toEqual(READ_TOOLS);
  });

  it("builds in gateway mode with no token and stays read-only when asked", async () => {
    expect(await advertisedTools({ CANVAS_AUTH: "gateway", CANVAS_READ_ONLY: "true" })).toEqual(READ_TOOLS);
  });
});
