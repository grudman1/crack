import { describe, it, expect, beforeEach } from 'vitest';
import { getRoundNumber, incrementRoundNumber, formatToday } from '@/services/roundCounter';

describe('roundCounter', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts at 1 when nothing is stored', () => {
    expect(getRoundNumber()).toBe(1);
  });

  it('increments and persists', () => {
    expect(incrementRoundNumber()).toBe(2);
    expect(incrementRoundNumber()).toBe(3);
    expect(getRoundNumber()).toBe(3);
  });

  it('survives a fresh getRoundNumber call after multiple bumps', () => {
    incrementRoundNumber();
    incrementRoundNumber();
    incrementRoundNumber();
    expect(getRoundNumber()).toBe(4);
  });

  it('ignores garbage values in storage', () => {
    localStorage.setItem('crack:round_counter', 'not a number');
    expect(getRoundNumber()).toBe(1);
  });

  it('formatToday returns a long-form US date', () => {
    const out = formatToday(new Date('2026-05-16T12:00:00Z'));
    expect(out).toMatch(/May 16, 2026/);
  });
});
