import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

export default function Index() {
  return (
    <motion.div
      className="frame py-8 text-center"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <h1 className="font-serif text-[44px] font-bold leading-none tracking-tight text-ink">Crack</h1>
      <p className="mt-3 font-serif italic text-muted">the name game</p>

      <p className="mx-auto mt-10 max-w-xs font-sans text-sm leading-relaxed text-ink">
        Twenty-six pairs of initials. Name a famous person whose initials match each pair. Wikipedia is the referee.
      </p>

      <div className="mt-10 flex flex-col items-center gap-3">
        <Link to="/solo" className="btn-primary w-56 justify-center">
          Play solo <ArrowRight className="ml-2 h-4 w-4" strokeWidth={2.25} />
        </Link>
        <Link to="/mp" className="btn-ghost w-56 justify-center">
          Multiplayer
        </Link>
      </div>

      <Link to="/how" className="mt-10 inline-block font-sans text-sm text-muted underline-offset-4 hover:text-ink hover:underline">
        How to play
      </Link>
    </motion.div>
  );
}
