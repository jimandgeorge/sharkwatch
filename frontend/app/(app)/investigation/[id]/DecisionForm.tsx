"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { submitDecision, fetchNextClaimRef } from "@/lib/api";
import Toast from "@/components/Toast";
import PSRPackButton from "./PSRPackButton";

const STORAGE_KEY = "sw-analyst-id";

const ACTIONS = [
  {
    value: "approve",
    label: "Approve",
    key: "A",
    base: "border-emerald-200 text-emerald-700 hover:bg-emerald-50",
    selected: "bg-emerald-50 ring-1 ring-emerald-300",
  },
  {
    value: "hold",
    label: "Hold",
    key: "H",
    base: "border-amber-200 text-amber-700 hover:bg-amber-50",
    selected: "bg-amber-50 ring-1 ring-amber-300",
  },
  {
    value: "step_up_verification",
    label: "Step-up",
    key: "S",
    base: "border-blue-200 text-blue-700 hover:bg-blue-50",
    selected: "bg-blue-50 ring-1 ring-blue-300",
  },
  {
    value: "escalate",
    label: "Escalate",
    key: "E",
    base: "border-orange-200 text-orange-700 hover:bg-orange-50",
    selected: "bg-orange-50 ring-1 ring-orange-300",
  },
  {
    value: "freeze_account",
    label: "Freeze account",
    key: "F",
    base: "border-red-200 text-red-700 hover:bg-red-50",
    selected: "bg-red-50 ring-1 ring-red-300",
  },
];

const KEY_MAP: Record<string, string> = Object.fromEntries(
  ACTIONS.map((a) => [a.key.toLowerCase(), a.value])
);

const inputCls =
  "w-full bg-white border border-zinc-300 rounded-md px-3 py-2 text-[13px] text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 focus:border-zinc-400 transition-colors";

export default function DecisionForm({
  transactionId,
  investigationId,
  recommendedAction,
}: {
  transactionId: string;
  investigationId: string;
  recommendedAction: string;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const sessionIdentity = session?.user?.email ?? session?.user?.name ?? null;

  const [action, setAction] = useState(recommendedAction);
  const [claimRef, setClaimRef] = useState("");
  const [notes, setNotes] = useState("");
  const [analystId, setAnalystId] = useState("");
  const [remembered, setRemembered] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState(false);

  useEffect(() => {
    if (sessionIdentity) {
      setAnalystId(sessionIdentity);
    } else {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) { setAnalystId(stored); setRemembered(true); }
    }
  }, [sessionIdentity]);

  useEffect(() => {
    fetchNextClaimRef()
      .then(ref => setClaimRef(ref))
      .catch(() => { /* leave blank, backend will assign on submit */ });
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || e.metaKey || e.ctrlKey) return;
      const mapped = KEY_MAP[e.key.toLowerCase()];
      if (mapped) {
        e.preventDefault();
        setAction(mapped);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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
          claim_reference: claimRef.trim() || undefined,
        },
        analystId.trim()
      );
      setSubmitted(action);
      setToast(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Submission failed.");
      setSubmitting(false);
    }
  }

  if (submitted) {
    const a = ACTIONS.find((x) => x.value === submitted);
    return (
      <>
        <Toast
          visible={toast}
          message={`Decision recorded — ${a?.label ?? submitted}`}
          onDone={() => setToast(false)}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="flex flex-col gap-3 py-4"
        >
          <PSRPackButton investigationId={investigationId} />
          <button
            onClick={() => { router.push("/queue"); router.refresh(); }}
            className="w-full px-4 py-2.5 rounded-md text-[13px] text-zinc-500 hover:text-zinc-700 transition-colors text-center"
          >
            ← Back to queue
          </button>
        </motion.div>
      </>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-[10px] font-medium text-zinc-400 uppercase tracking-widest mb-2.5">
          Action
        </label>
        <div className="flex flex-wrap gap-2">
          {ACTIONS.map((a) => (
            <button
              key={a.value}
              type="button"
              onClick={() => setAction(a.value)}
              className={`relative pl-3 pr-3 py-1.5 text-[12px] rounded-md border font-medium transition-colors ${a.base} ${
                action === a.value ? a.selected : ""
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                <kbd className="inline-flex items-center justify-center w-4 h-4 rounded text-[9px] font-bold bg-black/20 border border-current/20 opacity-50">
                  {a.key}
                </kbd>
                {a.label}
              </span>
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
          <label className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest">
            Analyst ID{" "}
            {!sessionIdentity && <span className="text-red-500/60 normal-case font-normal tracking-normal">required</span>}
          </label>
          {sessionIdentity
            ? <span className="text-[10px] text-emerald-600">verified by session</span>
            : remembered && <span className="text-[10px] text-zinc-600">remembered</span>
          }
        </div>
        <input
          type="text"
          value={analystId}
          onChange={(e) => !sessionIdentity && handleAnalystIdChange(e.target.value)}
          readOnly={!!sessionIdentity}
          placeholder="e.g. jsmith"
          className={`${inputCls} ${sessionIdentity ? "bg-zinc-50 text-zinc-500 cursor-default" : ""}`}
        />
      </div>

      <div>
        <label className="block text-[10px] font-medium text-zinc-400 uppercase tracking-widest mb-1.5">
          Claim reference <span className="normal-case font-normal tracking-normal text-zinc-700">(PSR / internal ref)</span>
        </label>
        <input
          type="text"
          value={claimRef}
          onChange={(e) => setClaimRef(e.target.value)}
          placeholder="e.g. PSR-2024-00142"
          className={inputCls}
        />
      </div>

      <div>
        <label className="block text-[10px] font-medium text-zinc-400 uppercase tracking-widest mb-1.5">
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
        <p className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="bg-[#10B981] hover:bg-[#0CA678] disabled:opacity-40 text-white text-[13px] font-medium rounded-md px-6 py-2.5 transition-colors"
      >
        {submitting ? "Submitting…" : "Submit Decision"}
      </button>
    </form>
  );
}
