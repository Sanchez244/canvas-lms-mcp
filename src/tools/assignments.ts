import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { CanvasClient } from "../canvas/client.js";
import { formatDate, htmlToText } from "../canvas/text.js";
import type { Assignment, Submission } from "../canvas/types.js";
import { jsonResult } from "./result.js";

const BUCKETS = ["upcoming", "overdue", "unsubmitted", "past", "undated", "all"] as const;

export function summariseSubmission(s: Submission | undefined) {
  if (!s) return null;
  return {
    state: s.workflow_state,
    submitted_at: formatDate(s.submitted_at)?.human ?? null,
    score: s.score,
    grade: s.grade,
    late: s.late,
    missing: s.missing,
  };
}

export function summariseAssignment(a: Assignment) {
  return {
    id: a.id,
    course_id: a.course_id,
    name: a.name,
    due: formatDate(a.due_at),
    points: a.points_possible,
    submission_types: a.submission_types,
    quiz: a.is_quiz_assignment ?? false,
    submission: summariseSubmission(a.submission),
    url: a.html_url,
  };
}

export function assignmentDetail(a: Assignment) {
  return {
    ...summariseAssignment(a),
    unlock_at: formatDate(a.unlock_at)?.human ?? null,
    lock_at: formatDate(a.lock_at)?.human ?? null,
    allowed_extensions: a.allowed_extensions ?? [],
    description: htmlToText(a.description) || null,
    rubric: (a.rubric ?? []).map((c) => ({
      criterion: c.description,
      details: c.long_description ? htmlToText(c.long_description) : null,
      points: c.points,
      ratings: (c.ratings ?? []).map((r) => `${r.points}: ${r.description}`),
    })),
  };
}

export function registerAssignments(server: McpServer, canvas: CanvasClient): void {
  server.registerTool(
    "list_assignments",
    {
      title: "List assignments",
      description:
        "Assignments in one course with due dates and the user's submission status. bucket filters: upcoming (default), overdue, unsubmitted, past, undated, all.",
      inputSchema: {
        course_id: z.number().int().describe("Course id from list_courses"),
        bucket: z.enum(BUCKETS).optional().describe("Which assignments to include (default upcoming)"),
      },
    },
    async ({ course_id, bucket = "upcoming" }) => {
      const assignments = await canvas.getAll<Assignment>(`/courses/${course_id}/assignments`, {
        bucket: bucket === "all" ? undefined : bucket,
        include: ["submission"],
        order_by: "due_at",
      });
      return jsonResult(assignments.map(summariseAssignment));
    },
  );

  server.registerTool(
    "get_assignment",
    {
      title: "Get assignment",
      description:
        "Full assignment detail: description as plain text, rubric, submission types, allowed file extensions, and the user's submission.",
      inputSchema: {
        course_id: z.number().int(),
        assignment_id: z.number().int().describe("Assignment id from list_assignments or list_upcoming"),
      },
    },
    async ({ course_id, assignment_id }) => {
      const assignment = await canvas.get<Assignment>(`/courses/${course_id}/assignments/${assignment_id}`, {
        include: ["submission"],
      });
      return jsonResult(assignmentDetail(assignment));
    },
  );
}
