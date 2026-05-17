import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import { submitReview } from '@/services/reviewService';
import { sanitizeError } from '@/lib/sanitizeError';
import type { TraceRecord } from '@/services/wikiValidationService';
import { explainTrace, type Explanation } from '@/lib/explainTrace';
import { FAMOUS_PEOPLE } from '@/data/famousPeople';

interface ReviewContext {
  name: string;
  expectedPair: string;
  actualResult: 'valid' | 'invalid';
  /** For 'invalid' rows: the rejection reason. For 'valid' rows: the
   *  canonical name Wikipedia matched to (so the player can see what
   *  the validator thinks they typed). */
  reason?: string | null;
  trace: TraceRecord[];
}

interface ReviewSubmitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: ReviewContext;
  onSubmitted?: () => void;
}

const MAX_COMMENT = 280;

function pairToDot(pair: string): string {
  const u = (pair ?? '').toUpperCase();
  if (u.length < 2) return u;
  return `${u[0]} · ${u[1]}`;
}

interface WikiSummaryLite {
  extract: string;
  url?: string;
}

interface ExplainCopy {
  // Pre-text rendered as plain prose (we render this into a paragraph
  // that already has muted styling). Optional canonical name + link are
  // rendered separately so they can carry the underlined link style.
  prefix?: string;
  linkLabel?: string;
  linkHref?: string;
  suffix?: string;
  /** True when the modal needs to fetch a Wikipedia summary to render
   *  the suffix (the first sentence of the extract). Renders a skeleton
   *  in the suffix slot until the fetch resolves. */
  needsSummary?: boolean;
}

function firstSentence(extract: string): string {
  // Wikipedia extracts already strip wikitext; first sentence is the
  // canonical biography opener. Split on ". " so we don't break on
  // initials like "F. D. R." Trim and re-attach a period.
  const idx = extract.indexOf('. ');
  if (idx < 0) return extract.trim();
  return extract.slice(0, idx + 1).trim();
}

// First sentence is rarely longer than 220 chars; if Wikipedia's extract
// is unusually terse (a single long sentence) we still cap to keep the
// modal compact on mobile.
function clampSentence(s: string, max = 240): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut) + '…';
}

function wikiUrlFor(title: string): string {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
}

function localEntryDescription(pair: string, canonical: string): { description: string; url: string } | null {
  const pool = FAMOUS_PEOPLE[(pair ?? '').toUpperCase()] ?? [];
  // `Suggestion.description` and `wikipediaUrl` are optional in the
  // type, but every entry in FAMOUS_PEOPLE was written via the `p()`
  // shorthand which always sets both. Coalesce defensively anyway.
  const exact = pool.find((p) => p.name === canonical);
  if (exact) return { description: exact.description ?? '', url: exact.wikipediaUrl ?? wikiUrlFor(exact.name) };
  // Case-insensitive fallback for safety — local pool names should match
  // exactly but typos in either side shouldn't blow up the explanation.
  const ci = pool.find((p) => p.name.toLowerCase() === canonical.toLowerCase());
  return ci ? { description: ci.description ?? '', url: ci.wikipediaUrl ?? wikiUrlFor(ci.name) } : null;
}

/** Map an `Explanation` to the prose chunks the modal renders. Pure —
 *  doesn't fetch anything; for accepted-exact / accepted-fuzzy the modal
 *  fills in the Wikipedia summary after the async fetch resolves. */
function explanationCopy(
  e: Explanation,
  typedName: string,
  expectedPair: string | undefined,
  summary: WikiSummaryLite | null,
): ExplainCopy {
  const dot = (pair: string | undefined): string => {
    if (!pair || pair.length < 2) return pair ?? '';
    return `${pair[0]}·${pair[1]}`;
  };
  switch (e.kind) {
    case 'accepted-local': {
      if (!e.canonical) return { prefix: 'Matched a known name in our list.' };
      const local = localEntryDescription(expectedPair ?? '', e.canonical);
      if (!local) {
        return {
          prefix: 'Matched in our list as ',
          linkLabel: e.canonical,
          linkHref: wikiUrlFor(e.canonical),
          suffix: '.',
        };
      }
      return {
        prefix: '',
        linkLabel: e.canonical,
        linkHref: local.url,
        suffix: local.description ? ` — ${local.description}` : '',
      };
    }
    case 'accepted-exact': {
      if (!e.canonical) return { prefix: 'Verified against Wikipedia.' };
      if (summary) {
        return {
          prefix: '',
          linkLabel: e.canonical,
          linkHref: summary.url ?? wikiUrlFor(e.canonical),
          suffix: ` — ${clampSentence(firstSentence(summary.extract))}`,
        };
      }
      return {
        prefix: '',
        linkLabel: e.canonical,
        linkHref: wikiUrlFor(e.canonical),
        suffix: '',
        needsSummary: true,
      };
    }
    case 'accepted-fuzzy': {
      if (!e.canonical) return { prefix: 'We matched this to a similar name.' };
      if (summary) {
        return {
          prefix: 'We matched this to ',
          linkLabel: e.canonical,
          linkHref: summary.url ?? wikiUrlFor(e.canonical),
          suffix: ` — ${clampSentence(firstSentence(summary.extract))}`,
        };
      }
      return {
        prefix: 'We matched this to ',
        linkLabel: e.canonical,
        linkHref: wikiUrlFor(e.canonical),
        suffix: '.',
        needsSummary: true,
      };
    }
    case 'rejected-initials-mismatch': {
      const got = e.typedInitials ? dot(e.typedInitials) : '?·?';
      const want = e.expectedPair ? dot(e.expectedPair) : (expectedPair ? dot(expectedPair) : '?·?');
      return {
        prefix: `The initials of "${typedName}" come out to ${got}, not ${want}.`,
      };
    }
    case 'rejected-no-page': {
      return {
        prefix: `We couldn't find a Wikipedia page for anyone resembling "${typedName}". They might not be a public figure — or it might be a spelling variation we didn't catch.`,
      };
    }
    case 'rejected-fictional': {
      if (!e.canonical) return { prefix: 'That name belongs to a fictional character — we only count real people.' };
      return {
        prefix: '',
        linkLabel: e.canonical,
        linkHref: wikiUrlFor(e.canonical),
        suffix: ' is a fictional character — we only count real people.',
      };
    }
    case 'rejected-not-person': {
      if (!e.canonical) {
        return { prefix: 'The Wikipedia page we found isn\'t a person.' };
      }
      return {
        prefix: 'We found a Wikipedia page for ',
        linkLabel: e.canonical,
        linkHref: wikiUrlFor(e.canonical),
        suffix: ", but it's not a person.",
      };
    }
    case 'rejected-different-person': {
      const cands = e.closestCandidates ?? [];
      if (cands.length === 0) {
        return { prefix: 'The closest Wikipedia matches were different people — different surnames, so we couldn\'t accept any of them.' };
      }
      if (cands.length === 1) {
        return {
          prefix: 'Closest Wikipedia match was ',
          linkLabel: cands[0]!,
          linkHref: wikiUrlFor(cands[0]!),
          suffix: " — different surname, so we couldn't accept it.",
        };
      }
      return {
        prefix: 'Closest matches were ',
        linkLabel: cands[0]!,
        linkHref: wikiUrlFor(cands[0]!),
        suffix: ` and "${cands[1]}" — different surnames, so we couldn't accept them.`,
      };
    }
    case 'rejected-disambig': {
      if (!e.canonical) {
        return { prefix: `There's a Wikipedia page for "${typedName}" but it lists many people, and we couldn't tell which one you meant.` };
      }
      return {
        prefix: "There's a Wikipedia page for ",
        linkLabel: e.canonical,
        linkHref: wikiUrlFor(e.canonical),
        suffix: " but it lists many people, and we couldn't tell which one you meant.",
      };
    }
    case 'rejected-unknown':
    default:
      return {
        prefix: "We weren't able to verify this name — submit it for review if you think it should count.",
      };
  }
}

export function ReviewSubmitModal({
  open,
  onOpenChange,
  context,
  onSubmitted,
}: ReviewSubmitModalProps) {
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  // Wikipedia summary cache keyed by canonical title. Populated on
  // modal-open for accepted-exact / accepted-fuzzy cases. Persists for
  // the modal's lifetime so re-opening the same row (or a row pointing
  // at the same canonical) doesn't refetch.
  const [summaries, setSummaries] = useState<Record<string, WikiSummaryLite | null>>({});

  // Reset the comment whenever the modal closes so re-opening on a new
  // row starts clean.
  useEffect(() => {
    if (!open) setComment('');
  }, [open]);

  const explanation = useMemo<Explanation>(() => {
    return explainTrace(context.trace, {
      status: context.actualResult,
      typedName: context.name,
      expectedPair: context.expectedPair,
    });
  }, [context.trace, context.actualResult, context.name, context.expectedPair]);

  const copy = useMemo<ExplainCopy>(() => {
    const cached = explanation.canonical ? summaries[explanation.canonical] ?? null : null;
    return explanationCopy(explanation, context.name, context.expectedPair, cached);
  }, [explanation, summaries, context.name, context.expectedPair]);

  // Fire the summary fetch when the modal opens for an accepted-exact /
  // accepted-fuzzy case we haven't seen yet. Errors are swallowed — the
  // pre-summary `linkLabel`-only copy is a fine fallback.
  useEffect(() => {
    if (!open) return;
    if (!copy.needsSummary) return;
    const title = explanation.canonical;
    if (!title) return;
    if (title in summaries) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}?redirect=true`,
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as {
          extract?: string;
          content_urls?: { desktop?: { page?: string } };
        };
        const extract = typeof data.extract === 'string' ? data.extract : '';
        const url = data.content_urls?.desktop?.page;
        if (!cancelled) {
          setSummaries((s) => ({ ...s, [title]: extract ? { extract, url } : null }));
        }
      } catch {
        if (!cancelled) setSummaries((s) => ({ ...s, [title]: null }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, copy.needsSummary, explanation.canonical, summaries]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await submitReview({
        name: context.name,
        expectedPair: context.expectedPair,
        actualResult: context.actualResult,
        reason: context.reason ?? null,
        trace: context.trace,
        userComment: comment,
      });
      toast.success("Thanks, we'll review.");
      onOpenChange(false);
      onSubmitted?.();
    } catch (err) {
      toast.error(sanitizeError(err));
    } finally {
      setBusy(false);
    }
  };

  const isAccepted = context.actualResult === 'valid';
  const resultLabel = isAccepted ? 'Accepted as:' : 'Result:';
  const promptLabel = isAccepted
    ? "Why do you think this shouldn't count?"
    : 'Why do you think this should count?';
  const resultValueClass = isAccepted ? 'text-success' : 'text-error';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[420px] !p-6">
        <DialogTitle className="!text-[22px]">Submit for review</DialogTitle>

        <div className="mt-5 space-y-3">
          <div className="flex items-baseline gap-2">
            <span className="font-sans text-xs uppercase tracking-wider text-muted">You typed:</span>
            <span className="font-serif text-[18px] font-bold text-ink">{context.name || '—'}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-sans text-xs uppercase tracking-wider text-muted">For the pair:</span>
            <span className="font-serif text-[18px] font-bold tabular-nums text-ink">
              {pairToDot(context.expectedPair)}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-sans text-xs uppercase tracking-wider text-muted">{resultLabel}</span>
            <span className={`font-sans text-sm ${resultValueClass}`}>{context.reason || '—'}</span>
          </div>
        </div>

        <p className="mt-4 font-sans text-[13px] leading-relaxed text-muted">
          {copy.prefix}
          {copy.linkLabel && (
            <a
              href={copy.linkHref}
              target="_blank"
              rel="noreferrer"
              className="text-ink underline decoration-hairline underline-offset-2 hover:decoration-ink"
            >
              {copy.linkLabel}
            </a>
          )}
          {copy.suffix}
          {/* While we wait for the Wikipedia summary, reserve a thin
              skeleton line in the suffix slot so the modal doesn't
              shift when the description arrives. */}
          {copy.needsSummary && !copy.suffix && (
            <span
              aria-hidden
              className="ml-2 inline-block h-[0.85em] w-32 animate-pulse rounded bg-hairline align-middle"
            />
          )}
        </p>

        <form onSubmit={handleSubmit} className="mt-6">
          <label className="block">
            <span className="font-sans text-xs uppercase tracking-wider text-muted">{promptLabel}</span>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, MAX_COMMENT))}
              placeholder="optional — adds context for review"
              rows={3}
              className="input-line mt-1 w-full resize-none font-sans text-sm"
              maxLength={MAX_COMMENT}
            />
            <div className="mt-1 flex justify-end">
              <span className="font-sans text-[11px] tabular-nums text-muted">
                {comment.length}/{MAX_COMMENT}
              </span>
            </div>
          </label>

          <p className="mt-3 font-sans text-[12px] leading-relaxed text-muted">
            We review submissions and add verified names to the dataset, or fix the validator.
          </p>

          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              className="btn-pill-sm"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary !min-h-[2.5rem] !px-5 !text-sm" disabled={busy}>
              {busy ? 'Submitting…' : 'Submit'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
