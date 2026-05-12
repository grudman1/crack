// A pool of varied English sentences — long enough that the first 26 letters
// (after stripping non-letters) form an interesting set of round initials.
export const SENTENCES: string[] = [
  'The quick brown fox jumps over the lazy dog while the cat watches with mild curiosity from the windowsill above.',
  'In the small kitchen of an old farmhouse the family gathered to play a game of names and laughter.',
  'A pencil scratched along the yellow notepad as the timer counted down the final seconds of the round.',
  'Sunday afternoons taste of warm bread coffee and the soft clatter of wooden tiles on a folded board.',
  'Famous people from history line up in your memory like books on a shelf waiting to be pulled.',
  'When the rain falls steadily on the porch roof the children invent new ways to compete with each other.',
  'Behind every great initial there is a story that someone once told around a kitchen table at dusk.',
  'Pencils sharpened erasers ready the score sheet folded twice and pinned beneath a mug of cold tea.',
  'The librarian smiled because she knew that every name on the list belonged to a person with a Wikipedia page.',
  'Across the table grandmother wrote her answers in slow careful cursive while the others raced against the clock.',
  'Music drifted from the radio old jazz and slow piano as the family argued about who counted as famous.',
  'A pair of initials can hide a poet a president a pirate or a perfectly average uncle from Ohio.',
  'Stamps and stickers and tiny gold stars decorated the winning column of the score pad each round.',
  'Trees outside the window swayed and tossed leaves like confetti onto the porch and the open notebook.',
  'My favorite player always saves the impossible letters for the last minute and then writes something wild.',
  'Quiet voices rose into laughter as the round ended and the validating phase began with a chime.',
  'Old encyclopedias still line the shelf because some answers are better looked up than guessed at.',
  'Players exchange knowing looks when the round letters spell something almost rude but not quite.',
  'Rules of the game are simple but the strategy is endless and the arguments about validity are eternal.',
  'Every initials pair is a tiny puzzle the answer to which is usually hiding behind a famous chin.',
  'Notebook paper lined in blue with a red margin running down the left side waited patiently for ink.',
  'Holiday weekends are when the family digs out the box and the timer and the worn pencil case.',
  'The first round is always slow but by the fifth everyone has found their rhythm and their favorite tricks.',
  'Wikipedia and Wikidata together form a court of arbitration for any claim made on the answer sheet.',
  'No one expected the youngest cousin to know who painted the ceiling of the famous chapel in Rome.',
  'Tea and biscuits halfway through and then the second round always plays out faster than the first.',
  'The dog under the table sighed deeply because it had heard these arguments many times before.',
  'Inventors actors saints scientists and one or two infamous villains all qualify as fair game.',
  'Round letters are drawn from a long sentence that no one reads aloud until the very end of the round.',
  'Pages flutter back to earlier rounds when someone insists their answer was unfairly disqualified.',
  'A perfect score requires both a long memory and a willingness to gamble on obscure French composers.',
  'Cousins compare notes and accuse one another of cheating without any evidence whatsoever.',
  'Beneath the lamp the page glowed yellow and the pencil left a satisfying graphite line on every row.',
  'The hostess of the game keeps her notebook in a drawer beside the silverware and only brings it out on holidays.',
  'I once watched my uncle invent an entirely fictional person and somehow get away with it for two rounds.',
  'Vintage paperback biographies stacked on the kitchen counter became reference material between rounds.',
  'The chime that ends the round always sounds like a tiny brass bell in a quiet hallway.',
  'Snow outside and warmth inside and the gentle scratch of pencils on paper marked our best winter game ever.',
  'Family lore says my grandmother once scored a perfect twenty six valid names in a single round.',
  'Open windows let summer wind move the curtain and the score sheet pinned beneath a coffee mug.',
  'Players in the multiplayer mode never see one another answers until the validating phase begins.',
  'Initials chase initials around the page like small wooden tiles spilled across a hardwood floor.',
  'Knowing one good musician for every letter of the alphabet is a useful skill in this household.',
  'Underline your favorite answer twice and let everyone know you are particularly proud of that one.',
  'Carefully chosen words from old letters drawn at random give the game its endlessly fresh starting positions.',
  'A round of CRACK is always best played with at least one elderly relative and one disagreeable teenager.',
  'Brown sugar and butter and the smell of cookies baking nearby is the perfect backdrop to a heated round.',
  'Even the dog has a tile pattern on its collar and a name beginning with a hard consonant.',
  'My sister insists that fictional characters should count and the rest of us refuse to consider it.',
  'Lemonade in summer cider in autumn cocoa in winter the seasons rotate around the same wooden table.',
  'Several rounds in someone always says we should keep score over a whole year and then forgets.',
  'Distant cousins joining by video call complain about the time difference and then proceed to win anyway.',
  'Polished wooden tiles arranged in alphabetical order make a satisfying clicking noise as you sweep them up.',
  'Players agree before each round whether middle initials count or whether the rules are strictly two letter.',
  'Yellow legal pads are the only acceptable paper because anything else feels wrong in your hand.',
  'Tomorrow we will play again and somebody else will win and we will all argue about it again.',
  'A bowl of clementines sits on the table within reach and gets quietly emptied during a long round.',
  'My favorite round produced the impossible pairing of double X and somehow the answer was Xavier Cugat anyway.',
  'Pen ink is forbidden because answers may need to be erased and rewritten as memory returns slowly.',
  'Round endings are signaled by the tiny chime and a collective sigh from every player at the table.',
];

export interface RoundLetters {
  sentence: string;
  letters: string; // 26 uppercase letters
}

export function generateRoundLetters(): RoundLetters {
  const sentence = SENTENCES[Math.floor(Math.random() * SENTENCES.length)] ?? SENTENCES[0];
  return { sentence, letters: lettersFromSentence(sentence) };
}

export function lettersFromSentence(sentence: string): string {
  let stripped = (sentence ?? '').replace(/[^A-Za-z]/g, '').toUpperCase();
  if (stripped.length < 26) {
    // Fallback: keep concatenating from the pool until we have 26
    for (const s of SENTENCES) {
      if (stripped.length >= 26) break;
      stripped += s.replace(/[^A-Za-z]/g, '').toUpperCase();
    }
  }
  return stripped.slice(0, 26);
}

export const ALPHABET: string[] = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
