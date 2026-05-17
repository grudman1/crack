// One-shot regression runner. Imports the production validator and the
// hardcoded regression cases, runs every case with bypassCache + a trace
// collector, and prints a Markdown report to stdout.
//
// Usage:  npx tsx scripts/runRegression.ts > regression-report.md

import {
  validateName,
  clearValidationCache,
  type TraceRecord,
  type ValidationResult,
} from '../src/services/wikiValidationService.ts';
import { ALL_CASES, type RegressionCase } from '../src/data/regressionSet.ts';

interface RunRow {
  c: RegressionCase;
  res: ValidationResult;
  trace: TraceRecord[];
  passed: boolean;
}

async function runOne(c: RegressionCase): Promise<RunRow> {
  const trace: TraceRecord[] = [];
  clearValidationCache();
  const res = await validateName(c.name, {
    expectedInitials: c.pair,
    trace: (r) => trace.push(r),
    bypassCache: true,
  });
  const passed =
    (c.expect === 'accept' && res.status === 'valid') ||
    (c.expect === 'reject' && res.status === 'invalid');
  return { c, res, trace, passed };
}

function fmtOutcome(o: TraceRecord['outcome']): string {
  if (o === 'hit') return '✓';
  if (o === 'miss') return '✗';
  if (o === 'skip') return '·';
  return 'i';
}

function fmtTraceLine(r: TraceRecord): string {
  const det = r.detail ? ` — \`${JSON.stringify(r.detail)}\`` : '';
  return `- ${fmtOutcome(r.outcome)} **[${r.stage}]** ${r.label}: ${r.note}${det}`;
}

function fmtWinningStage(rows: TraceRecord[]): string {
  // Gate is a precondition, not a verification stage; final is the
  // terminal record. Find the first verification-stage hit.
  const hit = rows.find(
    (r) => r.outcome === 'hit' && r.stage !== 'final' && r.stage !== 'gate',
  );
  if (hit) return `${hit.stage} (${hit.label})`;
  // No verification stage hit → either the gate failed (REJECT) or
  // every chain stage missed (REJECT "couldn't verify"). Show the
  // terminal final record's note.
  const final = rows.find((r) => r.stage === 'final');
  return final ? `final — ${final.note}` : 'final';
}

async function main() {
  const rows: RunRow[] = [];
  for (const c of ALL_CASES) {
    process.stderr.write(`· ${c.name} (${c.pair}) … `);
    const r = await runOne(c);
    process.stderr.write(`${r.passed ? 'PASS' : 'FAIL'}\n`);
    rows.push(r);
  }

  const passed = rows.filter((r) => r.passed).length;
  const total = rows.length;
  const failures = rows.filter((r) => !r.passed);
  const passes = rows.filter((r) => r.passed);

  const date = new Date().toISOString().slice(0, 10);
  const lines: string[] = [];
  lines.push(`# CRACK validator regression — ${date}`);
  lines.push('');
  lines.push(`**Result: ${passed}/${total} passed** (${failures.length} failure${failures.length === 1 ? '' : 's'})`);
  lines.push('');

  lines.push('## Failures');
  lines.push('');
  if (failures.length === 0) {
    lines.push('_None._');
    lines.push('');
  } else {
    for (const f of failures) {
      lines.push(
        `### ${f.c.name} → ${f.c.pair} (expected ${f.c.expect.toUpperCase()}, got ${f.res.status === 'valid' ? 'ACCEPT' : 'REJECT'})`,
      );
      if (f.c.note) lines.push(`_${f.c.note}_`);
      lines.push('');
      lines.push(`**Reason:** ${f.res.reason ?? '—'}`);
      if (f.res.canonicalName) lines.push(`**Canonical:** ${f.res.canonicalName}`);
      if (f.res.wikipediaUrl) lines.push(`**URL:** ${f.res.wikipediaUrl}`);
      lines.push('');
      lines.push('**Trace:**');
      for (const r of f.trace) lines.push(fmtTraceLine(r));
      lines.push('');
    }
  }

  lines.push('## Passes');
  lines.push('');
  for (const p of passes) {
    const verdict = p.res.status === 'valid' ? 'ACCEPT' : 'REJECT';
    const stage = fmtWinningStage(p.trace);
    const canon = p.res.canonicalName ? ` → _${p.res.canonicalName}_` : '';
    const reason = p.res.reason ? ` — ${p.res.reason}` : '';
    lines.push(`- **${p.c.name}** (${p.c.pair}) → ${verdict} via \`${stage}\`${canon}${reason}`);
  }
  lines.push('');

  process.stdout.write(lines.join('\n'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
