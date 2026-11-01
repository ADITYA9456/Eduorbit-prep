export default function BrandLogo({ size = 28, className = "" }) {
  return (
    <svg
      aria-label="EDUorbit logo"
      className={className}
      height={size}
      role="img"
      viewBox="0 0 64 64"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="eduorbit-planet" x1="18" x2="48" y1="14" y2="50" gradientUnits="userSpaceOnUse">
          <stop stopColor="#c4b5fd" />
          <stop offset="1" stopColor="#6366f1" />
        </linearGradient>
        <linearGradient id="eduorbit-ring" x1="8" x2="56" y1="20" y2="46" gradientUnits="userSpaceOnUse">
          <stop stopColor="#818cf8" />
          <stop offset=".5" stopColor="#c4b5fd" />
          <stop offset="1" stopColor="#6366f1" />
        </linearGradient>
      </defs>
      <ellipse cx="32" cy="34" fill="none" rx="27" ry="11" stroke="url(#eduorbit-ring)" strokeWidth="3.2" transform="rotate(-25 32 34)" />
      <circle cx="32" cy="32" fill="#0b1020" r="13" />
      <path d="M20 34c3-8 9-13 16-14 3 3 5 7 6 12-5 5-11 8-18 8-2-2-3-4-4-6Z" fill="url(#eduorbit-planet)" opacity=".95" />
      <path d="M18 37c7 3 15 3 24-1" fill="none" opacity=".55" stroke="#e0e7ff" strokeLinecap="round" strokeWidth="1.5" />
    </svg>
  );
}
