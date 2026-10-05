import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { extractDocument } from "../src/tools/documents.js";

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

describe("extractDocument", () => {
  it("reads a docx with headings and bullets as text", async () => {
    const out = await extractDocument(path.join(fixtures, "sample.docx"));
    expect(out.type).toBe("docx");
    expect(out.text).toBe("Course Syllabus\n\nProblem sets are due Wednesdays at 13:00.\n\n * Reading one\n * Reading two");
    expect(out.truncated).toBe(false);
  });

  it("reads a pdf page by page", async () => {
    const out = await extractDocument(path.join(fixtures, "sample.pdf"));
    expect(out.type).toBe("pdf");
    expect(out.pages).toBe(2);
    expect(out.text).toBe("Homework 3: build a stock and flow model.\n\n--- page 2 ---\n\nSubmit by Wednesday 13:00.");
  });

  it("truncates to max_chars and says so", async () => {
    const out = await extractDocument(path.join(fixtures, "sample.pdf"), 20);
    expect(out.text).toHaveLength(20);
    expect(out.truncated).toBe(true);
    expect(out.chars).toBeGreaterThan(20);
  });

  it("returns empty text for a multi-page PDF with no text layer", async () => {
    const out = await extractDocument(path.join(fixtures, "empty-pages.pdf"));
    expect(out.pages).toBe(3);
    expect(out.text).toBe("");
    expect(out.chars).toBe(0);
  });

  it("rejects unsupported extensions, missing files and directories", async () => {
    await expect(extractDocument(path.join(fixtures, "planner.json"))).rejects.toThrow(/Unsupported/);
    await expect(extractDocument(path.join(fixtures, "nope.pdf"))).rejects.toThrow(/not found/i);
    await expect(extractDocument(fixtures)).rejects.toThrow(/Not a file/);
  });
});
