"use client";

export default function SpotCard({ className = "", children, ...rest }) {
  function onMove(event) {
    const node = event.currentTarget;
    const box = node.getBoundingClientRect();
    node.style.setProperty("--mx", `${event.clientX - box.left}px`);
    node.style.setProperty("--my", `${event.clientY - box.top}px`);
  }

  return (
    <div className={`spot ${className}`} onPointerMove={onMove} {...rest}>
      {children}
    </div>
  );
}
