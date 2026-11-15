"use client";

import { useEffect, useRef } from "react";

let shared = null;

function getObserver() {
  if (shared) return shared;
  shared = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.setAttribute("data-in", "");
        shared.unobserve(entry.target);
      }
    },
    { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
  );
  return shared;
}

export default function Reveal({ as: Tag = "div", delay = 0, className = "", children, style, ...rest }) {
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    if (typeof IntersectionObserver === "undefined") {
      node.setAttribute("data-in", "");
      return undefined;
    }
    const observer = getObserver();
    observer.observe(node);
    return () => observer.unobserve(node);
  }, []);

  return (
    <Tag className={`reveal ${className}`} ref={ref} style={{ "--d": `${delay}ms`, ...style }} {...rest}>
      {children}
    </Tag>
  );
}
