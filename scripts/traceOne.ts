// Print the trace for a single (name, pair) input. Useful for verifying
// a specific case end-to-end while developing.
//
// Usage:  npx tsx scripts/traceOne.ts "Prince Harry" PH

import {
  validateName,
  clearValidationCache,
  type TraceRecord,
} from '../src/services/wikiValidationService.ts';

const [, , name, pair] = process.argv;
if (!name || !pair) {
  console.error('usage: tsx scripts/traceOne.ts "<name>" <PAIR>');
  process.exit(2);
}

function fmt(r: TraceRecord) {
  const icon = r.outcome === 'hit' ? '✓' : r.outcome === 'miss' ? '✗' : r.outcome === 'skip' ? '·' : 'i';
  const det = r.detail ? `  detail=${JSON.stringify(r.detail)}` : '';
  return `${icon} [${r.stage}] ${r.label}: ${r.note}${det}`;
}

(async () => {
  const trace: TraceRecord[] = [];
  clearValidationCache();
  const res = await validateName(name, {
    expectedInitials: pair,
    trace: (r) => trace.push(r),
    bypassCache: true,
  });
  console.log(`# ${name} → ${pair.toUpperCase()}`);
  console.log(`result: ${res.status}${res.reason ? ` (${res.reason})` : ''}${res.canonicalName ? `  canonical=${res.canonicalName}` : ''}`);
  console.log('');
  for (const r of trace) console.log(fmt(r));
})();
