import { motion } from 'framer-motion';

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <h2 className="font-display text-2xl text-ink uppercase">{children}</h2>
      <svg viewBox="0 0 220 8" className="h-2 w-56 text-ink" aria-hidden="true">
        <path
          d="M 4 5 Q 30 1 60 4 T 120 4 T 216 4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

export default function HowToPlay() {
  return (
    <motion.div
      className="mx-auto max-w-2xl px-6 py-8"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      <div className="paper-card p-6">
        <h1 className="font-display text-3xl uppercase">How to play CRACK</h1>
        <p className="font-body mt-2 text-ink-soft">
          Pencil-and-paper roots, a referee from Wikipedia.
        </p>

        <Heading>The grid</Heading>
        <p className="font-body mt-2">
          Each round generates 26 rows. Column A is the alphabet (A–Z). Column B is the first 26 letters of a
          randomly-chosen English sentence (uppercased, with non-letters stripped out).
        </p>

        <Heading>Your job</Heading>
        <p className="font-body mt-2">
          For every row, name a famous person whose initials match the pair. Example: row{' '}
          <span className="font-display">AT</span> → Alan Turing. Row <span className="font-display">MC</span> →
          Marie Curie. Stretching for connections is the whole game.
        </p>

        <Heading>What counts</Heading>
        <ol className="font-body mt-2 list-decimal pl-6 space-y-1">
          <li>Must be a real person (we check Wikipedia + Wikidata).</li>
          <li>No fictional characters.</li>
          <li>Initials must match — first-name initial and last-name initial.</li>
          <li>Suffixes like Jr, Sr, II–IV don&apos;t count toward initials.</li>
          <li>Light misspellings forgive — Henry Caville → Henry Cavill is accepted.</li>
        </ol>

        <Heading>Solo scoring</Heading>
        <p className="font-body mt-2">10 points for every validated, initials-matching person.</p>

        <Heading>Multiplayer scoring</Heading>
        <ul className="font-body mt-2 list-disc pl-6 space-y-1">
          <li>10 points for a validated answer nobody else thought of.</li>
          <li>5 points for a validated answer somebody else also wrote.</li>
          <li>0 points if the table votes it down.</li>
        </ul>

        <Heading>Tips</Heading>
        <ul className="font-body mt-2 list-disc pl-6 space-y-1">
          <li>Stuck letters reward obscure musicians and Renaissance painters.</li>
          <li>Q and X are gold mines if you remember the right people.</li>
          <li>Argue politely.</li>
        </ul>
      </div>
    </motion.div>
  );
}
