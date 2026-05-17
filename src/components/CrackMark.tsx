// Crack brand mark — a mini-grid showing three letter pairs, mirroring
// the gameplay grid. Middle row is orange (the signature touch). Used
// as the wordmark companion on the homepage and as the favicon source.
//
// Rendered as inline SVG so it scales perfectly and inherits crisply
// from the design tokens (no PNG raster artifacts).

import { cn } from '@/lib/utils';

interface CrackMarkProps {
  size?: number;
  className?: string;
}

export function CrackMark({ size = 80, className }: CrackMarkProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 80 80"
      width={size}
      height={size}
      role="img"
      aria-label="Crack"
      className={cn('inline-block', className)}
    >
      <rect x="0.5" y="0.5" width="79" height="79" rx="8" fill="#fffdf7" stroke="#e8e6dc" strokeWidth="1" />
      <g fontFamily="Georgia, 'Times New Roman', serif" fontWeight="700" textAnchor="middle">
        <text x="40" y="28" fontSize="13" fill="#121212">A · T</text>
        <text x="40" y="46" fontSize="13" fill="#e8743b">B · H</text>
        <text x="40" y="64" fontSize="13" fill="#121212">C · E</text>
      </g>
    </svg>
  );
}
