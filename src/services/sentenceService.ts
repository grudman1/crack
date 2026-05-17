// Round constants. The sentence-based round generator that used to live
// here has been replaced by phraseService.generateRound() (which sources
// each round's second-initial string from a Wikiquote-derived phrase).
//
// This module is kept for the A–Z alphabet constant — imported by
// InitialsGrid, SuggestionsPanel, exportService, Solo, and Room.

export const ALPHABET: string[] = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
