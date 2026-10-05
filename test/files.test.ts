import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CanvasFile } from "../src/canvas/types.js";
import { downloadTo, sanitiseName } from "../src/tools/files.js";

describe("sanitiseName", () => {
  it("strips characters Windows rejects and trailing dots", () => {
    expect(sanitiseName('Week 1: Intro / "Slides".pdf.')).toBe("Week 1_ Intro _ _Slides_.pdf");
    expect(sanitiseName("   ")).toBe("unnamed");
  });
});

describe("downloadTo", () => {
  let dir: string;
  const file: CanvasFile = {
    id: 42,
    display_name: "Lecture 1.pdf",
    filename: "lecture1.pdf",
    size: 11,
    "content-type": "application/pdf",
    url: "https://canvas.example/files/42/download?verifier=abc",
    folder_id: 1,
    updated_at: "2026-09-01T00:00:00Z",
  };

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "canvas-mcp-"));
  });
  afterEach(async () => {
    vi.unstubAllGlobals();
    await rm(dir, { recursive: true, force: true });
  });

  it("streams the file into <dir>/<course>/<name> without an Authorization header, then skips a repeat", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("hello world", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const first = await downloadTo(file, dir, "15.401");
    expect(first).toEqual({ path: path.join(dir, "15.401", "Lecture 1.pdf"), size_kb: 0, skipped: false });
    expect(await readFile(first.path, "utf8")).toBe("hello world");
    expect(fetchMock).toHaveBeenCalledWith(file.url);

    const second = await downloadTo(file, dir, "15.401");
    expect(second.skipped).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("explains a locked file (empty url from Canvas) instead of calling fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const locked: CanvasFile = { ...file, url: "", locked_for_user: true, lock_explanation: "This file is currently locked." };

    await expect(downloadTo(locked, dir, "15.S50")).rejects.toThrow(/currently locked/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws on a failed download and leaves no file behind", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 403 })));
    await expect(downloadTo(file, dir, "15.401")).rejects.toThrow(/403/);
    await expect(readFile(path.join(dir, "15.401", "Lecture 1.pdf"))).rejects.toThrow();
  });
});
