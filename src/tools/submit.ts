import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { openAsBlob } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { CanvasClient } from "../canvas/client.js";
import { formatDate } from "../canvas/text.js";
import type { Assignment, Submission } from "../canvas/types.js";
import { errorResult, jsonResult } from "./result.js";

const MAX_BYTES = 500 * 1024 * 1024;

export interface SubmitPreview {
  assignment: { id: number; name: string; due: string | null; url: string };
  file: { name: string; size_kb: number; extension: string };
  problems: string[];
  warnings: string[];
}

/** Everything that can be checked before touching Canvas. No side effects. */
export async function buildPreview(assignment: Assignment, filePath: string): Promise<SubmitPreview> {
  const problems: string[] = [];
  const warnings: string[] = [];
  const name = path.basename(filePath);
  const extension = path.extname(name).slice(1).toLowerCase();
  const info = await stat(filePath).catch(() => null);

  if (!info?.isFile()) problems.push(`File not found: ${filePath}`);
  else if (info.size > MAX_BYTES) problems.push(`File is ${Math.round(info.size / 1048576)} MB; limit is 500 MB`);
  if (!assignment.submission_types.includes("online_upload")) {
    problems.push(`Assignment does not accept file uploads (accepts: ${assignment.submission_types.join(", ") || "none"})`);
  }
  const allowed = (assignment.allowed_extensions ?? []).map((e) => e.toLowerCase());
  if (allowed.length && !allowed.includes(extension)) {
    problems.push(`Extension .${extension} not allowed (allowed: ${allowed.join(", ")})`);
  }
  const now = Date.now();
  if (assignment.lock_at && new Date(assignment.lock_at).getTime() < now) problems.push("Assignment is locked (past lock date)");
  if (assignment.due_at && new Date(assignment.due_at).getTime() < now) warnings.push("Past due: submission will be marked late");
  if (assignment.submission?.submitted_at) {
    warnings.push(`Already submitted on ${formatDate(assignment.submission.submitted_at)?.human}; this will add a new attempt`);
  }

  return {
    assignment: { id: assignment.id, name: assignment.name, due: formatDate(assignment.due_at)?.human ?? null, url: assignment.html_url },
    file: { name, size_kb: Math.round((info?.size ?? 0) / 1024), extension },
    problems,
    warnings,
  };
}

interface UploadTicket {
  upload_url: string;
  upload_params: Record<string, string>;
}

/** Canvas three-step file upload, then create the submission. Only called after confirm. */
export async function performSubmission(
  canvas: CanvasClient,
  courseId: number,
  assignmentId: number,
  filePath: string,
): Promise<Submission> {
  const base = `/courses/${courseId}/assignments/${assignmentId}/submissions`;
  const name = path.basename(filePath);
  const { size } = await stat(filePath);

  // 1. Ask Canvas where to upload.
  const ticket = await canvas.postJson<UploadTicket>(`${base}/self/files`, { name, size });

  // 2. Multipart POST to that url (S3 or Canvas). No bearer token here. Canvas answers with
  //    the file JSON, possibly after a redirect that fetch follows automatically.
  const form = new FormData();
  for (const [key, value] of Object.entries(ticket.upload_params)) form.append(key, value);
  form.append("file", await openAsBlob(filePath), name);
  const uploadRes = await fetch(ticket.upload_url, { method: "POST", body: form });
  if (!uploadRes.ok) throw new Error(`Upload failed (${uploadRes.status}): ${(await uploadRes.text()).slice(0, 300)}`);
  const uploaded = (await uploadRes.json()) as { id: number };
  if (!uploaded.id) throw new Error("Upload succeeded but Canvas returned no file id");

  // 3. Attach the uploaded file as the submission.
  return canvas.postJson<Submission>(base, {
    submission: { submission_type: "online_upload", file_ids: [uploaded.id] },
  });
}

export function registerSubmit(server: McpServer, canvas: CanvasClient): void {
  server.registerTool(
    "submit_assignment_file",
    {
      title: "Submit a file to an assignment",
      description:
        "Submit a local file to a Canvas assignment. Without confirm=true this only validates and returns a preview (no changes). Show the preview to the user and call again with confirm=true only after they explicitly agree.",
      inputSchema: {
        course_id: z.number().int(),
        assignment_id: z.number().int(),
        file_path: z.string().describe("Absolute path of the file to submit"),
        confirm: z.boolean().optional().describe("Set true only after the user has approved the preview"),
      },
    },
    async ({ course_id, assignment_id, file_path, confirm }) => {
      const assignment = await canvas.get<Assignment>(`/courses/${course_id}/assignments/${assignment_id}`, {
        include: ["submission"],
      });
      const preview = await buildPreview(assignment, file_path);

      if (preview.problems.length) {
        return errorResult(`Cannot submit:\n- ${preview.problems.join("\n- ")}`);
      }
      if (!confirm) {
        return jsonResult({ action: "preview", ...preview, next: "Ask the user to confirm, then call again with confirm: true" });
      }

      const submission = await performSubmission(canvas, course_id, assignment_id, file_path);
      return jsonResult({
        action: "submitted",
        submission_id: submission.id ?? null,
        submitted_at: formatDate(submission.submitted_at)?.human ?? null,
        late: submission.late,
        state: submission.workflow_state,
        attachments: (submission.attachments ?? []).map((a) => a.display_name),
        url: assignment.html_url,
      });
    },
  );
}
