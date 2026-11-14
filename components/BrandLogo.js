// Flat EDUorbit mark: a planet with one tilted orbit passing in front of it.
// One ink colour plus the accent, no gradients, crisp from 16px upwards.
export default function BrandLogo({ size = 28, className = "", title = "EDUorbit logo" }) {
  const a11y = title ? { role: "img", "aria-label": title } : { "aria-hidden": true };
  return (
    <svg className={className} height={size} viewBox="0 0 32 32" width={size} xmlns="http://www.w3.org/2000/svg" {...a11y}>
      <g transform="rotate(-24 16 16)">
        <ellipse cx="16" cy="16" fill="none" rx="14.5" ry="5" stroke="var(--accent)" strokeWidth="1.9" />
        <circle cx="16" cy="16" fill="currentColor" r="7.2" />
        <path d="M1.5 16a14.5 5 0 0 0 29 0" fill="none" stroke="var(--background)" strokeWidth="4.4" />
        <path d="M1.5 16a14.5 5 0 0 0 29 0" fill="none" stroke="var(--accent)" strokeLinecap="round" strokeWidth="1.9" />
      </g>
    </svg>
  );
}

// Mark + wordmark, used in the site header, footer and auth pages.
export function BrandWordmark({ size = 24, className = "" }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <BrandLogo size={size} title="" />
      <span className="text-[17px] font-semibold tracking-[-.02em]">EDUorbit</span>
    </span>
  );
}
