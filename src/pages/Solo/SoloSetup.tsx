import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

interface SoloSetupProps {
  totalSeconds: number;
  onSetTotalSeconds: (s: number) => void;
  onStart: () => void;
}

const TIMER_OPTIONS = [
  { label: '2 min', value: 120 },
  { label: '3 min', value: 180 },
  { label: '5 min', value: 300 },
  { label: '7 min', value: 420 },
];

export function SoloSetup({ totalSeconds, onSetTotalSeconds, onStart }: SoloSetupProps) {
  return (
    <motion.div
      className="frame"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <h1 className="text-center font-serif text-[28px] font-bold leading-tight text-ink lg:text-[48px]">
        Solo
      </h1>
      <p className="mt-1 text-center font-serif italic text-muted lg:mt-3 lg:text-[20px]">
        Choose a round length
      </p>

      <div className="mt-8 flex justify-center gap-2 lg:mt-10 lg:gap-3">
        {TIMER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`btn-pill-sm !min-h-[2.5rem] !px-4 !text-[14px] ${
              totalSeconds === opt.value ? 'btn-ghost--selected' : ''
            }`}
            onClick={() => onSetTotalSeconds(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-center gap-2 font-sans text-sm text-muted">
        <label htmlFor="custom-seconds" className="text-ink">
          Custom
        </label>
        <input
          id="custom-seconds"
          type="number"
          min={30}
          max={1800}
          value={totalSeconds}
          onChange={(e) =>
            onSetTotalSeconds(Math.max(30, Math.min(1800, Number(e.target.value) || 30)))
          }
          className="input-box w-20 text-center text-ink"
        />
        <span>sec</span>
      </div>

      <div className="mt-10 flex justify-center lg:mt-14">
        <button type="button" className="btn-primary w-full max-w-[20rem]" onClick={onStart}>
          Start round <ArrowRight className="ml-2 h-4 w-4" strokeWidth={2.25} />
        </button>
      </div>
    </motion.div>
  );
}
