import { describe, expect, it } from "vitest";
import { formatDate, htmlToText } from "../src/canvas/text.js";

describe("htmlToText", () => {
  it("keeps headings, links and lists readable", () => {
    const html =
      '<h2>Reading</h2><p>See <a href="https://x.io/a">chapter 3</a>.</p><ul><li>one</li><li>two</li></ul><img src="x.png">';
    expect(htmlToText(html)).toBe("Reading\n\nSee chapter 3 [https://x.io/a].\n\n * one\n * two");
  });

  it("returns empty string for null", () => {
    expect(htmlToText(null)).toBe("");
  });
});

describe("formatDate", () => {
  it("returns local-offset ISO and a short human string", () => {
    const out = formatDate("2026-09-15T03:59:00Z");
    expect(out).not.toBeNull();
    expect(out!.iso).toMatch(/^2026-09-1[45]T\d\d:\d\d:00[+-]\d\d:\d\d$/);
    expect(new Date(out!.iso).toISOString()).toBe("2026-09-15T03:59:00.000Z");
    expect(out!.human).toMatch(/^(Mon|Tue) 1[45] Sep \d\d:\d\d$/);
  });

  it("returns null for missing or invalid input", () => {
    expect(formatDate(null)).toBeNull();
    expect(formatDate("nope")).toBeNull();
  });
});
