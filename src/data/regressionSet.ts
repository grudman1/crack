// Hardcoded regression cases for the /debug page. Easy to extend over
// time — just add a new entry. Each case runs through the full
// validation chain; we expect ACCEPTs to pass and REJECTs to fail.

export interface RegressionCase {
  name: string;
  pair: string;
  expect: 'accept' | 'reject';
  note?: string;
}

export const ACCEPT_CASES: RegressionCase[] = [
  { name: 'Prince Harry', pair: 'PH', expect: 'accept', note: 'British royal; Wikipedia title is "Prince Harry, Duke of Sussex"' },
  { name: 'Robin Thicke', pair: 'RT', expect: 'accept', note: 'singer' },
  { name: 'Queen Elizabeth', pair: 'QE', expect: 'accept', note: 'disambig likely; expect resolution to Elizabeth II' },
  { name: 'Pope Francis', pair: 'PF', expect: 'accept' },
  { name: 'Dame Judi Dench', pair: 'JD', expect: 'accept', note: 'honorific Dame stripped; canonical is "Judi Dench"' },
  { name: 'Dr Henry Kissinger', pair: 'HK', expect: 'accept', note: 'honorific Dr stripped; canonical is "Henry Kissinger"' },
  { name: 'George Eliot', pair: 'GE', expect: 'accept' },
  { name: 'Harry Reasoner', pair: 'HR', expect: 'accept' },
  { name: 'Harry Reasner', pair: 'HR', expect: 'accept', note: 'typo of Harry Reasoner' },
  { name: 'Fran Tarkenton', pair: 'FT', expect: 'accept' },
  { name: 'Ursula Andress', pair: 'UA', expect: 'accept' },
  { name: 'Chris Evans', pair: 'CE', expect: 'accept', note: 'disambig — should resolve to actor or presenter' },
  { name: 'Eliot Ness', pair: 'EN', expect: 'accept' },
  { name: 'LeBron James', pair: 'LJ', expect: 'accept' },
  { name: 'Frank Zappa', pair: 'FZ', expect: 'accept' },
  { name: 'George Orwell', pair: 'GO', expect: 'accept' },
  { name: 'John F. Kennedy', pair: 'JK', expect: 'accept' },
  { name: 'JFK', pair: 'JK', expect: 'accept', note: 'abbreviation; should resolve via redirect' },
];

export const REJECT_CASES: RegressionCase[] = [
  { name: 'Henry Duplessis', pair: 'HD', expect: 'reject', note: 'fabricated / not famous' },
  { name: 'Tark', pair: 'TR', expect: 'reject', note: 'single-token stub' },
  { name: 'Teddy Ro', pair: 'TR', expect: 'reject', note: 'two tokens but surname stub (Ro)' },
  { name: 'Ro', pair: 'RR', expect: 'reject', note: 'extreme stub' },
  { name: 'Xyz Qrs', pair: 'XQ', expect: 'reject', note: 'gibberish' },
  { name: 'The Beatles', pair: 'TB', expect: 'reject', note: 'band, not a person' },
  { name: 'LT', pair: 'LT', expect: 'reject', note: 'no full name' },
  { name: 'Prince', pair: 'PR', expect: 'reject', note: 'mononym — expected to fail token gate' },
  { name: '', pair: 'AA', expect: 'reject', note: 'empty input' },
];

export const ALL_CASES: RegressionCase[] = [...ACCEPT_CASES, ...REJECT_CASES];
