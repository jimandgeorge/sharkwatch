import { CLIENT_BASE } from "@/lib/api";

function Code({ children }: { children: string }) {
  return (
    <pre className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-[12px] font-mono text-zinc-300 overflow-x-auto whitespace-pre leading-relaxed">
      {children}
    </pre>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-[13px] font-semibold text-zinc-200">{title}</h2>
      {children}
    </section>
  );
}

function Badge({ children }: { children: string }) {
  return (
    <span className="inline-flex items-center px-2 py-px rounded border border-zinc-700 bg-zinc-800 text-[11px] font-mono text-zinc-400">
      {children}
    </span>
  );
}

const INGEST_EXAMPLE = `POST /ingest/transaction
Content-Type: application/json
X-API-Key: <your-api-key>

{
  "external_id":          "fps-20240112-00847",
  "source":               "faster_payments",
  "amount_pence":         485000,
  "currency":             "GBP",
  "customer_id":          "cust-00123",
  "customer_email":       "james.wright@email.com",
  "beneficiary_account":  "GB29NWBK60161331926819",
  "beneficiary_name":     "Smith Consulting Ltd",
  "transfer_type":        "FPS",
  "ip_address":           "82.45.120.9",
  "device_fingerprint":   "fp-a1b2c3d4",
  "geolocation":          "London, UK",
  "fraud_signals":        ["new_beneficiary", "high_velocity"],
  "triggered_rules":      ["RULE_HIGH_VALUE_FPS", "RULE_NEW_PAYEE"]
}`;

const RESPONSE_EXAMPLE = `HTTP/1.1 202 Accepted

{
  "id":          "3fa85f64-...",
  "external_id": "fps-20240112-00847",
  "source":      "faster_payments",
  "risk_score":  78,
  "risk_level":  "high",
  "status":      "queued"
}`;

const CURL_EXAMPLE = (base: string) => `curl -X POST ${base}/ingest/transaction \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: your-api-key" \\
  -d '{
    "external_id":         "fps-20240112-00847",
    "source":              "faster_payments",
    "amount_pence":        485000,
    "currency":            "GBP",
    "customer_id":         "cust-00123",
    "beneficiary_account": "GB29NWBK60161331926819",
    "beneficiary_name":    "Smith Consulting Ltd",
    "transfer_type":       "FPS",
    "fraud_signals":       ["new_beneficiary", "high_velocity"]
  }'`;

const PYTHON_EXAMPLE = (base: string) => `import requests

resp = requests.post(
    "${base}/ingest/transaction",
    headers={"X-API-Key": "your-api-key"},
    json={
        "external_id":         "fps-20240112-00847",
        "source":              "faster_payments",
        "amount_pence":        485000,
        "currency":            "GBP",
        "customer_id":         "cust-00123",
        "beneficiary_account": "GB29NWBK60161331926819",
        "beneficiary_name":    "Smith Consulting Ltd",
        "transfer_type":       "FPS",
        "fraud_signals":       ["new_beneficiary", "high_velocity"],
    },
)
print(resp.json())  # {"id": "...", "risk_score": 78, "risk_level": "high", ...}`;

const FRAUD_SIGNALS = [
  ["new_beneficiary", "First payment to this account"],
  ["high_velocity", "Multiple transfers in short window"],
  ["large_round_amount", "Suspiciously round transfer amount"],
  ["account_age_new", "Customer account opened recently"],
  ["cross_border", "Transfer to overseas account"],
  ["unusual_hour", "Transaction outside normal hours"],
  ["device_mismatch", "Different device from usual sessions"],
  ["ip_mismatch", "IP doesn't match registered address"],
];

export default function IntegratePage() {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-[15px] font-semibold text-zinc-100">Integration Guide</h1>
        <p className="text-[12px] text-zinc-500 mt-1">
          Send flagged transactions to Shark Watch via a single HTTP endpoint.
          Investigations are triggered automatically — results appear in the queue within seconds.
        </p>
      </div>

      <Section title="How it works">
        <ol className="space-y-2 text-[12px] text-zinc-400">
          {[
            "Your fraud engine flags a transaction and POSTs it to /ingest/transaction",
            "Shark Watch scores the transaction, retrieves similar prior cases via RAG, and triggers the LLM investigation",
            "The analyst sees the case in the queue with AI summary, risk signals, and recommended action",
            "Analyst reviews, optionally chats with the copilot, and submits a decision",
            "Decision is written to the audit trail with full context — ready for PSR compliance review",
          ].map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="w-4 h-4 rounded-full bg-zinc-800 border border-zinc-700 text-[10px] font-mono text-zinc-500 flex items-center justify-center shrink-0 mt-px">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Authentication">
        <p className="text-[12px] text-zinc-500">
          Set <Badge>API_KEY</Badge> in your <Badge>.env</Badge> file.
          Pass it on every request as <Badge>X-API-Key: your-key</Badge>.
          Leave blank to disable auth (local dev only).
        </p>
      </Section>

      <Section title="Ingest endpoint">
        <Code>{INGEST_EXAMPLE}</Code>
        <p className="text-[11px] text-zinc-600">
          Returns <Badge>202 Accepted</Badge> immediately. Investigation runs in the background.
        </p>
        <Code>{RESPONSE_EXAMPLE}</Code>
      </Section>

      <Section title="Fraud signals reference">
        <p className="text-[12px] text-zinc-500 mb-2">
          Pass any combination in <Badge>fraud_signals</Badge>. Shark Watch uses these to calculate risk score and surface evidence.
        </p>
        <div className="rounded-lg border border-zinc-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/40">
                {["Signal", "Meaning"].map((h) => (
                  <th key={h} className="text-left px-4 py-2 text-[10px] font-medium text-zinc-600 uppercase tracking-widest">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FRAUD_SIGNALS.map(([signal, meaning], i) => (
                <tr key={signal} className={i > 0 ? "border-t border-zinc-800/50" : ""}>
                  <td className="px-4 py-2 font-mono text-[11px] text-zinc-400">{signal}</td>
                  <td className="px-4 py-2 text-[12px] text-zinc-600">{meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="cURL example">
        <Code>{CURL_EXAMPLE(base)}</Code>
      </Section>

      <Section title="Python example">
        <Code>{PYTHON_EXAMPLE(base)}</Code>
      </Section>

      <Section title="Idempotency">
        <p className="text-[12px] text-zinc-500">
          Requests with a duplicate <Badge>source</Badge> + <Badge>external_id</Badge> combination are silently deduplicated —
          safe to retry on network failure.
        </p>
      </Section>
    </div>
  );
}
