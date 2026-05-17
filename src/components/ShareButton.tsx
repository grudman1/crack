// Share-results button. Takes a pre-built text body so it stays
// dumb — the calling page decides what to share (Solo round, MP
// round, etc.) and passes the formatted string in. Uses the Web
// Share API when available, falls back to clipboard otherwise.

import { useState } from 'react';
import { Share2, Check } from 'lucide-react';
import { toast } from '@/components/ui/toast';

interface ShareButtonProps {
  /** The body of the share. Build via lib/share.ts helpers. */
  text: string;
  /** navigator.share() title. Defaults to "Crack". */
  title?: string;
  /** Button label override. Defaults to "Share results". */
  label?: string;
}

export function ShareButton({ text, title = 'Crack', label = 'Share results' }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const nav = navigator as Navigator & {
      share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
    };
    if (typeof nav.share === 'function') {
      try {
        await nav.share({ title, text });
        return;
      } catch {
        /* user cancelled or share failed — fall through to clipboard */
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy to clipboard.");
    }
  };

  return (
    <button type="button" className="btn-ghost w-full max-w-[20rem]" onClick={handleShare}>
      {copied ? (
        <>
          <Check className="mr-2 h-4 w-4" strokeWidth={2.25} /> Copied to clipboard
        </>
      ) : (
        <>
          <Share2 className="mr-2 h-4 w-4" strokeWidth={2} /> {label}
        </>
      )}
    </button>
  );
}
