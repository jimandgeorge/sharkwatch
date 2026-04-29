// API_URL is a server-side-only env var used in Docker (http://backend:8000).
// NEXT_PUBLIC_API_URL / fallback is used by the browser.
const BASE =
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8000";

// For use in client components — only NEXT_PUBLIC_* vars are available in the browser.
export const CLIENT_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface QueueItem {
  id: string;
  transaction_id: string;
  risk_score: number;
  risk_level: "low" | "medium" | "high" | "critical";
  fraud_type: string | null;
  confidence: "low" | "medium" | "high";
  recommended_action: string;
  created_at: string;
  amount_pence: number;
  currency: string;
  customer_id: string;
  customer_email: string | null;
  source: string;
  // decided cases only
  decision_action: string | null;
  analyst_id: string | null;
  decided_at: string | null;
}

export interface RiskFactor {
  label: string;
  score: number;
  evidence: string;
}

export interface Investigation {
  id: string;
  transaction_id: string;
  risk_score: number;
  risk_level: string;
  fraud_type: string | null;
  confidence: string;
  summary: string;
  recommended_action: string;
  risk_factors: RiskFactor[];
  policy_rules_triggered: string[];
  retrieved_case_ids: string[];
  created_at: string;
  status: string;
  llm_provider: string;
  llm_model: string;
  // joined transaction fields
  amount_pence: number;
  currency: string;
  customer_id: string;
  customer_email: string | null;
  merchant_name: string | null;
  beneficiary_account: string | null;
  beneficiary_name: string | null;
  transfer_type: string | null;
  ip_address: string | null;
  device_fingerprint: string | null;
  geolocation: string | null;
  occurred_at: string;
  source: string;
  external_id: string;
}

export async function fetchQueue(status = "pending"): Promise<QueueItem[]> {
  const res = await fetch(`${BASE}/investigations/queue?status=${status}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch queue");
  const data = await res.json();
  return data.items as QueueItem[];
}

export async function fetchInvestigation(id: string): Promise<Investigation> {
  const res = await fetch(`${BASE}/investigations/${id}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch investigation");
  return res.json() as Promise<Investigation>;
}

export interface ChatMessage {
  id: string;
  role: "analyst" | "assistant";
  content: string;
  sources: string[];
  created_at: string;
}

export async function fetchMessages(investigationId: string): Promise<ChatMessage[]> {
  const res = await fetch(`${BASE}/investigations/${investigationId}/messages`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch messages");
  const data = await res.json();
  return data.messages as ChatMessage[];
}

export async function sendMessage(
  investigationId: string,
  question: string
): Promise<ChatMessage> {
  const res = await fetch(`${BASE}/investigations/${investigationId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  if (!res.ok) throw new Error("Failed to send message");
  return res.json() as Promise<ChatMessage>;
}

export interface EntityTransaction {
  transaction_id: string;
  investigation_id: string | null;
  customer_id: string;
  customer_email: string | null;
  amount_pence: number;
  currency: string;
  beneficiary_name: string | null;
  beneficiary_account: string | null;
  device_fingerprint: string | null;
  ip_address: string | null;
  geolocation: string | null;
  risk_level: string;
  risk_score: number;
  fraud_type: string | null;
  confidence: string | null;
  status: string | null;
  recommended_action: string | null;
  decision_action: string | null;
  analyst_id: string | null;
  occurred_at: string;
  decided_at: string | null;
}

export interface EntityResult {
  entity_type: string;
  entity_value: string;
  transactions: EntityTransaction[];
  summary: {
    total_transactions: number;
    total_exposure_pence: number;
    unique_customers: number;
    pending: number;
    decided: number;
  };
}

export async function fetchEntity(type: string, value: string): Promise<EntityResult> {
  const res = await fetch(
    `${BASE}/entities/${type}?value=${encodeURIComponent(value)}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error("Failed to fetch entity");
  return res.json();
}

export interface AuditEntry {
  decision_id: string;
  action: string;
  analyst_id: string;
  analyst_notes: string | null;
  override_reason: string | null;
  claim_reference: string | null;
  ai_recommended_action: string;
  risk_score: number;
  decided_at: string;
  investigation_id: string;
  fraud_type: string | null;
  confidence: string;
  summary: string;
  transaction_id: string;
  external_id: string;
  amount_pence: number;
  currency: string;
  customer_id: string;
  customer_email: string | null;
  source: string;
  occurred_at: string;
  beneficiary_name: string | null;
  beneficiary_account: string | null;
}

export interface AuditLog {
  entries: AuditEntry[];
  total: number;
  overrides: number;
}

export async function fetchAuditLog(): Promise<AuditLog> {
  const res = await fetch(`${BASE}/audit`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch audit log");
  return res.json();
}

export async function submitDecision(
  payload: {
    transaction_id: string;
    action: string;
    analyst_notes?: string;
    override_reason?: string;
    claim_reference?: string;
  },
  analystId: string
): Promise<void> {
  const res = await fetch(`${BASE}/decisions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-analyst-id": analystId,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Failed to submit decision");
  }
}
