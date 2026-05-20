import type { VercelRequest, VercelResponse } from "@vercel/node";
import { LAUNCH_COOKIE, SESSION_COOKIE, clearCookie, createSessionCookie, decryptCookieValue, readCookie } from "../_lib/cookies";
import { decodeJwtPayload } from "../_lib/crypto";
import { getRequestUrl, isHttpsRequest, sendJson, sendSetupRequired } from "../_lib/http";
import { getAthenaClientId, hasPlaceholderClientId } from "../_lib/smartConfig";
import type { LaunchTransaction, SmartSession } from "../_lib/types";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const clientId = getAthenaClientId();
  if (hasPlaceholderClientId(clientId)) {
    sendSetupRequired(res);
    return;
  }

  const requestUrl = getRequestUrl(req);
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  if (!code) {
    sendJson(res, 400, { error: "Missing code on callback." });
    return;
  }

  const launchCookie = readCookie(req.headers.cookie, LAUNCH_COOKIE);
  if (!launchCookie) {
    sendJson(res, 400, { error: "Missing launch transaction cookie." });
    return;
  }

  const transaction = await decryptCookieValue<LaunchTransaction>(launchCookie);
  if (!transaction) {
    sendJson(res, 400, { error: "Unable to read launch transaction cookie." });
    return;
  }

  if (!state || state !== transaction.state) {
    sendJson(res, 400, { error: "State mismatch." });
    return;
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: transaction.redirectUri,
    client_id: clientId,
    code_verifier: transaction.codeVerifier
  });

  const tokenResponse = await fetch(transaction.tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json"
    },
    body: body.toString()
  });

  const tokenPayload = await readResponseBody(tokenResponse);
  if (!tokenResponse.ok) {
    sendJson(res, 502, {
      error: "Token exchange failure.",
      tokenEndpoint: transaction.tokenEndpoint,
      status: tokenResponse.status,
      statusText: tokenResponse.statusText,
      body: tokenPayload
    });
    return;
  }

  const tokens = tokenPayload as Record<string, unknown>;
  const accessToken = typeof tokens.access_token === "string" ? tokens.access_token : null;
  if (!accessToken) {
    sendJson(res, 502, { error: "Token response missing access token." });
    return;
  }

  const idTokenPayload = typeof tokens.id_token === "string" ? decodeJwtPayload(tokens.id_token) : null;
  const patientId = stringValue(tokens.patient) ?? stringValue(idTokenPayload?.patient);
  if (!patientId) {
    sendJson(res, 502, { error: "Token response missing patient context." });
    return;
  }

  const expiresIn = typeof tokens.expires_in === "number" ? tokens.expires_in : null;
  const session: SmartSession = {
    accessToken,
    tokenType: stringValue(tokens.token_type) ?? "Bearer",
    patientId,
    serverUrl: stringValue(tokens.iss) ?? transaction.iss,
    scope: stringValue(tokens.scope) ?? undefined,
    fhirUser: stringValue(tokens.fhirUser) ?? stringValue(idTokenPayload?.fhirUser),
    expiresAt: expiresIn ? Date.now() + expiresIn * 1000 : null
  };

  const secure = isHttpsRequest(req);
  const sessionCookie = await createSessionCookie(SESSION_COOKIE, session, {
    secure,
    maxAgeSeconds: 3600
  });
  res.setHeader("Set-Cookie", [
    sessionCookie,
    clearCookie(LAUNCH_COOKIE, secure)
  ]);
  res.redirect(302, "/?smart=1");
}

async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}
