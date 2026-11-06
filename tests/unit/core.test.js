import { describe, it, expect, vi } from 'vitest';

vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth: {}, storage: { from: () => ({}) } }) }));
const { shuffleForNow } = await import('../../src/screens/Students.jsx');
const { friendlyError, membershipNo } = await import('../../src/lib/supabase.js');

describe('home order', () => {
  it('keeps every member, no duplicates', () => {
    const list = Array.from({ length: 25 }, (_, i) => ({ id: i }));
    const out = shuffleForNow(list);
    expect(out).toHaveLength(25);
    expect(new Set(out.map((x) => x.id)).size).toBe(25);
  });
  it('nobody keeps the spot they had in the previous 4-hour window', () => {
    const list = Array.from({ length: 12 }, (_, i) => ({ id: i }));
    const W = 4 * 60 * 60 * 1000;
    const t = 1_800_000_000_000;
    vi.setSystemTime(t);
    const a = shuffleForNow(list);
    vi.setSystemTime(t + W);
    const b = shuffleForNow(list);
    vi.useRealTimers();
    a.forEach((x, i) => expect(b[i].id).not.toBe(x.id));
  });
  it('is the same for everyone inside one window', () => {
    const list = Array.from({ length: 9 }, (_, i) => ({ id: i }));
    expect(shuffleForNow(list).map((x) => x.id)).toEqual(shuffleForNow(list).map((x) => x.id));
  });
});

describe('membership numbers', () => {
  it('pads to four digits', () => {
    expect(membershipNo(1)).toBe('SPK-M-0001');
    expect(membershipNo(1234)).toBe('SPK-M-1234');
    expect(membershipNo(null)).toBe('');
  });
});

describe('friendly errors', () => {
  it('maps common failures to Arabic', () => {
    expect(friendlyError({ message: 'Failed to fetch' })).toMatch('إنترنت');
    expect(friendlyError({ message: 'new row violates row-level security policy' })).toMatch('صلاحية');
    expect(friendlyError({ message: '504 Gateway Timeout' })).toMatch('السيرفر');
    expect(friendlyError({})).toMatch('خطأ');
  });
});
