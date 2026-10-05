import { describe, expect, it } from "vitest";
import type { PlannerItem } from "../src/canvas/types.js";
import { summariseUpcoming } from "../src/tools/planner.js";
import fixture from "./fixtures/planner.json" with { type: "json" };

describe("summariseUpcoming", () => {
  const items = summariseUpcoming(fixture as PlannerItem[], "https://canvas.example.edu");

  it("drops announcements and sorts by due date", () => {
    expect(items.map((i) => i.title)).toEqual(["Problem Set 1", "Case quiz 1", "Problem Set 2"]);
  });

  it("derives submission status", () => {
    expect(items.map((i) => i.status)).toEqual(["missing", "graded", "todo"]);
  });

  it("resolves relative urls against the base and keeps course context", () => {
    const ps2 = items.find((i) => i.plannable_id === 5001)!;
    expect(ps2.url).toBe("https://canvas.example.edu/courses/101/assignments/5001");
    expect(ps2.course).toBe("15.401 Finance Theory I");
    expect(ps2.course_id).toBe(101);
    expect(ps2.points).toBe(100);
    expect(ps2.due?.human).toMatch(/^(Tue|Wed) 1[56] Sep \d\d:\d\d$/);
  });
});
