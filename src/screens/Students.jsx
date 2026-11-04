import { useEffect, useMemo, useState } from 'react';
import { friendlyError, supabase } from '../lib/supabase.js';
import { go } from '../lib/router.js';
import { Photo, Spinner, Tick } from '../ui.jsx';

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
      <div className="scard glass" style={{ animationDelay: `${i * 30}ms`, opacity: 0.7 }}>
        <Photo id={'seat' + i} />
        <div className="t"><div className="name"><span className="nm">مقعد محجوز</span></div><span className="q">لسا ما فعّل عضويته</span></div>
      </div>
    );
  }
  const id = m.id || m.student_id;
  return (
    <button className="scard glass press" style={{ animationDelay: `${i * 30}ms` }} onClick={() => go('member/' + id)}>
      <Photo url={m.photo_url} id={id} />
      <span className="t">
        <span className="name"><span className="nm">{m.full_name}</span>{m.course_count >= 2 && <Tick />}</span>
        {m.tagline && <span className="q">{m.tagline}</span>}
      </span>
    </button>
  );
}

export default function Students() {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    supabase.rpc('public_members').then(({ data, error }) => {
      if (error) setErr(friendlyError(error)); else setRows(shuffleForNow(data));
    });
  }, []);
  const list = useMemo(() => {
    const s = q.trim();
    return (rows || []).filter((m) => !s || m.full_name?.includes(s) || m.specialty?.includes(s) || m.tagline?.includes(s));
  }, [rows, q]);

  return (
    <>
      <div className="head"><div><h1>طلاب سبارك</h1><p>أعضاء دورات سبارك للابتكار والإبداع</p></div></div>
      <label className="search glass">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
        <span className="sr">بحث</span>
        <input type="search" placeholder="دوّر باسم أو تخصص" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      {err && <div className="err" role="alert">{err}</div>}
      {!rows && !err ? <Spinner /> : (
        <div className="cards">
          {list.map((m, i) => <MemberCard key={m.id} m={m} i={i} />)}
          {rows && !list.length && <p className="empty">{q ? 'ما في نتائج.' : 'لسا ما في أعضاء ظاهرين. بيظهروا أول ما تبلّش دوراتهم.'}</p>}
        </div>
      )}
    </>
  );
}
