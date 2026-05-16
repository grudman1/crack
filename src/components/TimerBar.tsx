import { cn } from '@/lib/utils';

interface TimerBarProps {
  remaining: number;
  total: number;
  className?: string;
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

export function TimerBar({ remaining, total, className }: TimerBarProps) {
  const pct = Math.max(0, Math.min(100, (remaining / total) * 100));

  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-baseline justify-between font-sans text-xs text-muted">
        <span>{fmt(remaining)} left</span>
        <span className="tabular-nums">{fmt(total)}</span>
      </div>
      <div className="mt-1 h-[3px] w-full bg-hairline">
        <div
          className="h-full bg-accent transition-[width] duration-1000 ease-linear"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
