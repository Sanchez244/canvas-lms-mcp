import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { CanvasClient } from "../canvas/client.js";
import { formatDate, htmlToText } from "../canvas/text.js";
import type { Course } from "../canvas/types.js";
import { jsonResult } from "./result.js";

function summarise(course: Course) {
  return {
    id: course.id,
    name: course.name,
    code: course.course_code,
    term: course.term?.name ?? null,
    term_ends: formatDate(course.term?.end_at)?.human ?? null,
  };
}

export function registerCourses(server: McpServer, canvas: CanvasClient): void {
  server.registerTool(
    "list_courses",
    {
      title: "List courses",
      description:
        "List the user's Canvas courses (active enrollments by default). Returns id, name, course code and term. Use the id with the other course tools.",
      inputSchema: {
        include_past: z.boolean().optional().describe("Also include completed/past courses"),
      },
    },
    async ({ include_past }) => {
      const courses = await canvas.getAll<Course>("/courses", {
        enrollment_state: include_past ? undefined : "active",
        include: ["term"],
        state: include_past ? ["available", "completed"] : ["available"],
      });
      return jsonResult(courses.map(summarise));
    },
  );

  server.registerTool(
    "get_course",
    {
      title: "Get course with syllabus",
      description: "Course details plus its syllabus as plain text.",
      inputSchema: { course_id: z.number().int().describe("Course id from list_courses") },
    },
    async ({ course_id }) => {
      const course = await canvas.get<Course>(`/courses/${course_id}`, { include: ["term", "syllabus_body"] });
      return jsonResult({ ...summarise(course), syllabus: htmlToText(course.syllabus_body) || null });
    },
  );
}
