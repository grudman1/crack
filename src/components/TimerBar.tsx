import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface TimerBarProps {
  remaining: number; // seconds
  total: number; // seconds
  className?: string;
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

export function TimerBar({ remaining, total, className }: TimerBarProps) {
  const pct = Math.max(0, Math.min(100, (remaining / total) * 100));
  const urgent = remaining < 30;

  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-baseline justify-between">
        <span className="font-hand text-xl text-ink">{fmt(remaining)} left</span>
        <span className="font-hand text-base text-ink-soft">{fmt(total)} round</span>
      </div>
      <motion.div
        animate={urgent ? { x: [0, -1.5, 1.5, 0] } : { x: 0 }}
        transition={urgent ? { duration: 0.25, repeat: Infinity } : { duration: 0 }}
        className="relative mt-1 h-4 w-full overflow-hidden rounded-sm border-2 border-ink"
      >
        <div
          className="h-full transition-all"
          style={{
            width: `${pct}%`,
            backgroundImage:
              'repeating-linear-gradient(45deg, hsl(var(--ink) / 0.85) 0 3px, hsl(var(--ink) / 0.6) 3px 6px)',
          }}
        />
      </motion.div>
    </div>
  );
}
