import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { pointsFor } from '@/lib/tilePoints';

type Size = 'sm' | 'md' | 'lg';
type State = 'default' | 'valid' | 'invalid' | 'ghost';

const SIZES: Record<Size, { box: number; letter: number; point: number }> = {
  sm: { box: 28, letter: 17, point: 7 },
  md: { box: 44, letter: 26, point: 10 },
  lg: { box: 64, letter: 38, point: 14 },
};

export interface ScrabbleTileProps {
  letter: string;
  size?: Size;
  state?: State;
  pointValue?: number | null;
  rotate?: number;
  className?: string;
  animate?: boolean;
  delay?: number;
}

export function ScrabbleTile({
  letter,
  size = 'md',
  state = 'default',
  pointValue,
  rotate = 0,
  className,
  animate = false,
  delay = 0,
}: ScrabbleTileProps) {
  const dims = SIZES[size];
  const letterUpper = (letter || '').toUpperCase();
  const points = pointValue ?? (letterUpper ? pointsFor(letterUpper) : null);

  const baseStyle: React.CSSProperties = {
    width: dims.box,
    height: dims.box,
    transform: `rotate(${rotate}deg)`,
  };

  const tintClass =
    state === 'valid'
      ? 'after:absolute after:inset-0 after:rounded after:bg-accent-green/25 after:pointer-events-none'
      : state === 'invalid'
        ? 'after:absolute after:inset-0 after:rounded after:bg-accent-red/25 after:pointer-events-none'
        : '';

  const opacityClass = state === 'ghost' ? 'opacity-50' : '';

  const tile = (
    <div
      className={cn(
        'relative inline-flex items-center justify-center select-none',
        'bg-tile-wood text-tile-ink font-tile font-bold',
        'rounded-[4px]',
        tintClass,
        opacityClass,
        className,
      )}
      style={{
        ...baseStyle,
        boxShadow:
          'inset 1px 1px 0 rgba(255,255,255,0.45), 0 2px 0 hsl(var(--tile-wood-edge)), 0 3px 4px rgba(0,0,0,0.15)',
      }}
      aria-label={`Tile ${letterUpper}`}
    >
      <span style={{ fontSize: dims.letter, lineHeight: 1 }}>{letterUpper || ' '}</span>
      {points !== null && points !== 0 && (
        <span
          className="absolute font-tile font-bold"
          style={{
            right: dims.box * 0.1,
            bottom: dims.box * 0.04,
            fontSize: dims.point,
            lineHeight: 1,
          }}
        >
          {points}
        </span>
      )}
    </div>
  );

  if (!animate) return tile;

  return (
    <motion.div
      initial={{ y: -20, opacity: 0, rotate: 0 }}
      animate={{ y: 0, opacity: 1, rotate }}
      transition={{ duration: 0.4, delay, ease: 'easeOut' }}
      style={{ display: 'inline-block' }}
    >
      {tile}
    </motion.div>
  );
}
