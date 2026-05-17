import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

export default function Index() {
  return (
    <motion.div
      className="frame py-8 text-center lg:py-0"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <h1 className="font-serif font-bold leading-none tracking-tight text-ink text-[44px] lg:text-[96px]">
        Crack
      </h1>
      <p className="mt-3 font-serif italic text-muted lg:mt-5 lg:text-[22px]">the name game</p>

      <p className="mx-auto mt-10 max-w-xs font-sans text-sm leading-relaxed text-ink lg:mt-12 lg:max-w-[32rem] lg:text-[20px] lg:leading-[1.5]">
        Twenty-six pairs of initials. Name a famous person whose initials match each pair. Wikipedia is the referee.
      </p>

      <div className="mt-10 flex flex-col items-center gap-3 lg:mt-12 lg:gap-4">
        <Link
          to="/solo"
          className="btn-primary w-56 justify-center lg:!w-[20rem] lg:!px-8 lg:!py-4 lg:!text-[17px]"
        >
          Play solo <ArrowRight className="ml-2 h-4 w-4 lg:h-5 lg:w-5" strokeWidth={2.25} />
        </Link>
        <Link
          to="/mp"
          className="btn-ghost w-56 justify-center lg:!w-[20rem] lg:!px-8 lg:!py-4 lg:!text-[17px]"
        >
          Multiplayer
        </Link>
      </div>

      <Link
        to="/how"
        className="mt-10 inline-block font-sans text-sm text-muted underline-offset-4 hover:text-ink hover:underline lg:mt-12 lg:text-base"
      >
        How to play
      </Link>
    </motion.div>
  );
}
