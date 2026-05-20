export const ATHENA_CLIENT_ID = "<REPLACE_WITH_ATHENA_CLIENT_ID>";
export const SMART_SCOPES = "launch patient/Patient.r user/Patient.r openid fhirUser";
export const ATHENA_FHIR_BASE_URL = "https://api.preview.platform.athenahealth.com/fhir/r4";
export const ATHENA_AUTHORIZATION_URL = "https://api.preview.platform.athenahealth.com/oauth2/v1/authorize";
export const ATHENA_TOKEN_URL = "https://api.preview.platform.athenahealth.com/oauth2/v1/token";
export const DEPLOYMENT_TARGET = "Vercel";

export const PLACEHOLDER_CLIENT_ID = "<REPLACE_WITH_ATHENA_CLIENT_ID>";

export function hasPlaceholderClientId(clientId = ATHENA_CLIENT_ID): boolean {
  return clientId === PLACEHOLDER_CLIENT_ID || clientId.trim() === "";
}

export function getAthenaClientId(): string {
  const testOverride = (globalThis as { __ATHENA_SMART_TEST_CLIENT_ID__?: string }).__ATHENA_SMART_TEST_CLIENT_ID__;
  return testOverride ?? ATHENA_CLIENT_ID;
}
