export class CanvasError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly url: string,
  ) {
    super(message);
    this.name = "CanvasError";
  }
}

export type Params = Record<string, string | number | boolean | string[] | undefined>;

/** Parse an RFC 5988 Link header into { rel: url }. Canvas uses it for pagination. */
export function parseLinkHeader(header: string | null): Record<string, string> {
  const links: Record<string, string> = {};
  if (!header) return links;
  for (const part of header.split(",")) {
    const match = part.match(/<([^>]+)>\s*;\s*rel="([^"]+)"/);
    if (match?.[1] && match[2]) links[match[2]] = match[1];
  }
  return links;
}

function buildUrl(baseUrl: string, apiPath: string, params?: Params): string {
  const url = new URL(apiPath.startsWith("http") ? apiPath : `${baseUrl}/api/v1${apiPath}`);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) url.searchParams.append(`${key}[]`, v);
    } else {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

export class CanvasClient {
  /**
   * @param token Personal access token sent as `Authorization: Bearer`. Pass `null` when an
   *   outbound proxy injects the header instead (gateway mode): no Authorization header is sent.
   */
  constructor(
    private readonly baseUrl: string,
    private readonly token: string | null,
    private readonly maxItems = 500,
  ) {}

  private async request(url: string, init: RequestInit = {}): Promise<Response> {
    const res = await fetch(url, {
      ...init,
      headers: {
        ...(this.token === null ? {} : { Authorization: `Bearer ${this.token}` }),
        Accept: "application/json",
        ...(init.headers ?? {}),
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new CanvasError(`Canvas ${res.status} for ${url}: ${body.slice(0, 300)}`, res.status, url);
    }
    return res;
  }

  async get<T>(apiPath: string, params?: Params): Promise<T> {
    const res = await this.request(buildUrl(this.baseUrl, apiPath, params));
    return (await res.json()) as T;
  }

  /** GET a list endpoint and follow Link rel="next" until done or maxItems reached. */
  async getAll<T>(apiPath: string, params?: Params): Promise<T[]> {
    const items: T[] = [];
    let url: string | undefined = buildUrl(this.baseUrl, apiPath, { per_page: 100, ...params });
    while (url && items.length < this.maxItems) {
      const res: Response = await this.request(url);
      items.push(...((await res.json()) as T[]));
      url = parseLinkHeader(res.headers.get("link")).next;
    }
    return items.slice(0, this.maxItems);
  }

  async postJson<T>(apiPath: string, body: unknown): Promise<T> {
    const res = await this.request(buildUrl(this.baseUrl, apiPath), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await res.json()) as T;
  }
}
