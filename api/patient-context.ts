import type { VercelRequest, VercelResponse } from "@vercel/node";
import { SESSION_COOKIE, decryptCookieValue, readCookie } from "./_lib/cookies";
import { sendJson } from "./_lib/http";
import type { SanitizedSmartSession, SmartSession } from "./_lib/types";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const sessionCookie = readCookie(req.headers.cookie, SESSION_COOKIE);
  if (!sessionCookie) {
    sendJson(res, 401, { error: "No active SMART session." });
    return;
  }

  const session = await decryptCookieValue<SmartSession>(sessionCookie);
  if (!session) {
    sendJson(res, 401, { error: "No active SMART session." });
    return;
  }

  if (!session.patientId) {
    sendJson(res, 400, {
      error: "Token response missing patient context.",
      smartSession: sanitizeSession(session)
    });
    return;
  }

  const patientUrl = `${session.serverUrl.replace(/\/$/, "")}/Patient/${encodeURIComponent(session.patientId)}`;
  const fhirResponse = await fetch(patientUrl, {
    method: "GET",
    headers: {
      Accept: "application/fhir+json, application/json",
      Authorization: `${session.tokenType || "Bearer"} ${session.accessToken}`
    }
  });

  const body = await readResponseBody(fhirResponse);
  if (!fhirResponse.ok) {
    sendJson(res, 502, {
      error: "FHIR Patient read failed.",
      smartSession: sanitizeSession(session),
      fhirDebug: {
        request: {
          method: "GET",
          url: patientUrl
        },
        response: {
          status: fhirResponse.status,
          statusText: fhirResponse.statusText,
          body
        }
      }
    });
    return;
  }

  sendJson(res, 200, {
    source: "smart",
    patient: body,
    serverUrl: session.serverUrl,
    patientId: session.patientId,
    fhirUser: session.fhirUser ?? null,
    scope: session.scope
  });
}

function sanitizeSession(session: SmartSession): SanitizedSmartSession {
  return {
    source: "smart",
    patientId: session.patientId,
    serverUrl: session.serverUrl,
    fhirUser: session.fhirUser ?? null,
    scope: session.scope,
    expiresAt: session.expiresAt ?? null
  };
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
