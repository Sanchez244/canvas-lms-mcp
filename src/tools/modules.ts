import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { CanvasClient } from "../canvas/client.js";
import { formatDate, htmlToText } from "../canvas/text.js";
import type { Module, ModuleItem, Page } from "../canvas/types.js";
import { jsonResult } from "./result.js";

function summariseItem(item: ModuleItem) {
  return {
    id: item.id,
    title: item.title,
    type: item.type,
    // What to pass to the next tool: file_id for download_file, page_url for get_page,
    // content_id (assignment id) for get_assignment.
    file_id: item.type === "File" ? item.content_id : undefined,
    page_url: item.type === "Page" ? item.page_url : undefined,
    content_id: item.type === "Assignment" || item.type === "Quiz" || item.type === "Discussion" ? item.content_id : undefined,
    external_url: item.external_url,
    url: item.html_url,
    completed: item.completion_requirement?.completed,
  };
}

export function registerModules(server: McpServer, canvas: CanvasClient): void {
  server.registerTool(
    "list_modules",
    {
      title: "List modules",
      description:
        "Course modules in order with their items (files, pages, assignments, links). Item file_id feeds download_file; page_url feeds get_page.",
      inputSchema: { course_id: z.number().int().describe("Course id from list_courses") },
    },
    async ({ course_id }) => {
      const modules = await canvas.getAll<Module>(`/courses/${course_id}/modules`, { include: ["items"] });
      return jsonResult(
        modules.map((m) => ({
          id: m.id,
          name: m.name,
          state: m.state ?? null,
          unlock_at: formatDate(m.unlock_at)?.human ?? null,
          items: (m.items ?? []).map(summariseItem),
        })),
      );
    },
  );

  server.registerTool(
    "get_page",
    {
      title: "Get page",
      description: "A course wiki page (module text page, course info, schedule) as plain text.",
      inputSchema: {
        course_id: z.number().int(),
        page_url: z.string().describe("Page url slug from list_modules, e.g. 'week-1-overview'"),
      },
    },
    async ({ course_id, page_url }) => {
      const page = await canvas.get<Page>(`/courses/${course_id}/pages/${encodeURIComponent(page_url)}`);
      return jsonResult({
        title: page.title,
        url: page.url,
        updated_at: formatDate(page.updated_at)?.human ?? null,
        body: htmlToText(page.body) || null,
      });
    },
  );
}
