import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { CanvasClient } from "../canvas/client.js";
import { formatDate } from "../canvas/text.js";
import type { PlannerItem } from "../canvas/types.js";
import { jsonResult } from "./result.js";

export interface UpcomingItem {
  course: string | null;
  course_id: number | null;
  title: string;
  type: string;
  due: { iso: string; human: string } | null;
  points: number | null;
  status: "submitted" | "graded" | "missing" | "late" | "excused" | "todo";
  url: string | null;
  plannable_id: number;
}

function status(item: PlannerItem): UpcomingItem["status"] {
  const s = item.submissions;
  if (!s) return "todo";
  if (s.excused) return "excused";
  if (s.graded) return "graded";
  if (s.submitted) return s.late ? "late" : "submitted";
  if (s.missing) return "missing";
  return "todo";
}

/** Flatten planner items into what Claude needs, sorted by date. Announcements are dropped. */
export function summariseUpcoming(items: PlannerItem[], baseUrl: string): UpcomingItem[] {
  return items
    .filter((item) => item.plannable_type !== "announcement")
    .map((item) => ({
      course: item.context_name ?? null,
      course_id: item.course_id ?? null,
      title: item.plannable.title,
      type: item.plannable_type,
      due: formatDate(item.plannable.due_at ?? item.plannable.todo_date ?? item.plannable_date),
      points: item.plannable.points_possible ?? null,
      status: status(item),
      url: item.html_url ? new URL(item.html_url, baseUrl).toString() : null,
      plannable_id: item.plannable_id,
    }))
    .sort((a, b) => (a.due?.iso ?? "").localeCompare(b.due?.iso ?? ""));
}

export function registerPlanner(server: McpServer, canvas: CanvasClient, baseUrl: string): void {
  server.registerTool(
    "list_upcoming",
    {
      title: "List upcoming work",
      description:
        "Everything due across all courses in the next N days (assignments, quizzes, discussions, events), from the Canvas planner. Sorted by due date with submission status. Start here for 'what's due this week'.",
      inputSchema: {
        days: z.number().int().min(1).max(60).optional().describe("Look-ahead window in days (default 7)"),
        include_past_days: z.number().int().min(0).max(60).optional().describe("Also look back this many days (default 0)"),
      },
    },
    async ({ days = 7, include_past_days = 0 }) => {
      const now = new Date();
      const start = new Date(now.getTime() - include_past_days * 86_400_000);
      const end = new Date(now.getTime() + days * 86_400_000);
      const items = await canvas.getAll<PlannerItem>("/planner/items", {
        start_date: start.toISOString(),
        end_date: end.toISOString(),
      });
      return jsonResult(summariseUpcoming(items, baseUrl));
    },
  );
}
