import type { VercelRequest, VercelResponse } from "@vercel/node";
import { LAUNCH_COOKIE, SESSION_COOKIE, clearCookie } from "./_lib/cookies";
import { isHttpsRequest } from "./_lib/http";

export default function handler(req: VercelRequest, res: VercelResponse): void {
  const secure = isHttpsRequest(req);
  res.setHeader("Set-Cookie", [
    clearCookie(LAUNCH_COOKIE, secure),
    clearCookie(SESSION_COOKIE, secure)
  ]);
  res.redirect(302, "/logout-complete");
}
