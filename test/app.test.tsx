import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../src/App";

describe("Patient Context UI", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    (globalThis as { __ATHENA_SMART_TEST_CLIENT_ID__?: string }).__ATHENA_SMART_TEST_CLIENT_ID__ = "test-client-id";
    window.history.replaceState(null, "", "/");
  });

  it("renders patient context returned by the API", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({
      source: "smart",
      serverUrl: "https://fhir.example/r4",
      patientId: "patient-123",
      fhirUser: "Practitioner/prac-1",
      scope: "launch patient/Patient.r user/Patient.r openid fhirUser",
      patient: {
        resourceType: "Patient",
        id: "patient-123",
        name: [{ given: ["Jane"], family: "Doe" }],
        gender: "female",
        birthDate: "1980-01-02",
        telecom: [{ system: "phone", value: "555-0100" }]
      }
    })));

    render(<App />);

    expect(await screen.findByText("SMART launch")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Patient Context" })).toBeInTheDocument();
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getAllByText("patient-123").length).toBeGreaterThan(0);
  });

  it("shows sanitized developer diagnostics when FHIR patient loading fails", async () => {
    window.history.replaceState(null, "", "/?smart=1");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      error: "FHIR Patient read failed.",
      smartSession: {
        source: "smart",
        patientId: "patient-123",
        serverUrl: "https://fhir.example/r4",
        fhirUser: "Practitioner/prac-1",
        scope: "launch patient/Patient.r"
      },
      fhirDebug: {
        request: {
          method: "GET",
          url: "https://fhir.example/r4/Patient/patient-123"
        },
        response: {
          status: 403,
          statusText: "Forbidden",
          body: { resourceType: "OperationOutcome" }
        }
      }
    }), { status: 502, headers: { "Content-Type": "application/json" } })));

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Unable to load patient context" })).toBeInTheDocument();
    expect(screen.getByText("FHIR Patient read failed.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("https://fhir.example/r4/Patient/patient-123")).toBeInTheDocument());
    expect(screen.queryByText(/server-side-token|access_token|code_verifier|smart_session/i)).not.toBeInTheDocument();
  });
});
