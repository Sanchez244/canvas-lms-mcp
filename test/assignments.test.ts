import { describe, expect, it } from "vitest";
import type { Assignment } from "../src/canvas/types.js";
import { assignmentDetail, summariseAssignment } from "../src/tools/assignments.js";

const base: Assignment = {
  id: 5001,
  course_id: 101,
  name: "Problem Set 2",
  description: "<p>Answer <b>all</b> questions. Template: <a href=\"https://x.io/t.docx\">here</a></p>",
  due_at: "2026-09-16T03:59:00Z",
  unlock_at: null,
  lock_at: null,
  points_possible: 100,
  submission_types: ["online_upload"],
  allowed_extensions: ["pdf", "docx"],
  html_url: "https://canvas.example.edu/courses/101/assignments/5001",
  rubric: [
    {
      id: "c1",
      description: "Correctness",
      long_description: "<p>Right answers</p>",
      points: 80,
      ratings: [
        { description: "Full", points: 80 },
        { description: "None", points: 0 },
      ],
    },
  ],
  submission: { workflow_state: "unsubmitted", submitted_at: null, score: null, grade: null, late: false, missing: false },
};

describe("summariseAssignment", () => {
  it("keeps the fields needed for a briefing", () => {
    const out = summariseAssignment(base);
    expect(out).toMatchObject({ id: 5001, name: "Problem Set 2", points: 100, submission_types: ["online_upload"] });
    expect(out.submission).toEqual({
      state: "unsubmitted",
      submitted_at: null,
      score: null,
      grade: null,
      late: false,
      missing: false,
    });
    expect(out.due?.human).toMatch(/1[56] Sep/);
  });
});

describe("assignmentDetail", () => {
  it("renders description and rubric as text", () => {
    const out = assignmentDetail(base);
    expect(out.description).toBe("Answer all questions. Template: here [https://x.io/t.docx]");
    expect(out.allowed_extensions).toEqual(["pdf", "docx"]);
    expect(out.rubric).toEqual([
      { criterion: "Correctness", details: "Right answers", points: 80, ratings: ["80: Full", "0: None"] },
    ]);
  });

  it("tolerates missing optional fields", () => {
    const out = assignmentDetail({ ...base, description: null, rubric: undefined, submission: undefined, allowed_extensions: undefined });
    expect(out.description).toBeNull();
    expect(out.rubric).toEqual([]);
    expect(out.submission).toBeNull();
    expect(out.allowed_extensions).toEqual([]);
  });
});
