"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fetchMessages, ChatMessage, CLIENT_BASE } from "@/lib/api";

const SUGGESTIONS = [
  "Has this beneficiary account received payments from other customers?",
  "What other accounts share this device fingerprint?",
  "Has this customer made large transfers recently?",
  "Is this IP address linked to other risky transactions?",
  "Are there prior APP fraud cases with this pattern?",
];

export default function ChatPanel({ investigationId, readOnly = false }: { investigationId: string; readOnly?: boolean }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const userHasSubmitted = useRef(false);

  useEffect(() => {
    fetchMessages(investigationId)
      .then(setMessages)
      .catch(console.error)
      .finally(() => setReady(true));
  }, [investigationId]);

  useEffect(() => {
    if (!userHasSubmitted.current) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = input.trim();
    if (!q || loading) return;
    userHasSubmitted.current = true;

    const tempAnalystId = `temp-analyst-${Date.now()}`;
    const tempAssistantId = `temp-assistant-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      { id: tempAnalystId, role: "analyst", content: q, sources: [], created_at: new Date().toISOString() },
    ]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`${CLIENT_BASE}/investigations/${investigationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });

      if (!res.ok || !res.body) throw new Error("Stream failed");

      setMessages((prev) => [
        ...prev,
        { id: tempAssistantId, role: "assistant", content: "", sources: [], created_at: new Date().toISOString() },
      ]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          if (!part.startsWith("data: ")) continue;
          const event = JSON.parse(part.slice(6));

          if (event.type === "token") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === tempAssistantId ? { ...m, content: m.content + event.text } : m
              )
            );
          } else if (event.type === "done") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === tempAssistantId
                  ? { ...m, id: event.id, sources: event.sources ?? [], created_at: event.created_at }
                  : m
              )
            );
          } else if (event.type === "error") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === tempAssistantId
                  ? { ...m, content: `⚠ ${event.message ?? "Something went wrong. Please try again."}` }
                  : m
              )
            );
          }
        }
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempAnalystId && m.id !== tempAssistantId));
      setInput(q);
    } finally {
      setLoading(false);
    }
  }

  // Read-only: hide entirely if no history
  if (readOnly && ready && messages.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      {/* Thread */}
      <div className="space-y-5 max-h-[600px] overflow-y-auto pr-1">
        {!ready ? (
          <div className="space-y-4 animate-pulse">
            {[80, 55, 92].map((w, i) => (
              <div key={i}>
                <div className="h-2 w-10 bg-zinc-200 rounded mb-2" />
                <div className="h-3 rounded bg-zinc-100" style={{ width: `${w}%` }} />
                {i === 1 && <div className="h-3 rounded bg-zinc-100 mt-1.5" style={{ width: "60%" }} />}
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div>
            <p className="text-[12px] text-zinc-500 mb-3">
              Ask follow-up questions to build your evidence.
            </p>
            <div className="flex flex-col gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setInput(s)}
                  className="text-left text-[12px] text-zinc-500 hover:text-zinc-800 px-3 py-2 rounded-md border border-zinc-200 hover:border-zinc-300 bg-white hover:bg-zinc-50 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <AnimatePresence initial={false}>
          {messages.map((msg) => {
            const isWaiting =
              loading &&
              msg.role === "assistant" &&
              msg.content === "";

            if (msg.role === "analyst") {
              return (
                <motion.div key={msg.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                >
                  <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide mb-1.5">
                    Analyst
                  </p>
                  <p className="text-[13px] text-zinc-700">{msg.content}</p>
                </motion.div>
              );
            }

            return (
              <motion.div key={msg.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
              >
                <p className="text-[11px] font-medium text-[#059669] uppercase tracking-wide mb-1.5">
                  EIGG
                </p>
                {isWaiting ? (
                  <div className="flex items-center gap-1 h-5">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="w-1 h-1 rounded-full bg-zinc-300 animate-bounce"
                        style={{ animationDelay: `${i * 150}ms` }}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-[14px] text-zinc-700 leading-relaxed whitespace-pre-wrap">
                    {msg.content}
                  </p>
                )}
                {msg.sources.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {msg.sources.map((src, i) => (
                      <span
                        key={i}
                        className="text-[10px] text-zinc-500 bg-zinc-100 border border-zinc-200 rounded px-1.5 py-0.5"
                      >
                        {src}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            );
          })}
          </AnimatePresence>
        )}

        <div ref={bottomRef} />
      </div>

      {!readOnly && (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about this case…"
            disabled={loading}
            className="flex-1 bg-white border border-zinc-300 rounded-md px-3 py-2 text-[13px] text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 focus:border-zinc-400 transition-colors disabled:opacity-50 min-w-0"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-3 py-2 bg-zinc-900 hover:bg-zinc-700 disabled:opacity-40 text-white text-[12px] font-medium rounded-md transition-colors shrink-0"
          >
            Ask
          </button>
        </form>
      )}
    </div>
  );
}
