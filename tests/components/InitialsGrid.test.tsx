import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InitialsGrid } from '@/components/InitialsGrid';

describe('InitialsGrid', () => {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const rows = Array.from({ length: 26 }, () => ({ name: '' }));

  it('renders 26 answer inputs', () => {
    render(<InitialsGrid letters={letters} rows={rows} />);
    expect(screen.getAllByRole('textbox')).toHaveLength(26);
  });

  it('calls onChange when typing', () => {
    const onChange = vi.fn();
    render(<InitialsGrid letters={letters} rows={rows} onChange={onChange} />);
    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[0]!, { target: { value: 'Alan Turing' } });
    expect(onChange).toHaveBeenCalledWith(0, 'Alan Turing');
  });
});
