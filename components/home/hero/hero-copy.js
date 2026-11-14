// Every string the homepage hero renders. Swap copy here without touching markup.
export const HERO_COPY = {
  brand: "EDUorbit",
  navLabel: "Primary",
  nav: [
    { label: "Papers", href: "/exams" },
    { label: "Features", href: "#features" },
    { label: "Workspace", href: "/dashboard" },
    { label: "Notes", href: "/notes" }
  ],
  login: { label: "Login", href: "/login" },
  navStart: { label: "Get started", href: "/exams" },
  headline: ["Past papers,", "done properly."],
  // Each entry is one line of the desktop composition; lines join into one paragraph on phones.
  subtitle: [
    "Open any GATE paper by year and shift,",
    "take computer-based tests that check each answer instantly,",
    "and keep private notes beside the questions you got wrong."
  ],
  ctaPrimary: { label: "Start practising", href: "/exams" },
  ctaSecondary: { label: "See what's inside", href: "#features" },
  menuOpen: "Open menu",
  menuClose: "Close menu",
  mobileMenuLabel: "Mobile",
  videoLabel: "Stylised globe of Earth rendered as a purple dot matrix against a starfield, slowly rotating"
};

/*
  Spec B's original strings, kept so they can be swapped back if wanted.
  They describe a fintech product ("Sellix"), which is why the EDUorbit copy above is used.
*/
export const SPEC_B_ORIGINAL = {
  brand: "Sellix",
  nav: ["Products", "Pricing", "Developers", "Resources", "Contact Sales"],
  login: "Login",
  navStart: "Get Started",
  headline: ["Cross-border", "finance"],
  subtitle: [
    "Accept payments, manage and custody your assets with ease,",
    "enjoy seamless on/off-ramping between cryptocurrencies and fiat,",
    "and explore integrated eCommerce solutions."
  ],
  ctaPrimary: "Get Started",
  ctaSecondary: "Contact Sales"
};

export const HERO_MEDIA = {
  video: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260912_104036_bd6924f6-3c8e-417e-8465-6d03c8c2e9e6.mp4",
  poster: "https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/82e7eb75-c65f-490a-99b5-f3d1cad54200.webp"
};
