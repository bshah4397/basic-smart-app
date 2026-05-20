import type { VercelRequest, VercelResponse } from "@vercel/node";

type MockResponse = VercelResponse & {
  statusCode: number;
  headers: Record<string, string[] | string>;
  body: string;
};

export function makeRequest(url: string, headers: Record<string, string> = {}): VercelRequest {
  const parsed = new URL(url);
  return {
    method: "GET",
    url: `${parsed.pathname}${parsed.search}`,
    headers: {
      host: parsed.host,
      "x-forwarded-proto": parsed.protocol.replace(":", ""),
      ...headers
    },
    query: Object.fromEntries(parsed.searchParams.entries())
  } as unknown as VercelRequest;
}

export function createMockResponse(): MockResponse {
  const res = {
    statusCode: 200,
    headers: {} as Record<string, string[] | string>,
    body: "",
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    setHeader(name: string, value: string | string[]) {
      const key = name.toLowerCase();
      this.headers[key] = value;
      return this;
    },
    getHeader(name: string) {
      return this.headers[name.toLowerCase()];
    },
    redirect(codeOrUrl: number | string, maybeUrl?: string) {
      if (typeof codeOrUrl === "number") {
        this.statusCode = codeOrUrl;
        this.headers.location = maybeUrl ?? "/";
      } else {
        this.statusCode = 302;
        this.headers.location = codeOrUrl;
      }
      return this;
    },
    json(value: unknown) {
      this.headers["content-type"] = "application/json";
      this.body = JSON.stringify(value);
      return this;
    },
    send(value: unknown) {
      this.body = typeof value === "string" ? value : JSON.stringify(value);
      return this;
    },
    end(value?: unknown) {
      if (value !== undefined) {
        this.body = String(value);
      }
      return this;
    }
  };
  return res as unknown as MockResponse;
}

export function getCookieByName(setCookies: string[] | string | undefined, name: string): string | null {
  const cookies = Array.isArray(setCookies) ? setCookies : setCookies ? [setCookies] : [];
  return cookies.find((cookie) => cookie.startsWith(`${name}=`)) ?? null;
}
