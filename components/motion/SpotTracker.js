"use client";

import { useEffect } from "react";

// One delegated listener feeds the pointer position to every .spot / .row on the page.
export default function SpotTracker() {
  useEffect(() => {
    if (!window.matchMedia("(hover: hover)").matches) return undefined;
    let frame = 0;
    let last = null;
    const apply = () => {
      frame = 0;
      const { x, y, target } = last;
      const node = target?.closest?.(".spot, a.row");
      if (!node) return;
      const box = node.getBoundingClientRect();
      node.style.setProperty("--mx", `${x - box.left}px`);
      node.style.setProperty("--my", `${y - box.top}px`);
    };
    const onMove = (event) => {
      last = { x: event.clientX, y: event.clientY, target: event.target };
      if (!frame) frame = window.requestAnimationFrame(apply);
    };
    document.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      document.removeEventListener("pointermove", onMove);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);
  return null;
}
