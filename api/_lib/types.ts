export type LaunchTransaction = {
  state: string;
  codeVerifier: string;
  iss: string;
  launch?: string | null;
  redirectUri: string;
  tokenEndpoint: string;
  createdAt: number;
};

export type SmartSession = {
  accessToken: string;
  tokenType: string;
  patientId: string | null;
  serverUrl: string;
  scope?: string;
  fhirUser?: string | null;
  expiresAt?: number | null;
};

export type SanitizedSmartSession = {
  source: "smart";
  patientId?: string | null;
  serverUrl?: string;
  fhirUser?: string | null;
  scope?: string;
  expiresAt?: number | null;
};
