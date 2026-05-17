import { useEffect, useRef, useState } from 'react';

interface EndRoundButtonProps {
  onConfirm: () => void;
}

const CONFIRM_WINDOW_MS = 3000;

export function EndRoundButton({ onConfirm }: EndRoundButtonProps) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const handle = () => {
    if (armed) {
      if (timer.current) window.clearTimeout(timer.current);
      setArmed(false);
      onConfirm();
      return;
    }
    setArmed(true);
    timer.current = window.setTimeout(() => {
      setArmed(false);
      timer.current = null;
    }, CONFIRM_WINDOW_MS);
  };

  return (
    <button type="button" className="btn-pill-sm btn-ghost--danger" onClick={handle}>
      {armed ? 'End round — confirm?' : 'End round'}
    </button>
  );
}
