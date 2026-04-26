import { describe, it, expect } from 'vitest';

// ── Helpers under test ──
// These are defined at module scope in Script.js (before the VideoFocusRail class).
// Redefined here as the contract the implementation must match.

function vfrWrap(n, count) {
  return ((n % count) + count) % count;
}

function vfrCardStyle(offset) {
  const dist = Math.abs(offset);
  const xPx = offset * 320;
  const zPx = -dist * 180;
  const rotY = offset * -20;
  const scale = offset === 0 ? 1 : 0.85;
  const opacity = offset === 0 ? 1 : Math.max(0.1, 1 - dist * 0.5);
  const blur = offset === 0 ? 0 : dist * 6;
  const brightness = offset === 0 ? 1 : 0.5;
  return {
    transform: `translateX(${xPx}px) translateZ(${zPx}px) rotateY(${rotY}deg) scale(${scale})`,
    opacity,
    filter: `blur(${blur}px) brightness(${brightness})`,
    zIndex: offset === 0 ? 5 : 5 - dist,
  };
}

// ── vfrWrap ──
describe('vfrWrap', () => {
  it('returns index unchanged when within range', () => {
    expect(vfrWrap(0, 6)).toBe(0);
    expect(vfrWrap(5, 6)).toBe(5);
  });

  it('wraps negative index to end of range', () => {
    expect(vfrWrap(-1, 6)).toBe(5);
    expect(vfrWrap(-6, 6)).toBe(0);
  });

  it('wraps index past end to start', () => {
    expect(vfrWrap(6, 6)).toBe(0);
    expect(vfrWrap(7, 6)).toBe(1);
  });
});

// ── vfrCardStyle ──
describe('vfrCardStyle', () => {
  it('center card (offset 0) has full opacity, no blur, z-index 5', () => {
    const s = vfrCardStyle(0);
    expect(s.opacity).toBe(1);
    expect(s.filter).toBe('blur(0px) brightness(1)');
    expect(s.zIndex).toBe(5);
    expect(s.transform).toContain('scale(1)');
    expect(s.transform).toContain('translateX(0px)');
  });

  it('offset +1 card is shifted right, dimmed, slightly blurred', () => {
    const s = vfrCardStyle(1);
    expect(s.opacity).toBe(0.5);
    expect(s.filter).toBe('blur(6px) brightness(0.5)');
    expect(s.zIndex).toBe(4);
    expect(s.transform).toContain('translateX(320px)');
    expect(s.transform).toContain('rotateY(-20deg)');
    expect(s.transform).toContain('scale(0.85)');
  });

  it('offset -1 card mirrors offset +1 but shifts left', () => {
    const s = vfrCardStyle(-1);
    expect(s.opacity).toBe(0.5);
    expect(s.transform).toContain('translateX(-320px)');
    expect(s.transform).toContain('rotateY(20deg)');
  });

  it('offset +2 has minimum 0.1 opacity', () => {
    const s = vfrCardStyle(2);
    expect(s.opacity).toBe(0.1); // max(0.1, 1 - 2*0.5) = max(0.1, 0) = 0.1
    expect(s.zIndex).toBe(3);
  });
});
