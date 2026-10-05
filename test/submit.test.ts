import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CanvasClient } from "../src/canvas/client.js";
import type { Assignment } from "../src/canvas/types.js";
import { buildPreview, performSubmission } from "../src/tools/submit.js";

const assignment: Assignment = {
  id: 5001,
  course_id: 101,
  name: "Problem Set 2",
  description: null,
  due_at: "2099-01-01T00:00:00Z",
  unlock_at: null,
  lock_at: null,
  points_possible: 100,
  submission_types: ["online_upload"],
  allowed_extensions: ["pdf"],
  html_url: "https://canvas.example/courses/101/assignments/5001",
};

let dir: string;
let pdfPath: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "canvas-mcp-submit-"));
  pdfPath = path.join(dir, "answers.pdf");
  await writeFile(pdfPath, "%PDF-1.4 fake");
});
afterEach(async () => {
  vi.unstubAllGlobals();
  await rm(dir, { recursive: true, force: true });
});

describe("buildPreview", () => {
  it("passes a valid file with no problems", async () => {
    const preview = await buildPreview(assignment, pdfPath);
    expect(preview.problems).toEqual([]);
    expect(preview.warnings).toEqual([]);
    expect(preview.file).toEqual({ name: "answers.pdf", size_kb: 0, extension: "pdf" });
  });

  it("reports missing file, wrong extension, wrong type and lock", async () => {
    const preview = await buildPreview(
      { ...assignment, submission_types: ["online_text_entry"], lock_at: "2000-01-01T00:00:00Z" },
      path.join(dir, "missing.docx"),
    );
    expect(preview.problems).toHaveLength(4);
    expect(preview.problems.join("\n")).toMatch(/not found/);
    expect(preview.problems.join("\n")).toMatch(/\.docx not allowed/);
    expect(preview.problems.join("\n")).toMatch(/does not accept file uploads/);
    expect(preview.problems.join("\n")).toMatch(/locked/);
  });

  it("warns on past due and prior submission", async () => {
    const preview = await buildPreview(
      {
        ...assignment,
        due_at: "2000-01-01T00:00:00Z",
        submission: { workflow_state: "submitted", submitted_at: "2000-01-01T00:00:00Z", score: null, grade: null, late: false, missing: false },
      },
      pdfPath,
    );
    expect(preview.problems).toEqual([]);
    expect(preview.warnings).toHaveLength(2);
  });
});

describe("performSubmission", () => {
  it("runs the three-step upload and attaches the file id", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ upload_url: "https://s3.example/bucket", upload_params: { key: "k", policy: "p" } }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 999, display_name: "answers.pdf" }), { status: 201 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 1, workflow_state: "submitted", submitted_at: "2026-09-11T20:00:00Z", late: false }), { status: 201 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const canvas = new CanvasClient("https://canvas.example", "tok");

    const submission = await performSubmission(canvas, 101, 5001, pdfPath);

    expect(submission.workflow_state).toBe("submitted");
    const calls = fetchMock.mock.calls as [string, RequestInit][];
    expect(calls.map(([url]) => url)).toEqual([
      "https://canvas.example/api/v1/courses/101/assignments/5001/submissions/self/files",
      "https://s3.example/bucket",
      "https://canvas.example/api/v1/courses/101/assignments/5001/submissions",
    ]);
    expect(JSON.parse(calls[0]![1].body as string)).toEqual({ name: "answers.pdf", size: 13 });
    // Step 2 carries the upload params and the file, and no bearer token.
    const form = calls[1]![1].body as FormData;
    expect(form.get("key")).toBe("k");
    expect((form.get("file") as File).name).toBe("answers.pdf");
    expect(calls[1]![1].headers).toBeUndefined();
    expect(JSON.parse(calls[2]![1].body as string)).toEqual({
      submission: { submission_type: "online_upload", file_ids: [999] },
    });
  });
});
