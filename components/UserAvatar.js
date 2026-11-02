"use client";

import { useEffect, useState } from "react";

export default function UserAvatar({ name, image, size = 48 }) {
  const [imageFailed, setImageFailed] = useState(false);
  const initial = (name?.trim()?.[0] || "U").toUpperCase();
  useEffect(() => setImageFailed(false), [image]);

  return (
    <div
      aria-label={name ? `${name}'s profile picture` : "User profile picture"}
      className="user-avatar"
      style={{ height: size, width: size }}
      title={name || "User"}
    >
      {image && !imageFailed ? (
        // Google profile URLs are supplied by the trusted NextAuth session.
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="" className="h-full w-full object-cover" onError={() => setImageFailed(true)} src={image} />
      ) : (
        initial
      )}
    </div>
  );
}
