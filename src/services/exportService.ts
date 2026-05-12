import { ALPHABET } from './sentenceService';

export interface ExportRow {
  rowIndex: number;
  initials: string;
  name: string;
  status?: 'valid' | 'invalid' | 'unanswered';
  reason?: string;
  canonicalName?: string;
  points?: number;
}

export interface ExportPayload {
  title: string;
  sentence: string;
  letters: string;
  totalScore?: number;
  rows: ExportRow[];
}

export function buildCsv(payload: ExportPayload): string {
  const header = ['Row', 'Initials', 'Answer', 'Status', 'Canonical', 'Reason', 'Points'];
  const lines = [header.join(',')];
  for (const r of payload.rows) {
    const cells = [
      String(r.rowIndex + 1),
      r.initials,
      escape(r.name),
      r.status ?? '',
      escape(r.canonicalName ?? ''),
      escape(r.reason ?? ''),
      r.points != null ? String(r.points) : '',
    ];
    lines.push(cells.join(','));
  }
  if (payload.totalScore != null) lines.push(`,,,,,,${payload.totalScore}`);
  return lines.join('\n');
}

export function buildTxt(payload: ExportPayload): string {
  const lines = [`${payload.title}`, `Sentence: ${payload.sentence}`, `Letters: ${payload.letters}`, ''];
  for (const r of payload.rows) {
    const mark = r.status === 'valid' ? '✓' : r.status === 'invalid' ? '✗' : ' ';
    const initials = `${ALPHABET[r.rowIndex]}${payload.letters[r.rowIndex] ?? ''}`;
    const pts = r.points != null ? ` (+${r.points})` : '';
    lines.push(`${mark} ${initials.padEnd(4)} ${r.name || '—'}${pts}`);
  }
  if (payload.totalScore != null) lines.push('', `Total: ${payload.totalScore}`);
  return lines.join('\n');
}

function escape(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportCsv(payload: ExportPayload, filename = 'crack-round.csv') {
  downloadFile(filename, buildCsv(payload), 'text/csv;charset=utf-8');
}

export function exportTxt(payload: ExportPayload, filename = 'crack-round.txt') {
  downloadFile(filename, buildTxt(payload), 'text/plain;charset=utf-8');
}
