import { useEffect, useMemo, useRef, useState } from 'react';
import { friendlyError, supabase } from '../lib/supabase.js';
import { go, peek } from '../lib/router.js';
import { Photo, Tick, SkCards, Empty, CountUp } from '../ui.jsx';
import { onScrollFrame } from '../gestures.js';

// Order changes every 4 hours, the same for everyone in that window.
// No member keeps the spot they had in the previous window.
const WINDOW = 4 * 60 * 60 * 1000;
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function perm(n, seed) {
  const r = rng(seed * 2654435761), p = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  return p;
}
export function shuffleForNow(list) {
  const n = list.length;
  if (n < 2) return list;
  const w = Math.floor(Date.now() / WINDOW);
  const cur = perm(n, w), prev = perm(n, w - 1);
  for (let i = 0; i < n; i++) if (cur[i] === prev[i]) { const k = (i + 1) % n; [cur[i], cur[k]] = [cur[k], cur[i]]; }
  return cur.map((i) => list[i]);
}

export function MemberCard({ m, i = 0 }) {
  if (!m.student_id && !m.id) {
    return (
      <div className="scard seat" style={{ animationDelay: `${i * 30}ms` }}>
        <Photo id={'seat' + i} />
        <span className="ov"><span className="name"><span className="nm">مقعد محجوز</span></span><span className="q">لسا ما فعّل عضويته</span></span>
      </div>
    );
  }
  const id = m.id || m.student_id;
  // the profile header renders instantly from what the card already knows
  const open = () => {
    peek.set(id, { id, full_name: m.full_name, photo_url: m.photo_url, tagline: m.tagline, specialty: m.specialty });
    go('member/' + id);
  };
  return (
    <button className="scard press tilt" style={{ animationDelay: `${Math.min(i, 18) * 30}ms` }} onClick={open} aria-label={m.full_name}>
      <Photo url={m.photo_url} id={id} />
      <span className="ov">
        <span className="name"><span className="nm">{m.full_name}</span>{m.course_count >= 2 && <Tick />}</span>
        {(m.tagline || m.specialty) && <span className="q">{m.tagline || m.specialty}</span>}
      </span>
    </button>
  );
}


export default function Students() {
  const [rows, setRows] = useState(null);
  const [stats, setStats] = useState(null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [chip, setChip] = useState(null); // { kind: 'course' | 'spec', value }
  const bar = useRef(null);
  useEffect(() => {
    supabase.rpc('public_members', undefined, { get: true }).then(({ data, error }) => {
      if (error) setErr(friendlyError(error)); else setRows(shuffleForNow(data));
    });
    supabase.rpc('home_stats', undefined, { get: true }).then(({ data }) => setStats(data?.[0] || null));
  }, []);
  // the search/filter bar tucks away while scrolling down and comes back on the way up
  useEffect(() => {
    let last = 0;
    return onScrollFrame((y) => {
      const el = bar.current; if (!el) return;
      el.classList.toggle('tuck', y > 220 && y > last);
      last = y;
    });
  }, []);
  const specs = useMemo(() => {
    const n = new Map();
    for (const m of rows || []) if (m.specialty) n.set(m.specialty, (n.get(m.specialty) || 0) + 1);
    return [...n.entries()].filter(([, k]) => k > 1).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([s]) => s);
  }, [rows]);
  const list = useMemo(() => {
    const s = q.trim();
    return (rows || []).filter((m) => (!s || m.full_name?.includes(s) || m.specialty?.includes(s) || m.tagline?.includes(s))
      && (!chip || m.specialty === chip.value));
  }, [rows, q, chip]);
  const pick = (c) => setChip((cur) => (cur && cur.kind === c.kind && cur.value === c.value ? null : c));
  return (
    <>
      <div className="head">
        <div>
          <h1>طلاب سبارك</h1>
          <p>أعضاء دورات سبارك للابتكار والإبداع</p>
        </div>
      </div>
      {stats && (
        <div className="stats glass" role="group" aria-label="أرقام سبارك">
          <span><b><CountUp to={stats.members} /></b>عضو</span>
          <span><b><CountUp to={stats.live_courses} /></b>{stats.live_courses === 1 ? 'دورة جارية' : 'دورات جارية'}</span>
          <span><b><CountUp to={stats.stories_today} /></b>ستوري اليوم</span>
        </div>
      )}
      <div className="filters" ref={bar}>
        <label className="search glass">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
          <span className="sr">بحث</span>
          <input type="search" placeholder="دوّر باسم أو تخصص" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        {specs.length > 0 && (
          <div className="chips" role="group" aria-label="فلترة">
            <button className={`fchip ${!chip ? 'on' : ''}`} aria-pressed={!chip} onClick={() => setChip(null)}>الكل</button>
            {specs.map((s) => (
              <button key={'s' + s} className={`fchip ${chip?.kind === 'spec' && chip.value === s ? 'on' : ''}`} aria-pressed={chip?.kind === 'spec' && chip.value === s} onClick={() => pick({ kind: 'spec', value: s })}>{s}</button>
            ))}
          </div>
        )}
      </div>
      {err && <div className="err" role="alert">{err}</div>}
      {!rows && !err ? <SkCards n={9} /> : (
        <div className="cards">
          {list.map((m, i) => <MemberCard key={m.id} m={m} i={i} />)}
          {rows && !list.length && (
            <div style={{ gridColumn: '1/-1' }}>
              {q || chip ? <Empty art="people" title="ما لقينا حدا بهالاسم 🔍" text="جرّب كلمة تانية أو جزء من الاسم." />
                : <Empty art="people" title="الصفحة بتستنى نجومها ✨" text="الأعضاء بيظهروا هون أول ما تبلّش دوراتهم." />}
            </div>
          )}
        </div>
      )}
    </>
  );
}
