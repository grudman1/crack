import { motion } from 'framer-motion';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-serif text-lg font-bold text-ink">{title}</h2>
      <div className="mt-2 font-sans text-sm leading-relaxed text-ink">{children}</div>
    </section>
  );
}

export default function HowToPlay() {
  return (
    <motion.div
      className="frame"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <h1 className="font-serif text-[28px] font-bold leading-tight text-ink lg:text-[48px]">How to play</h1>
      <p className="mt-1 font-serif italic text-muted lg:mt-3 lg:text-[20px]">Pencil-and-paper roots, a referee from Wikipedia.</p>

      <Section title="The grid">
        Each round generates 26 rows. Column A is the alphabet (A–Z). Column B is the first 26 letters of a randomly-chosen
        English sentence — uppercased, with non-letters stripped out.
      </Section>

      <Section title="Your job">
        For every row, name a famous person whose initials match the pair. Example: row{' '}
        <span className="font-serif font-bold">A · T</span> → Alan Turing. Row{' '}
        <span className="font-serif font-bold">M · C</span> → Marie Curie.
      </Section>

      <Section title="What counts">
        <ol className="list-decimal space-y-1 pl-5">
          <li>Must be a real person (we check Wikipedia + Wikidata).</li>
          <li>No fictional characters.</li>
          <li>Initials must match — first-name initial and last-name initial.</li>
          <li>Suffixes like Jr, Sr, II–IV don&apos;t count toward initials.</li>
          <li>Light misspellings forgive — Henry Caville → Henry Cavill is accepted.</li>
        </ol>
      </Section>

      <Section title="Solo scoring">10 points for every validated, initials-matching person.</Section>

      <Section title="Multiplayer scoring">
        <ul className="list-disc space-y-1 pl-5">
          <li>10 points for a validated answer nobody else thought of.</li>
          <li>5 points for a validated answer somebody else also wrote.</li>
          <li>0 points if the table votes it down.</li>
        </ul>
      </Section>

      <Section title="Tips">
        <ul className="list-disc space-y-1 pl-5">
          <li>Stuck letters reward obscure musicians and Renaissance painters.</li>
          <li>Q and X are gold mines if you remember the right people.</li>
          <li>Argue politely.</li>
        </ul>
      </Section>

      <p className="mt-10 border-t border-hairline pt-4 font-sans text-xs text-muted">
        Famous-people suggestions are sourced from Wikidata (CC0) and Wikipedia (CC BY-SA). Names and descriptions are
        excerpted; click any suggestion to read the full article on Wikipedia.
      </p>
    </motion.div>
  );
}
