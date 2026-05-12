import { ScrabbleTile } from '@/components/ScrabbleTile';
import { ALPHABET } from '@/services/sentenceService';

export default function DevTiles() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-8 space-y-8">
      <h1 className="font-display text-2xl uppercase">Dev: ScrabbleTile</h1>
      <section>
        <h2 className="font-hand text-2xl mb-2">All letters · sm/md/lg</h2>
        <div className="flex flex-wrap gap-2">
          {ALPHABET.map((l) => (
            <ScrabbleTile key={`sm-${l}`} letter={l} size="sm" />
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          {ALPHABET.map((l) => (
            <ScrabbleTile key={`md-${l}`} letter={l} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          {ALPHABET.map((l) => (
            <ScrabbleTile key={`lg-${l}`} letter={l} size="lg" />
          ))}
        </div>
      </section>
      <section>
        <h2 className="font-hand text-2xl mb-2">States</h2>
        <div className="flex gap-3">
          <ScrabbleTile letter="A" state="default" />
          <ScrabbleTile letter="B" state="valid" />
          <ScrabbleTile letter="C" state="invalid" />
          <ScrabbleTile letter="D" state="ghost" />
          <ScrabbleTile letter="E" rotate={-4} />
        </div>
      </section>
    </div>
  );
}
