import { useState } from 'react';
import { Share2, Check } from 'lucide-react';
import { toast } from '@/components/ui/toast';
import { buildShareString, type ShareResult } from '@/lib/share';

interface ShareButtonProps {
  result: ShareResult;
}

export function ShareButton({ result }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const text = buildShareString(result);
    const nav = navigator as Navigator & {
      share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
    };
    if (typeof nav.share === 'function') {
      try {
        await nav.share({ title: `Crack #${result.roundNumber}`, text });
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
          <Share2 className="mr-2 h-4 w-4" strokeWidth={2} /> Share results
        </>
      )}
    </button>
  );
}
