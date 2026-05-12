import { Toaster as Sonner, toast } from 'sonner';

export function Toaster() {
  return (
    <Sonner
      position="top-center"
      toastOptions={{
        className: 'paper-card font-body text-ink',
        style: {
          backgroundColor: 'hsl(var(--paper-shadow))',
          color: 'hsl(var(--ink))',
          border: '2px dashed hsl(var(--ink))',
        },
      }}
    />
  );
}

export { toast };
