// Suggestions for rows the player missed. Pulls famous humans whose initials match
// the row pair, sourced from Wikipedia search.

const DEBUG = false;

export interface Suggestion {
  name: string;
  description?: string;
  wikipediaUrl?: string;
}

interface SearchResponse {
  query?: { search?: Array<{ title: string; snippet: string; pageid: number }> };
}

interface SummaryResponse {
  title: string;
  description?: string;
  extract?: string;
  type?: string;
  wikibase_item?: string;
  content_urls?: { desktop?: { page?: string } };
}

async function isHumanPage(title: string): Promise<{ isHuman: boolean; summary: SummaryResponse | null }> {
  try {
    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
    if (!res.ok) return { isHuman: false, summary: null };
    const summary = (await res.json()) as SummaryResponse;
    if (summary.type === 'disambiguation') return { isHuman: false, summary };
    const qid = summary.wikibase_item;
    if (!qid) return { isHuman: false, summary };
    const wd = await fetch(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`);
    if (!wd.ok) return { isHuman: false, summary };
    const data = (await wd.json()) as {
      entities?: Record<string, { claims?: Record<string, Array<{ mainsnak?: { datavalue?: { value?: { id?: string } } } }>> }>;
    };
    const claims = data.entities?.[qid]?.claims?.P31 ?? [];
    const ids = claims.map((c) => c.mainsnak?.datavalue?.value?.id).filter(Boolean);
    return { isHuman: ids.includes('Q5'), summary };
  } catch (e) {
    if (DEBUG) console.error(e);
    return { isHuman: false, summary: null };
  }
}

export async function suggestForInitials(initials: string, limit = 3): Promise<Suggestion[]> {
  const a = initials[0];
  const b = initials[1];
  if (!a || !b) return [];

  try {
    const search = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
        `${a}* ${b}*`,
      )}&format=json&origin=*&srlimit=20`,
    );
    if (!search.ok) return [];
    const data = (await search.json()) as SearchResponse;
    const hits = data.query?.search ?? [];

    const results: Suggestion[] = [];
    for (const hit of hits) {
      if (results.length >= limit) break;
      const parts = hit.title.split(/\s+/);
      if (parts.length < 2) continue;
      const ti = (parts[0]![0] ?? '').toUpperCase();
      const tj = (parts[parts.length - 1]![0] ?? '').toUpperCase();
      if (ti !== a.toUpperCase() || tj !== b.toUpperCase()) continue;
      const { isHuman, summary } = await isHumanPage(hit.title);
      if (!isHuman || !summary) continue;
      results.push({
        name: summary.title,
        description: summary.description,
        wikipediaUrl: summary.content_urls?.desktop?.page,
      });
    }
    return results;
  } catch (e) {
    if (DEBUG) console.error(e);
    return [];
  }
}
