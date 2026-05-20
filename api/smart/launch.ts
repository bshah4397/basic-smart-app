import type { VercelRequest, VercelResponse } from "@vercel/node";
import { LAUNCH_COOKIE, createSessionCookie } from "../_lib/cookies";
import { pkceChallenge, randomBase64Url } from "../_lib/crypto";
import { getRequestUrl, isHttpsRequest, sendJson, sendSetupRequired } from "../_lib/http";
import { buildAuthorizeUrl, discoverSmartEndpoints } from "../_lib/oauth";
import { SMART_SCOPES, getAthenaClientId, hasPlaceholderClientId } from "../_lib/smartConfig";
import type { LaunchTransaction } from "../_lib/types";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const clientId = getAthenaClientId();
  if (hasPlaceholderClientId(clientId)) {
    sendSetupRequired(res);
    return;
  }

  const requestUrl = getRequestUrl(req);
  const iss = requestUrl.searchParams.get("iss");
  if (!iss) {
    sendJson(res, 400, { error: "Missing iss on launch." });
    return;
  }

  const launch = requestUrl.searchParams.get("launch");
  const redirectUri = `${requestUrl.origin}/api/smart/callback`;
  const endpoints = await discoverSmartEndpoints(iss);
  const codeVerifier = randomBase64Url(64);
  const codeChallenge = pkceChallenge(codeVerifier);
  const state = randomBase64Url(32);

  const transaction: LaunchTransaction = {
    state,
    codeVerifier,
    iss,
    launch,
    redirectUri,
    tokenEndpoint: endpoints.tokenEndpoint,
    createdAt: Date.now()
  };

  const secure = isHttpsRequest(req);
  const launchCookie = await createSessionCookie(LAUNCH_COOKIE, transaction, {
    secure,
    maxAgeSeconds: 600
  });
  res.setHeader("Set-Cookie", launchCookie);

  const authorizeUrl = buildAuthorizeUrl({
    authorizationEndpoint: endpoints.authorizationEndpoint,
    clientId,
    redirectUri,
    scope: SMART_SCOPES,
    aud: iss,
    launch,
    state,
    codeChallenge
  });

  res.redirect(302, authorizeUrl.toString());
}
