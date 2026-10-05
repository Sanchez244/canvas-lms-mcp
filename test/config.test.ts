import { describe, expect, it } from "vitest";
import { readConfig } from "../src/config.js";

describe("readConfig", () => {
  it("defaults to token auth, writable, no base url", () => {
    const config = readConfig({ CANVAS_TOKEN: "tok" });
    expect(config.auth).toBe("token");
    expect(config.token).toBe("tok");
    expect(config.readOnly).toBe(false);
    expect(config.baseUrl).toBe("");
  });

  it("gateway mode drops the token even if one is set", () => {
    const config = readConfig({ CANVAS_AUTH: "gateway", CANVAS_TOKEN: "should-not-be-used" });
    expect(config.auth).toBe("gateway");
    expect(config.token).toBe("");
  });

  it("rejects an unknown auth mode", () => {
    expect(() => readConfig({ CANVAS_AUTH: "magic" })).toThrow(/CANVAS_AUTH/);
  });

  it("reads CANVAS_READ_ONLY as 1 or true", () => {
    expect(readConfig({ CANVAS_READ_ONLY: "1" }).readOnly).toBe(true);
    expect(readConfig({ CANVAS_READ_ONLY: "true" }).readOnly).toBe(true);
    expect(readConfig({ CANVAS_READ_ONLY: "0" }).readOnly).toBe(false);
    expect(readConfig({}).readOnly).toBe(false);
  });

  it("strips a trailing slash from the base url", () => {
    expect(readConfig({ CANVAS_BASE_URL: "https://canvas.example/" }).baseUrl).toBe("https://canvas.example");
  });
});
