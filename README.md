# athenahealth SMART on FHIR React Skeleton

This is a reusable demo skeleton for an athenahealth SMART on FHIR app. It uses Vite, React, TypeScript, Vercel Serverless Functions, Authorization Code + PKCE, encrypted `httpOnly` cookies, and a small Patient Context reference module.

It is not production-secure as written. The cookie encryption key is hardcoded so the demo can be deployed without `.env` files or Vercel environment variables.

## Configure The Client ID

The app starts with this placeholder in source-controlled config:

```ts
ATHENA_CLIENT_ID = "<REPLACE_WITH_ATHENA_CLIENT_ID>";
```

When the placeholder is still present, `/api/smart/launch` and `/api/smart/callback` show a setup-required message instead of attempting SMART OAuth. Replace the placeholder in `src/smartConfig.ts` and `api/_lib/smartConfig.ts` after athenahealth gives you a real client ID.

## Two-Pass Bootstrap Flow

athenahealth app registration asks for launch and redirect URLs before it gives the app a client ID, so use this order:

1. Create or clone a GitHub repo.
2. Run this prompt in the repo with an AI coding tool.
3. Let the AI build the app using the placeholder client ID.
4. Push the generated app to GitHub.
5. Import/deploy the repo to Vercel.
6. Copy the Vercel production URL.
7. Create/register the app in the athenahealth developer portal using the Vercel URLs.
8. Copy the generated athenahealth client ID.
9. Replace `<REPLACE_WITH_ATHENA_CLIENT_ID>` in source code.
10. Commit, push, and let Vercel redeploy.
11. Launch the app from an entitled athena preview practice.

## Run Locally

```bash
npm install
npm run dev
npm test
npm run build
```

Local direct visits can show demo patient data. Real embedded SMART launches should use the deployed HTTPS Vercel URL so cookies can use `SameSite=None; Secure; Partitioned`.

## Deploy To Vercel

Import the GitHub repo into Vercel. Vercel should detect Vite automatically, build the frontend into `dist`, and deploy the `/api` serverless functions. No custom server startup is required.

No `.env`, `.env.local`, or Vercel environment variables are required for this demo because the SMART endpoints, scopes, placeholder client ID, and demo-only cookie key are source-controlled constants.

## athenahealth Preview Registration

Use your deployed production domain in these values:

```text
Launch URL: https://<vercel-domain>/api/smart/launch
Post-login redirect URL: https://<vercel-domain>/api/smart/callback
Post-logout redirect URL: https://<vercel-domain>/logout-complete
Scopes: launch patient/Patient.r user/Patient.r openid fhirUser
```

Create New Application screen:

```text
API Access: My app will use Certified APIs ONLY
App Category: 3-Legged OAuth for Providers
System or Provider-Facing ONC Certified App: follow your actual certification status. If the portal requires confirmation for this app type, confirm only if accurate for your app.
```

App details / credentials screens:

```text
Application type: Browser / public client
Authentication method: PKCE / token auth method none
FHIR version/API: FHIR R4 SMART V2
Launch URL: https://<vercel-domain>/api/smart/launch
Post-login redirect URL: https://<vercel-domain>/api/smart/callback
Post-logout redirect URL: https://<vercel-domain>/logout-complete
Scopes: launch patient/Patient.r user/Patient.r openid fhirUser
```

Default athena preview constants:

```text
FHIR base URL: https://api.preview.platform.athenahealth.com/fhir/r4
Authorization URL fallback: https://api.preview.platform.athenahealth.com/oauth2/v1/authorize
Token URL fallback: https://api.preview.platform.athenahealth.com/oauth2/v1/token
```

The launch handler first tries SMART discovery at `{iss}/.well-known/smart-configuration`. If discovery fails, it falls back to the athena preview OAuth endpoints above.

## SMART Flow

`GET /api/smart/launch` receives `iss` and optional `launch`, creates a PKCE verifier/challenge and state, stores the transaction in an encrypted `httpOnly` cookie, and redirects to athena authorization.

`GET /api/smart/callback` validates state, exchanges the code server-side using PKCE, stores only the app-needed session fields in an encrypted `httpOnly` cookie, clears the launch cookie, and redirects to `/?smart=1`.

`GET /api/patient-context` reads the session cookie server-side, calls `GET {FHIR_SERVER}/Patient/{patientId}` with the bearer token, and returns sanitized patient context to React. It never returns access tokens, refresh tokens, auth codes, PKCE verifiers, encrypted cookie values, or raw cookies.

`GET /api/logout` clears app cookies and redirects to `/logout-complete`.

## Cookie Behavior

For HTTPS deployments, cookies are set with:

```text
HttpOnly
Secure
SameSite=None
Partitioned
Path=/
```

For local HTTP development, cookies use:

```text
HttpOnly
SameSite=Lax
Path=/
```

The launch transaction cookie lasts about 10 minutes. The session cookie lasts about 1 hour.

The code uses AES-256-GCM with this explicitly demo-only source-controlled key:

```ts
// Demo only. Do not use this hardcoded key for production patient data.
```

For production patient data, replace this with managed key material and a real secret management process.

## Troubleshooting

Browser token exchange can fail because of CORS. This skeleton exchanges tokens only in Vercel Serverless Functions.

Embedded athenaOne launches require `SameSite=None; Secure; Partitioned` cookies so cookies survive the embedded launch context.

A successful OAuth flow can still fail with `403 Invalid Client` if the app/client is not entitled for the launched practice.

For athena preview, external app builders may only be entitled for specific practices. If OAuth works but FHIR calls fail, verify the app entitlement and launched preview practice.
