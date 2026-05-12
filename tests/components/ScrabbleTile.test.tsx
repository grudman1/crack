import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScrabbleTile } from '@/components/ScrabbleTile';

describe('ScrabbleTile', () => {
  it('renders the letter uppercased', () => {
    render(<ScrabbleTile letter="a" />);
    expect(screen.getByLabelText('Tile A')).toBeInTheDocument();
  });

  it('shows the scrabble point value', () => {
    render(<ScrabbleTile letter="Q" />);
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('hides point value when 0', () => {
    render(<ScrabbleTile letter="A" pointValue={0} />);
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });
});
