import React from 'react';

export default function BotLogo({ className = "w-6 h-6", color = "currentColor" }) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Robot Head Body */}
      <rect 
        x="4" 
        y="6" 
        width="16" 
        height="14" 
        rx="4" 
        stroke={color} 
        strokeWidth="2.5" 
        strokeLinejoin="round"
      />
      {/* Eyes (Vertical Rects) */}
      <rect x="8.5" y="11" width="2" height="4" rx="1" fill={color} />
      <rect x="13.5" y="11" width="2" height="4" rx="1" fill={color} />
      {/* Top Antenna/Link */}
      <path 
        d="M12 6V3M10 3H14" 
        stroke={color} 
        strokeWidth="2.5" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
      {/* Small "ears" or side knobs as seen in image */}
      <path d="M4 12H2M20 12h2" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
