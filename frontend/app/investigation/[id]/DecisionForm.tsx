"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { submitDecision } from "@/lib/api";

const STORAGE_KEY = "sw-analyst-id";

const ACTIONS = [
  {
    value: "approve",
    label: "Approve",
    base: "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10",
    selected: "bg-emerald-500/10 ring-1 ring-emerald-500/30",
  },
  {
    value: "hold",
    label: "Hold",
    base: "border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10",
    selected: "bg-yellow-500/10 ring-1 ring-yellow-500/30",
  },
  {
    value: "step_up_verification",
    label: "Step-up",
    base: "border-blue-500/30 text-blue-400 hover:bg-blue-500/10",
    selected: "bg-blue-500/10 ring-1 ring-blue-500/30",
  },
  {
    value: "escalate",
    label: "Escalate",
    base: "border-orange-500/30 text-orange-400 hover:bg-orange-500/10",
    selected: "bg-orange-500/10 ring-1 ring-orange-500/30",
  },
  {
    value: "freeze_account",
    label: "Freeze account",
    base: "border-red-500/30 text-red-400 hover:bg-red-500/10",
    selected: "bg-red-500/10 ring-1 ring-red-500/30",
  },
];

const inputCls =
  "w-full bg-zinc-900 border border-zinc-700/80 rounded-md px-3 py-2 text-[13px] text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#5E6AD2] focus:border-[#5E6AD2] transition-colors";

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
  const [remembered, setRemembered] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setAnalystId(stored);
      setRemembered(true);
    }
  }, []);

  function handleAnalystIdChange(val: string) {
    setAnalystId(val);
    setRemembered(false);
    if (val.trim()) localStorage.setItem(STORAGE_KEY, val.trim());
  }

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
              ? `Overrode AI recommendation (${recommendedAction})`
              : undefined,
        },
        analystId.trim()
      );
      setSubmitted(action);
      setTimeout(() => {
        router.push("/queue");
        router.refresh();
      }, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Submission failed.");
      setSubmitting(false);
    }
  }

  if (submitted) {
    const a = ACTIONS.find((x) => x.value === submitted);
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <div className={`text-[14px] font-medium ${a?.base.match(/text-\S+/)?.[0] ?? "text-zinc-200"}`}>
          Decision recorded — {a?.label ?? submitted}
        </div>
        <div className="text-[12px] text-zinc-600">Returning to queue…</div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-[10px] font-medium text-zinc-600 uppercase tracking-widest mb-2.5">
          Action
        </label>
        <div className="flex flex-wrap gap-2">
          {ACTIONS.map((a) => (
            <button
              key={a.value}
              type="button"
              onClick={() => setAction(a.value)}
              className={`px-3 py-1.5 text-[12px] rounded-md border font-medium transition-colors ${a.base} ${
                action === a.value ? a.selected : ""
              }`}
            >
              {a.label}
              {a.value === recommendedAction && action !== a.value && (
                <span className="ml-1.5 text-[10px] opacity-40">AI</span>
              )}
            </button>
          ))}
        </div>
        {action !== recommendedAction && (
          <p className="mt-2 text-[11px] text-yellow-600">
            Overriding AI recommendation: {recommendedAction}
          </p>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[10px] font-medium text-zinc-600 uppercase tracking-widest">
            Analyst ID{" "}
            <span className="text-red-500/60 normal-case font-normal tracking-normal">required</span>
          </label>
          {remembered && (
            <span className="text-[10px] text-zinc-600">remembered</span>
          )}
        </div>
        <input
          type="text"
          value={analystId}
          onChange={(e) => handleAnalystIdChange(e.target.value)}
          placeholder="e.g. jsmith"
          className={inputCls}
        />
      </div>

      <div>
        <label className="block text-[10px] font-medium text-zinc-600 uppercase tracking-widest mb-1.5">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Reasoning, evidence reviewed, customer contact..."
          className={`${inputCls} resize-none`}
        />
      </div>

      {error && (
        <p className="text-[12px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-[#5E6AD2] hover:bg-[#6E7AE2] disabled:opacity-40 text-white text-[13px] font-medium rounded-md px-4 py-2.5 transition-colors"
      >
        {submitting ? "Submitting…" : "Submit Decision"}
      </button>
    </form>
  );
}
