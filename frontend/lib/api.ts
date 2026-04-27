const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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

export async function submitDecision(
  payload: {
    transaction_id: string;
    action: string;
    analyst_notes?: string;
    override_reason?: string;
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
