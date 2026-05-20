import type { VercelRequest, VercelResponse } from "@vercel/node";

export function getRequestUrl(req: VercelRequest): URL {
  const protoHeader = req.headers["x-forwarded-proto"];
  const hostHeader = req.headers["x-forwarded-host"] ?? req.headers.host;
  const proto = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader || "http";
  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader || "localhost:5173";
  return new URL(req.url || "/", `${proto}://${host}`);
}

export function isHttpsRequest(req: VercelRequest): boolean {
  return getRequestUrl(req).protocol === "https:";
}

export function sendJson(res: VercelResponse, status: number, body: unknown): void {
  res.status(status).json(body);
}

export function sendSetupRequired(res: VercelResponse): void {
  res.status(200).setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>Setup required</title></head>
  <body>
    <main style="font-family: system-ui, sans-serif; max-width: 720px; margin: 48px auto; line-height: 1.5;">
      <h1>Setup required</h1>
      <p>Deploy to Vercel first, register the Vercel URLs in athenahealth, copy the generated client ID, replace the placeholder in source code, and redeploy.</p>
    </main>
  </body>
</html>`);
}
