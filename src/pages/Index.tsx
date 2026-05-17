import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { CrackMark } from '@/components/CrackMark';
import { formatToday, getRoundNumber } from '@/services/roundCounter';

export default function Index() {
  // Read once per render. The round counter is bumped in Solo when the
  // player starts a round, so it's always fresh when they come back here.
  const roundNumber = getRoundNumber();
  const today = formatToday();

  return (
    <motion.div
      className="frame flex min-h-[calc(100vh-3rem)] flex-col items-center justify-center py-8 text-center lg:min-h-[calc(100vh-5rem)] lg:py-0"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <CrackMark size={80} className="mb-5 lg:mb-6" />

      <h1 className="font-serif font-bold leading-none tracking-tight text-ink text-[56px] lg:text-[80px]">
        Crack
      </h1>
      <p className="mx-auto mt-4 max-w-[18rem] font-sans text-base leading-snug text-ink lg:mt-5 lg:max-w-[26rem] lg:text-[18px]">
        Name a famous person for each pair of initials.
      </p>

      <div className="mt-8 flex w-full max-w-[20rem] flex-col items-stretch gap-3 lg:mt-10">
        <Link to="/solo" className="btn-primary w-full">
          Solo <ArrowRight className="ml-2 h-4 w-4" strokeWidth={2.25} />
        </Link>
        <Link to="/mp" className="btn-ghost w-full">
          Multiplayer
        </Link>
        <Link to="/how" className="btn-ghost w-full">
          How to play
        </Link>
      </div>

      <div className="mt-10 font-sans text-[13px] leading-relaxed lg:mt-12">
        <div className="text-ink">{today}</div>
        <div className="text-muted">Round No. {roundNumber}</div>
      </div>
    </motion.div>
  );
}
