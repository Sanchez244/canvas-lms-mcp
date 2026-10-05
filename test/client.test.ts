import { afterEach, describe, expect, it, vi } from "vitest";
import { CanvasClient, CanvasError, parseLinkHeader } from "../src/canvas/client.js";

function jsonResponse(body: unknown, headers: Record<string, string> = {}, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseLinkHeader", () => {
  it("extracts rel targets from a Canvas Link header", () => {
    const header =
      '<https://canvas.example.edu/api/v1/courses?page=2&per_page=10>; rel="next",' +
      '<https://canvas.example.edu/api/v1/courses?page=1&per_page=10>; rel="first"';
    expect(parseLinkHeader(header)).toEqual({
      next: "https://canvas.example.edu/api/v1/courses?page=2&per_page=10",
      first: "https://canvas.example.edu/api/v1/courses?page=1&per_page=10",
    });
  });

  it("returns an empty object for a missing header", () => {
    expect(parseLinkHeader(null)).toEqual({});
  });
});

describe("CanvasClient", () => {
  it("sends the bearer token and builds array params the Canvas way", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([{ id: 1 }]));
    vi.stubGlobal("fetch", fetchMock);
    const client = new CanvasClient("https://canvas.example", "tok");

    await client.get("/courses", { include: ["term", "syllabus_body"], enrollment_state: "active" });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://canvas.example/api/v1/courses?include%5B%5D=term&include%5B%5D=syllabus_body&enrollment_state=active",
    );
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });

  it("follows Link rel=next across pages and stops at the cap", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([1, 2], { link: '<https://canvas.example/api/v1/x?page=2>; rel="next"' }))
      .mockResolvedValueOnce(jsonResponse([3, 4], { link: '<https://canvas.example/api/v1/x?page=3>; rel="next"' }))
      .mockResolvedValueOnce(jsonResponse([5, 6]));
    vi.stubGlobal("fetch", fetchMock);
    const client = new CanvasClient("https://canvas.example", "tok", 3);

    const items = await client.getAll<number>("/x");

    expect(items).toEqual([1, 2, 3]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("sends no Authorization header at all in gateway mode (null token)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 1 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new CanvasClient("https://canvas.example", null);

    await client.get("/users/self");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(Object.keys(headers)).not.toContain("Authorization");
    expect(headers.Accept).toBe("application/json");
  });

  it("throws CanvasError with the status on non-2xx", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ errors: "bad token" }, {}, 401)));
    const client = new CanvasClient("https://canvas.example", "tok");

    await expect(client.get("/users/self")).rejects.toMatchObject({
      name: "CanvasError",
      status: 401,
    } satisfies Partial<CanvasError>);
  });
});
