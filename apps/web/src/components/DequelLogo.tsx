import React from 'react';

interface DequelLogoProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

export function DequelLogo({ className = 'h-6 w-6', ...props }: DequelLogoProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <defs>
        <linearGradient id="logo-grad-dequel" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="50%" stopColor="#ea580c" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
      </defs>
      {/* Outer loop representing "D" / left-side of deque */}
      <path
        d="M12 8H20C24.4183 8 28 11.5817 28 16C28 20.4183 24.4183 24 20 24H12"
        stroke="url(#logo-grad-dequel)"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      {/* Inner loop representing "Q" / right-side of deque */}
      <path
        d="M20 24H12C7.58172 24 4 20.4183 4 16C4 11.5817 7.58172 8 12 8H16"
        stroke="url(#logo-grad-dequel)"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray="40 10"
      />
      {/* Central node / core */}
      <circle cx="16" cy="16" r="3.5" fill="url(#logo-grad-dequel)" />
    </svg>
  );
}
