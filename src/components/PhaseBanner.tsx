interface PhaseBannerProps {
  phase: string;
  className?: string;
}

export function PhaseBanner({ phase, className }: PhaseBannerProps) {
  return (
    <div className={className}>
      <span className="font-sans text-xs uppercase tracking-[0.12em] text-muted">{phase}</span>
    </div>
  );
}
