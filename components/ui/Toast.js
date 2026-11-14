"use client";

import { AnimatePresence, LazyMotion, domAnimation, m, useReducedMotion } from "framer-motion";
import { Check, X } from "lucide-react";
import { useEffect } from "react";

// Small status toast. `toast` is { tone: "success" | "error", text } or null.
export default function Toast({ toast, onDismiss, duration = 3600 }) {
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(onDismiss, duration);
    return () => window.clearTimeout(timer);
  }, [toast, onDismiss, duration]);

  return (
    <LazyMotion features={domAnimation} strict>
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-4">
        <AnimatePresence>
          {toast ? (
            <m.div
              animate={{ opacity: 1, y: 0 }}
              className="pointer-events-auto flex max-w-md items-center gap-3 rounded-full border border-line bg-panel py-2.5 pl-4 pr-2 text-sm"
              exit={{ opacity: 0, y: reduce ? 0 : 6 }}
              initial={{ opacity: 0, y: reduce ? 0 : 8 }}
              key={toast.text}
              role="status"
              transition={{ duration: reduce ? 0 : 0.2, ease: [0.25, 0.8, 0.3, 1] }}
            >
              {toast.tone === "error" ? <X aria-hidden="true" className="shrink-0 text-danger" size={16} /> : <Check aria-hidden="true" className="shrink-0 text-mint" size={16} />}
              <span>{toast.text}</span>
              <button aria-label="Dismiss" className="ml-1 flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:text-foreground" onClick={onDismiss} type="button"><X aria-hidden="true" size={14} /></button>
            </m.div>
          ) : null}
        </AnimatePresence>
      </div>
    </LazyMotion>
  );
}
