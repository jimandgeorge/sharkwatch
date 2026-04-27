"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitDecision } from "@/lib/api";

const ACTIONS = [
  { value: "approve",              label: "Approve",           style: "border-emerald-300 text-emerald-700 hover:bg-emerald-50" },
  { value: "hold",                 label: "Hold Payment",      style: "border-amber-300 text-amber-700 hover:bg-amber-50" },
  { value: "step_up_verification", label: "Step-up Verify",   style: "border-blue-300 text-blue-700 hover:bg-blue-50" },
  { value: "escalate",             label: "Escalate",          style: "border-orange-300 text-orange-700 hover:bg-orange-50" },
  { value: "freeze_account",       label: "Freeze Account",    style: "border-red-300 text-red-700 hover:bg-red-50" },
];

export default function DecisionForm({
  transactionId,
  recommendedAction,
}: {
  transactionId: string;
  recommendedAction: string;
}) {
  const router = useRouter();
  const [action, setAction] = useState(recommendedAction);
  const [notes, setNotes] = useState("");
  const [analystId, setAnalystId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!analystId.trim()) {
      setError("Analyst ID is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await submitDecision(
        {
          transaction_id: transactionId,
          action,
          analyst_notes: notes || undefined,
          override_reason:
            action !== recommendedAction
              ? `Analyst overrode AI recommendation (${recommendedAction})`
              : undefined,
        },
        analystId.trim()
      );
      router.push("/queue");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Submission failed.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
          Decision
        </label>
        <div className="flex flex-wrap gap-2">
          {ACTIONS.map((a) => (
            <button
              key={a.value}
              type="button"
              onClick={() => setAction(a.value)}
              className={`px-3 py-1.5 text-sm rounded border font-medium transition-colors ${a.style} ${
                action === a.value ? "ring-2 ring-offset-1 ring-current" : ""
              }`}
            >
              {a.label}
              {a.value === recommendedAction && action !== a.value && (
                <span className="ml-1 text-xs opacity-60">(AI)</span>
              )}
            </button>
          ))}
        </div>
        {action !== recommendedAction && (
          <p className="mt-1.5 text-xs text-amber-600">
            Overriding AI recommendation: {recommendedAction}
          </p>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">
          Analyst ID <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={analystId}
          onChange={(e) => setAnalystId(e.target.value)}
          placeholder="e.g. jsmith"
          className="w-full border border-slate-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Optional — reasoning, evidence reviewed, customer contact..."
          className="w-full border border-slate-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-slate-900 text-white text-sm font-medium rounded px-4 py-2.5 hover:bg-slate-700 disabled:opacity-50 transition-colors"
      >
        {submitting ? "Submitting..." : "Submit Decision"}
      </button>
    </form>
  );
}
