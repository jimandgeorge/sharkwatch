"use client";

import { useId } from "react";

// EIGG mark: one complete circle, split by an off-centre gap into two zones —
// a FILLED zone (the contained/decided part) and an OUTLINED zone (the open
// boundary; the curved stroke reads as a shoreline). Both use currentColor, so
// the mark adapts to any background via text-* / style.
export default function Logo({
  size = 24,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  const id = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      className={className}
      role="img"
      aria-label="EIGG"
    >
      <clipPath id={id}>
        <rect x="0" y="0" width="185" height="512" />
      </clipPath>
      {/* left zone — filled */}
      <circle cx="256" cy="256" r="248" fill="currentColor" clipPath={`url(#${id})`} />
      {/* right zone — outline only (water edge) */}
      <path
        d="M209 12.5 A248 248 0 1 1 209 499.5 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="14"
        strokeLinejoin="round"
      />
    </svg>
  );
}
