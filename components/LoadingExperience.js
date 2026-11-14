"use client";

export default function LoadingExperience({ message = "Loading…", overlay = false }) {
  return (
    <div className={overlay ? "loading-overlay" : "flex justify-center py-10"} role="status" aria-live="polite">
      <div className="flex items-center gap-3 text-sm text-slate-400">
        <span aria-hidden="true" className="spinner" />
        <span>{message}</span>
      </div>
    </div>
  );
}
