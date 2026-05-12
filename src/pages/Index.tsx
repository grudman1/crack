import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ScrabbleTile } from '@/components/ScrabbleTile';

const TITLE = ['C', 'R', 'A', 'C', 'K'];
const ROTATE = [-3, 2, -1, 2, -2];

export default function Index() {
  return (
    <motion.div
      className="mx-auto max-w-2xl px-6 py-12 text-center"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      <div className="flex justify-center gap-2 mb-4">
        {TITLE.map((letter, i) => (
          <ScrabbleTile key={i} letter={letter} size="lg" rotate={ROTATE[i]} animate delay={i * 0.08} />
        ))}
      </div>

      <div className="font-hand text-3xl text-ink-soft mb-1">the name game</div>
      <svg viewBox="0 0 200 12" className="mx-auto h-3 w-40 text-ink-soft" aria-hidden="true">
        <path
          d="M 4 7 Q 30 1 60 6 T 120 7 T 196 5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>

      <p className="font-body text-ink-soft mt-6 max-w-md mx-auto">
        Twenty-six pairs of initials. Name a famous person for each. Wikipedia is the referee.
      </p>

      <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
        <Link to="/solo" className="btn-paper btn-paper--primary text-lg">
          Play Solo
        </Link>
        <Link to="/mp" className="btn-paper text-lg">
          Multiplayer
        </Link>
      </div>

      <Link to="/how" className="font-hand text-xl text-ink-soft mt-6 inline-block underline">
        how to play →
      </Link>
    </motion.div>
  );
}
