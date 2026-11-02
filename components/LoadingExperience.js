"use client";

import BrandLogo from "@/components/BrandLogo";

export default function LoadingExperience({ message = "Loading...", overlay = false }) {
  return (
    <div className={overlay ? "loading-overlay" : "flex justify-center py-10"} role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3 text-sm text-slate-400">
        <div className="loading-orbit">
          <BrandLogo size={48} />
        </div>
        <span>{message}</span>
      </div>
    </div>
  );
}
