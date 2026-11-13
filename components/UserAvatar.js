"use client";

import Image from "next/image";
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
        // Google profile URLs come from the NextAuth session; unoptimized avoids a remotePatterns config change.
        <Image alt="" className="h-full w-full object-cover" height={size} onError={() => setImageFailed(true)} priority src={image} unoptimized width={size} />
      ) : (
        initial
      )}
    </div>
  );
}
