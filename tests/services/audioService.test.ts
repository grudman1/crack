import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('audioService — mute + haptics', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('defaults to unmuted', async () => {
    const { isMuted } = await import('@/services/audioService');
    expect(isMuted()).toBe(false);
  });

  it('persists the muted setting across module reloads', async () => {
    const first = await import('@/services/audioService');
    first.setMuted(true);
    expect(localStorage.getItem('crack:audio-pref')).toBe('off');

    vi.resetModules();
    const second = await import('@/services/audioService');
    expect(second.isMuted()).toBe(true);
  });

  it('notifies subscribers when the mute state flips', async () => {
    const { setMuted, subscribeMuted } = await import('@/services/audioService');
    const cb = vi.fn();
    const unsub = subscribeMuted(cb);
    setMuted(true);
    setMuted(false);
    expect(cb).toHaveBeenCalledTimes(2);
    unsub();
    setMuted(true);
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('playKeystroke vibrates when unmuted, stays silent when muted', async () => {
    const vibrate = vi.fn().mockReturnValue(true);
    vi.stubGlobal('navigator', { vibrate });

    const { playKeystroke, setMuted } = await import('@/services/audioService');
    playKeystroke();
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenCalledWith(8);

    setMuted(true);
    playKeystroke();
    expect(vibrate).toHaveBeenCalledTimes(1);
  });

  it('playKeystroke is a silent no-op when navigator.vibrate is absent (iOS Safari)', async () => {
    vi.stubGlobal('navigator', {});
    const { playKeystroke } = await import('@/services/audioService');
    expect(() => playKeystroke()).not.toThrow();
  });
});
