import { Toaster as Sonner, toast } from 'sonner';

export function Toaster() {
  return (
    <Sonner
      position="top-center"
      toastOptions={{
        className: 'font-sans text-sm',
        style: {
          backgroundColor: 'hsl(var(--paper))',
          color: 'hsl(var(--ink))',
          border: '1px solid hsl(var(--hairline))',
          borderRadius: '4px',
        },
      }}
    />
  );
}

export { toast };
