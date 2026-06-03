"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ToastProps {
  message: string;
  visible: boolean;
  onDone: () => void;
  type?: "success" | "error";
  duration?: number;
}

export default function Toast({ message, visible, onDone, type = "success", duration = 3500 }: ToastProps) {
  useEffect(() => {
    if (!visible) return;
    const id = setTimeout(onDone, duration);
    return () => clearTimeout(id);
  }, [visible, duration, onDone]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0,  scale: 1 }}
          exit={{    opacity: 0, y: 8,   scale: 0.97 }}
          transition={{ duration: 0.2, ease: "easeOut" as const }}
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border text-[13px] font-medium ${
            type === "success"
              ? "bg-white border-zinc-200 text-zinc-800"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          {type === "success" ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 text-emerald-500">
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 text-red-500">
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M8 5v4M8 11v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          )}
          {message}
          <button onClick={onDone} className="ml-1 text-zinc-400 hover:text-zinc-600 transition-colors">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
