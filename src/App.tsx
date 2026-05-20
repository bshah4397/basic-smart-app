import { useEffect, useMemo, useState } from "react";
import { getAthenaClientId, hasPlaceholderClientId } from "./smartConfig";

type Patient = {
  resourceType?: string;
  id?: string;
  name?: Array<{ given?: string[]; family?: string; text?: string }>;
  gender?: string;
  birthDate?: string;
  telecom?: Array<{ system?: string; value?: string }>;
  [key: string]: unknown;
};

type PatientContext = {
  source: "smart" | "demo";
  patient: Patient;
  serverUrl?: string;
  patientId?: string;
  fhirUser?: string | null;
  scope?: string;
};

type FhirError = {
  error: string;
  smartSession?: {
    source: "smart";
    patientId?: string | null;
    serverUrl?: string;
    fhirUser?: string | null;
    scope?: string;
    expiresAt?: number | null;
  };
  fhirDebug?: {
    request: {
      method: "GET";
      url: string;
    };
    response: {
      status: number;
      statusText: string;
      body: unknown;
    };
  };
};

const demoContext: PatientContext = {
  source: "demo",
  patientId: "demo-patient",
  serverUrl: "Demo data",
  fhirUser: "Demo user",
  scope: "Demo mode",
  patient: {
    resourceType: "Patient",
    id: "demo-patient",
    name: [{ given: ["Alex"], family: "Rivers" }],
    gender: "unknown",
    birthDate: "1975-04-12",
    telecom: [{ system: "phone", value: "555-0134" }]
  }
};

export default function App() {
  const [context, setContext] = useState<PatientContext | null>(null);
  const [error, setError] = useState<FhirError | null>(null);
  const [loading, setLoading] = useState(true);
  const clientId = getAthenaClientId();

  const route = typeof window === "undefined" ? "/" : window.location.pathname;
  const isSmartReturn = useMemo(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("smart") === "1";
  }, []);

  useEffect(() => {
    if (route === "/logout-complete") {
      setLoading(false);
      return;
    }

    if (hasPlaceholderClientId(clientId)) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    async function loadPatientContext() {
      try {
        const response = await fetch("/api/patient-context");
        const payload = await response.json();
        if (cancelled) return;

        if (response.ok) {
          setContext(payload as PatientContext);
          setError(null);
        } else if (isSmartReturn) {
          setError(payload as FhirError);
          setContext(null);
        } else {
          setContext(demoContext);
          setError(null);
        }
      } catch (caught) {
        if (cancelled) return;
        if (isSmartReturn) {
          setError({ error: caught instanceof Error ? caught.message : "Unable to load patient context." });
        } else {
          setContext(demoContext);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadPatientContext();
    return () => {
      cancelled = true;
    };
  }, [clientId, isSmartReturn, route]);

  if (route === "/logout-complete") {
    return (
      <main className="shell">
        <section className="panel">
          <p className="eyebrow">Logout</p>
          <h1>Logout complete</h1>
          <p>Your local SMART session cookies have been cleared.</p>
        </section>
      </main>
    );
  }

  if (hasPlaceholderClientId(clientId)) {
    return (
      <main className="shell">
        <section className="panel">
          <p className="eyebrow">Setup required</p>
          <h1>Setup required</h1>
          <p>
            Deploy to Vercel first, register the Vercel URLs in athenahealth, copy the generated client ID,
            replace the placeholder in source code, and redeploy.
          </p>
          <PatientCard context={demoContext} badge="Demo data" />
        </section>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="shell">
        <section className="panel">
          <h1>Patient Context</h1>
          <p>Loading patient context...</p>
        </section>
      </main>
    );
  }

  if (error) {
    return <ErrorView error={error} />;
  }

  return (
    <main className="shell">
      <section className="panel">
        <PatientCard context={context ?? demoContext} badge={context?.source === "smart" ? "SMART launch" : "Demo data"} />
      </section>
    </main>
  );
}

function PatientCard({ context, badge }: { context: PatientContext; badge: string }) {
  const patient = context.patient;
  return (
    <>
      <div className="title-row">
        <h1>Patient Context</h1>
        <span className="badge">{badge}</span>
      </div>
      <table className="patient-table">
        <tbody>
          <TableRow label="FHIR ID" value={patient.id ?? context.patientId ?? "Unknown"} />
          <TableRow label="Name" value={formatName(patient)} />
          <TableRow label="Gender" value={patient.gender ?? "Unknown"} />
          <TableRow label="Birth date" value={patient.birthDate ?? "Unknown"} />
          <TableRow label="Phone" value={formatPhone(patient)} />
        </tbody>
      </table>
      <details>
        <summary>Developer details</summary>
        <dl className="details-grid">
          <dt>FHIR server</dt>
          <dd>{context.serverUrl ?? "Unknown"}</dd>
          <dt>Patient ID</dt>
          <dd>{context.patientId ?? patient.id ?? "Unknown"}</dd>
          <dt>FHIR user</dt>
          <dd>{context.fhirUser ?? "Unknown"}</dd>
          <dt>Granted scope</dt>
          <dd>{context.scope ?? "Unknown"}</dd>
        </dl>
        <pre>{JSON.stringify(patient, null, 2)}</pre>
      </details>
    </>
  );
}

function ErrorView({ error }: { error: FhirError }) {
  return (
    <main className="shell">
      <section className="panel error-panel">
        <h1>Unable to load patient context</h1>
        <p>{error.error}</p>
        <details open>
          <summary>Developer details</summary>
          <dl className="details-grid">
            <dt>FHIR server</dt>
            <dd>{error.smartSession?.serverUrl ?? "Unknown"}</dd>
            <dt>Patient ID</dt>
            <dd>{error.smartSession?.patientId ?? "Unknown"}</dd>
            <dt>FHIR user</dt>
            <dd>{error.smartSession?.fhirUser ?? "Unknown"}</dd>
            <dt>Granted scope</dt>
            <dd>{error.smartSession?.scope ?? "Unknown"}</dd>
            <dt>Failed FHIR request method</dt>
            <dd>{error.fhirDebug?.request.method ?? "Unknown"}</dd>
            <dt>Failed FHIR request URL</dt>
            <dd>{error.fhirDebug?.request.url ?? "Unknown"}</dd>
            <dt>Failed FHIR response status</dt>
            <dd>{formatStatus(error)}</dd>
          </dl>
          <pre>{JSON.stringify(error.fhirDebug?.response.body ?? {}, null, 2)}</pre>
        </details>
      </section>
    </main>
  );
}

function TableRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <th scope="row">{label}</th>
      <td>{value}</td>
    </tr>
  );
}

function formatName(patient: Patient): string {
  const firstName = patient.name?.[0];
  if (!firstName) return "Unknown";
  if (firstName.text) return firstName.text;
  return [...(firstName.given ?? []), firstName.family].filter(Boolean).join(" ") || "Unknown";
}

function formatPhone(patient: Patient): string {
  return patient.telecom?.find((item) => item.system === "phone")?.value ?? "Not provided";
}

function formatStatus(error: FhirError): string {
  const response = error.fhirDebug?.response;
  if (!response) return "Unknown";
  return `${response.status} ${response.statusText}`.trim();
}
