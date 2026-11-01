const branchMarks = {
  cse: { label: "Computer chip and connected code nodes", accent: "#7c83ff" },
  da: { label: "Neural network and data graph", accent: "#22c7b8" },
  ece: { label: "Microchip and communication wave", accent: "#42b8ff" },
  ec: { label: "Microchip and communication wave", accent: "#42b8ff" },
  ee: { label: "Electrical lightning and circuit path", accent: "#ffc857" },
  me: { label: "Mechanical gear and turbine", accent: "#ff7d67" },
  ce: { label: "Structural bridge and geometry", accent: "#d8a15d" },
  in: { label: "Instrumentation gauge and sensor", accent: "#b88cff" },
  ch: { label: "Chemical flask and molecule", accent: "#6edb8d" },
  bt: { label: "DNA helix and biological cell", accent: "#ef78ad" },
  xe: { label: "Interconnected engineering disciplines", accent: "#9aa7bd" },
  xl: { label: "Life science leaf and cell", accent: "#66c58b" },
  ph: { label: "Atomic orbitals and physics geometry", accent: "#74b9ff" },
  cy: { label: "Chemical molecular bonds", accent: "#f08c62" },
  ma: { label: "Mathematical geometry and infinity", accent: "#c29bff" },
  ar: { label: "Architectural geometric structure", accent: "#e5aa72" },
  ag: { label: "Agricultural crop and engineering lines", accent: "#9bcf58" },
  es: { label: "Environmental earth and sustainability", accent: "#56c7a4" },
  ge: { label: "Geospatial grid and coordinates", accent: "#63a9ff" },
  nm: { label: "Naval ship and navigation", accent: "#65c8d8" },
  pe: { label: "Petroleum drilling and energy", accent: "#f1a94b" },
  pi: { label: "Production gears and system flow", accent: "#e57b8d" },
  tf: { label: "Textile weave and fibre pattern", accent: "#d98de8" },
  st: { label: "Statistics distribution and probability graph", accent: "#83b8ff" },
  ey: { label: "Ecology leaf and evolution spiral", accent: "#77c77a" },
  gg: { label: "Geological strata and earth layers", accent: "#c68b62" }
};

function Mark({ code, color }) {
  const common = { fill: "none", stroke: color, strokeWidth: 2.4, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (code) {
    case "cse": return <><rect x="17" y="17" width="30" height="30" rx="6" {...common} /><path d="M24 27l-5 5 5 5M40 27l5 5-5 5M32 24l-4 16" {...common} /><circle cx="12" cy="21" r="2" fill={color}/><circle cx="52" cy="43" r="2" fill={color}/></>;
    case "da": return <><circle cx="32" cy="32" r="8" {...common}/><circle cx="15" cy="18" r="4" {...common}/><circle cx="49" cy="18" r="4" {...common}/><circle cx="15" cy="47" r="4" {...common}/><circle cx="49" cy="47" r="4" {...common}/><path d="M19 20l7 8M45 20l-7 8M19 45l7-7M45 45l-7-7" {...common}/></>;
    case "ece": case "ec": return <><rect x="18" y="19" width="28" height="26" rx="4" {...common}/><path d="M12 25h6M12 32h6M12 39h6M46 25h6M46 32h6M46 39h6M25 13v6M32 13v6M39 13v6M25 45v6M32 45v6M39 45v6M24 32h5l4-7 4 14 4-7h4" {...common}/></>;
    case "ee": return <><path d="M35 10L20 32h11l-4 22 17-28H33z" {...common}/><path d="M10 44h8M46 20h8M12 20l5 5M47 43l-5-5" {...common}/></>;
    case "me": return <><circle cx="32" cy="32" r="15" {...common}/><circle cx="32" cy="32" r="5" {...common}/><path d="M32 7v8M32 49v8M7 32h8M49 32h8M14 14l6 6M44 44l6 6M50 14l-6 6M20 44l-6 6" {...common}/></>;
    case "ce": return <><path d="M11 47h42M16 47V27M48 47V27M16 29c9-13 23-13 32 0M22 31v16M32 25v22M42 31v16" {...common}/><path d="M9 22h46" {...common}/></>;
    case "in": return <><circle cx="32" cy="32" r="18" {...common}/><path d="M32 32l10-9M19 44h26M24 50h16" {...common}/><path d="M32 14v5M18 22l4 4M46 22l-4 4" {...common}/></>;
    case "ch": return <><path d="M27 11h10M29 11v13l-12 22a4 4 0 004 6h22a4 4 0 004-6L35 24V11" {...common}/><circle cx="25" cy="40" r="3" {...common}/><circle cx="37" cy="34" r="3" {...common}/><path d="M28 39l7-4" {...common}/></>;
    case "bt": return <><path d="M24 10c17 7 17 37 0 44M40 10c-17 7-17 37 0 44M24 16h16M21 25h22M21 35h22M24 44h16" {...common}/></>;
    case "xe": return <><path d="M32 10l8 14 15 8-15 8-8 14-8-14-15-8 15-8z" {...common}/><circle cx="32" cy="32" r="5" {...common}/></>;
    case "xl": case "ey": return <><path d="M32 52C13 42 13 19 32 11c19 8 19 31 0 41z" {...common}/><path d="M32 48V16M32 34l-9-8M32 40l10-9" {...common}/></>;
    case "ph": return <><ellipse cx="32" cy="32" rx="23" ry="10" {...common}/><ellipse cx="32" cy="32" rx="23" ry="10" transform="rotate(60 32 32)" {...common}/><ellipse cx="32" cy="32" rx="23" ry="10" transform="rotate(120 32 32)" {...common}/><circle cx="32" cy="32" r="3" fill={color}/></>;
    case "cy": return <><circle cx="22" cy="25" r="7" {...common}/><circle cx="43" cy="19" r="6" {...common}/><circle cx="42" cy="44" r="8" {...common}/><path d="M28 22l9-2M26 30l11 10M43 25v11" {...common}/></>;
    case "ma": return <><path d="M11 44l15-28 12 22 9-16M14 49h36" {...common}/><path d="M15 20h10M40 13h10" {...common}/></>;
    case "ar": return <><path d="M12 49h40M17 49V27l15-14 15 14v22M25 49V35h14v14M32 13v-5" {...common}/><path d="M13 27h38" {...common}/></>;
    case "ag": return <><path d="M32 51V27M32 34c-12 0-17-7-17-16 10 0 17 5 17 16zM32 40c12 0 17-7 17-16-10 0-17 5-17 16z" {...common}/><path d="M12 51h40" {...common}/></>;
    case "es": return <><circle cx="32" cy="32" r="21" {...common}/><path d="M32 11c-8 9-8 33 0 42M11 32h42M16 20h32M16 44h32" {...common}/><path d="M50 12c-8 0-10 5-10 10 6 0 10-3 10-10z" {...common}/></>;
    case "ge": return <><path d="M12 18l40-6v34l-40 8zM12 30l40-5M12 42l40-5M25 16v37M39 14v37" {...common}/><circle cx="39" cy="25" r="4" fill={color}/></>;
    case "nm": return <><path d="M10 40h42l-7 8H18zM18 40l6-15h14l7 15M31 25V12h9M40 12l9 8" {...common}/><path d="M12 54c5-4 10 4 15 0s10 4 15 0 8 3 12 0" {...common}/></>;
    case "pe": return <><path d="M26 10h12M29 10v12l-8 24h22l-8-24V10M15 28h34M32 22v-7" {...common}/><path d="M32 32v14M25 39h14" {...common}/></>;
    case "pi": return <><circle cx="23" cy="32" r="11" {...common}/><circle cx="43" cy="32" r="7" {...common}/><path d="M34 32h2M23 21v22M12 32h22M43 25v14M36 32h14" {...common}/></>;
    case "tf": return <><path d="M12 18h40M12 32h40M12 46h40M18 12v40M32 12v40M46 12v40" {...common}/><path d="M12 18l40 28M12 46l40-28" {...common}/></>;
    case "st": return <><path d="M10 50h44M14 44l10-12 8 6 14-22" {...common}/><path d="M14 44v-8M24 32v-8M34 38v-8M46 16v-8" {...common}/><circle cx="46" cy="16" r="3" fill={color}/></>;
    case "gg": return <><path d="M10 18c8-7 15 7 22 0s14 7 22 0M10 29c8-7 15 7 22 0s14 7 22 0M10 40c8-7 15 7 22 0s14 7 22 0M10 51c8-7 15 7 22 0s14 7 22 0" {...common}/></>;
    default: return <><circle cx="32" cy="32" r="20" {...common}/><path d="M22 32h20M32 22v20" {...common}/></>;
  }
}

export default function BranchLogo({ slug, name, size = 72, className = "" }) {
  const code = String(slug || "").toLowerCase();
  const mark = branchMarks[code] || branchMarks[code === "electronics-and-communication-engineering" ? "ece" : code];
  const accent = mark?.accent || "var(--accent)";
  const label = mark?.label || `${name || "Branch"} identity`;
  return <span className={`branch-logo ${className}`} style={{ "--branch-accent": accent }} aria-label={`${name || "Branch"} logo: ${label}`} role="img"><svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true"><circle cx="32" cy="32" r="29" fill="color-mix(in srgb, var(--branch-accent) 10%, transparent)" stroke="color-mix(in srgb, var(--branch-accent) 45%, transparent)" strokeWidth="1" /><Mark code={code} color="var(--branch-accent)" /></svg></span>;
}
