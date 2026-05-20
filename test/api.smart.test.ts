import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSessionCookie, decryptCookieValue } from "../api/_lib/cookies";
import { buildAuthorizeUrl } from "../api/_lib/oauth";
import { SMART_SCOPES, ATHENA_CLIENT_ID } from "../api/_lib/smartConfig";
import launchHandler from "../api/smart/launch";
import callbackHandler from "../api/smart/callback";
import patientContextHandler from "../api/patient-context";
import { createMockResponse, getCookieByName, makeRequest } from "./helpers";

describe("SMART authorization launch", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    (globalThis as { __ATHENA_SMART_TEST_CLIENT_ID__?: string }).__ATHENA_SMART_TEST_CLIENT_ID__ = "test-client-id";
  });

  it("builds an authorize URL with SMART launch, audience, redirect URI, and PKCE challenge", () => {
    const url = buildAuthorizeUrl({
      authorizationEndpoint: "https://auth.example/authorize",
      clientId: ATHENA_CLIENT_ID,
      scope: SMART_SCOPES,
      aud: "https://fhir.example/r4",
      launch: "launch-123",
      redirectUri: "https://app.example/api/smart/callback",
      state: "state-123",
      codeChallenge: "challenge-123"
    });

    expect(url.searchParams.get("client_id")).toBe(ATHENA_CLIENT_ID);
    expect(url.searchParams.get("scope")).toBe(SMART_SCOPES);
    expect(url.searchParams.get("aud")).toBe("https://fhir.example/r4");
    expect(url.searchParams.get("launch")).toBe("launch-123");
    expect(url.searchParams.get("redirect_uri")).toBe("https://app.example/api/smart/callback");
    expect(url.searchParams.get("code_challenge")).toBe("challenge-123");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("sets an embedded-safe httpOnly launch cookie on HTTPS launch requests", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({
      authorization_endpoint: "https://auth.example/authorize",
      token_endpoint: "https://auth.example/token"
    })));
    const res = createMockResponse();
    await launchHandler(
      makeRequest("https://demo.example/api/smart/launch?iss=https%3A%2F%2Ffhir.example%2Fr4&launch=abc"),
      res
    );

    const cookieHeader = res.headers["set-cookie"];
    const setCookie = Array.isArray(cookieHeader) ? cookieHeader.join("; ") : cookieHeader;
    expect(setCookie).toContain("smart_launch=");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("SameSite=None");
    expect(setCookie).toContain("Partitioned");
    expect(res.statusCode).toBe(302);
  });

  it("exchanges the authorization code server-side and creates a SMART session cookie", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({
      access_token: "server-side-token",
      token_type: "Bearer",
      patient: "patient-123",
      scope: SMART_SCOPES,
      fhirUser: "Practitioner/prac-1",
      expires_in: 3600
    })));

    const launchCookie = await createSessionCookie("smart_launch", {
      state: "expected-state",
      codeVerifier: "verifier-123",
      iss: "https://fhir.example/r4",
      launch: "launch-abc",
      redirectUri: "https://demo.example/api/smart/callback",
      tokenEndpoint: "https://auth.example/token",
      createdAt: Date.now()
    }, { secure: true, maxAgeSeconds: 600 });

    const res = createMockResponse();
    await callbackHandler(
      makeRequest("https://demo.example/api/smart/callback?code=code-123&state=expected-state", {
        cookie: launchCookie
      }),
      res
    );

    const tokenRequest = vi.mocked(fetch).mock.calls[0];
    expect(tokenRequest[0]).toBe("https://auth.example/token");
    expect(String(tokenRequest[1]?.body)).toContain("code=code-123");
    expect(String(tokenRequest[1]?.body)).toContain("code_verifier=verifier-123");
    expect(getCookieByName(res.headers["set-cookie"], "smart_session")).toBeTruthy();
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("/?smart=1");
  });
});

describe("patient context API", () => {
  it("reads Patient/{id} with the bearer token stored in the server-side session", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({
      resourceType: "Patient",
      id: "patient-123",
      gender: "female"
    })));

    const sessionCookie = await createSessionCookie("smart_session", {
      accessToken: "server-side-token",
      tokenType: "Bearer",
      patientId: "patient-123",
      serverUrl: "https://fhir.example/r4",
      scope: SMART_SCOPES,
      fhirUser: "Practitioner/prac-1",
      expiresAt: Date.now() + 3600000
    }, { secure: true, maxAgeSeconds: 3600 });

    const res = createMockResponse();
    await patientContextHandler(makeRequest("https://demo.example/api/patient-context", {
      cookie: sessionCookie
    }), res);

    expect(fetch).toHaveBeenCalledWith("https://fhir.example/r4/Patient/patient-123", expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: "Bearer server-side-token"
      })
    }));
    expect(JSON.parse(res.body)).toMatchObject({
      source: "smart",
      patientId: "patient-123",
      patient: { id: "patient-123" }
    });
  });
});
