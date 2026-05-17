// A labeled <pre> block with a "Copy" affordance. Used by the admin
// queue and the ad-hoc workbench to surface snippet text the admin
// can paste straight into source.

import { Copy } from 'lucide-react';
import { toast } from '@/components/ui/toast';

interface CopyBlockProps {
  label: string;
  value: string;
}

export function CopyBlock({ label, value }: CopyBlockProps) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`Copied ${label}.`);
    } catch {
      toast.error("Couldn't copy — select the snippet and ⌘C.");
    }
  };
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between">
        <span className="font-sans text-[11px] uppercase tracking-wider text-muted">{label}</span>
        <button
          type="button"
          onClick={copy}
          className="flex items-center gap-1 font-sans text-[11px] text-muted hover:text-ink"
        >
          <Copy className="h-3 w-3" strokeWidth={1.75} /> Copy
        </button>
      </div>
      <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded bg-paper-shadow/40 p-2 font-mono text-[12px] leading-relaxed text-ink">
        {value}
      </pre>
    </div>
  );
}
