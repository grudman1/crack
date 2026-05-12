interface PhaseBannerProps {
  phase: string;
  className?: string;
}

export function PhaseBanner({ phase, className }: PhaseBannerProps) {
  return (
    <div className={className}>
      <span className="stamp">{phase}</span>
    </div>
  );
}
