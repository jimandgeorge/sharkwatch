// Admin client — calls the same-origin /api/admin proxy (which enforces is_admin and
// forwards to the backend with the internal secret).

export interface Workspace {
  id: string;
  name: string;
  org_type: string | null;
  tier: string;
  products: string[];
  is_pilot: boolean;
  pilot_ends_at: string | null;
  status: string;
  internal_notes: string | null;
  created_at: string;
  last_active_at: string | null;
  user_count: number;
}

export interface WorkspaceUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  is_admin: boolean;
  status: string;
  last_login_at: string | null;
  created_at: string;
}

export interface WorkspaceDetail extends Omit<Workspace, "user_count"> {
  users: WorkspaceUser[];
}

export interface Invite {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  workspace_name: string;
  workspace_id: string;
}

export interface CreateResult {
  workspace_id: string;
  invite: { link: string; email: string; email_result: { stubbed: boolean; sent: boolean } } | null;
}

async function adminFetch<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const res = await fetch(`/api/admin${path}`, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.detail || `${method} ${path} failed`);
  }
  return res.json() as Promise<T>;
}

export const adminListWorkspaces = (q: { search?: string; type?: string; tier?: string } = {}) => {
  const p = new URLSearchParams();
  if (q.search) p.set("search", q.search);
  if (q.type) p.set("type", q.type);
  if (q.tier) p.set("tier", q.tier);
  const qs = p.toString();
  return adminFetch<{ workspaces: Workspace[] }>(`/workspaces${qs ? `?${qs}` : ""}`).then((d) => d.workspaces);
};

export interface CreatePayload {
  name: string;
  org_type?: string;
  products: string[];
  tier: string;
  is_pilot: boolean;
  pilot_ends_at?: string;
  internal_notes?: string;
  admin_user?: { first_name?: string; last_name?: string; email?: string };
}

export const adminCreateWorkspace = (body: CreatePayload) => adminFetch<CreateResult>("/workspaces", "POST", body);
export const adminGetWorkspace = (id: string) => adminFetch<WorkspaceDetail>(`/workspaces/${id}`);
export const adminUpdateWorkspace = (id: string, body: Partial<CreatePayload>) =>
  adminFetch(`/workspaces/${id}`, "PATCH", body);
export const adminSetStatus = (id: string, status: string) =>
  adminFetch(`/workspaces/${id}/status`, "POST", { status });
export const adminInviteUser = (id: string, email: string, role: string) =>
  adminFetch<{ link: string }>(`/workspaces/${id}/invite`, "POST", { email, role });
export const adminRemoveUser = (userId: string) => adminFetch(`/users/${userId}`, "DELETE");
export const adminListInvites = () => adminFetch<{ invites: Invite[] }>("/invites").then((d) => d.invites);
export const adminResendInvite = (id: string) => adminFetch<{ link: string }>(`/invites/${id}/resend`, "POST");

// Display helpers
export const TIERS = ["free", "starter", "growth", "scale", "enterprise"];
export const ORG_TYPES = ["fintech", "emi", "payments", "charity", "veteran_charity", "other"];
export const ORG_TYPE_LABEL: Record<string, string> = {
  fintech: "Fintech", emi: "EMI", payments: "Payment firm",
  charity: "Charity", veteran_charity: "Veteran charity", other: "Other",
};
