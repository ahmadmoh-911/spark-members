import { useEffect, useState } from 'react';
import { friendlyError, supabase } from '../lib/supabase.js';
import { go } from '../lib/router.js';
import { gradFor, Photo, SkCourses, Empty } from '../ui.jsx';

export function courseStatus(c) {
  const t = new Date().toLocaleDateString('en-CA');
  if (c.start_date && t < c.start_date) return 'قريباً';
  if (c.end_date && t > c.end_date) return 'انتهت';
  return 'جارية';
}
const DAYMS = 864e5;
const d0 = (s) => new Date(s + 'T00:00');
// where the course is right now: progress through its weeks, or days until it opens
export function courseTimeline(c) {
  const today = d0(new Date().toLocaleDateString('en-CA'));
  if (!c.start_date || !c.end_date) return null;
  const start = d0(c.start_date), end = d0(c.end_date);
  if (today < start) {
    const n = Math.round((start - today) / DAYMS);
    return { kind: 'soon', label: n === 1 ? 'بتفتح بكرا' : n === 2 ? 'بتفتح بعد يومين' : `بتفتح بعد ${n} ${n <= 10 ? 'أيام' : 'يوم'}` };
  }
  if (today > end) return { kind: 'done', label: 'انتهت', pct: 100 };
  const total = Math.max(1, Math.round((end - start) / DAYMS) + 1);
  const done = Math.round((today - start) / DAYMS) + 1;
  const weeks = Math.max(1, Math.ceil(total / 7));
  const week = Math.min(weeks, Math.ceil(done / 7));
  return { kind: 'live', label: `الأسبوع ${week} من ${weeks}`, pct: Math.round((done / total) * 100) };
}

// a few faces + the full count; every student is listed on the course page itself
export function Faces({ faces = [], count = 0 }) {
  if (!count) return null;
  return (
    <span className="faces">
      <span className="stack">{faces.slice(0, 5).map((f) => <Photo key={f.id} url={f.photo} id={f.id} />)}</span>
      <span className="fc">{count} {count === 1 ? 'طالب' : count <= 10 ? 'طلاب' : 'طالب'} · شوفهم كلهم</span>
    </span>
  );
}

export const coverStyle = (c) => ({
  '--cover': c.cover_url ? `center/cover no-repeat url("${c.cover_url}")` : gradFor('c' + c.id),
});

export default function Courses() {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    supabase.rpc('public_courses', undefined, { get: true }).then(({ data, error }) => {
      if (error) setErr(friendlyError(error)); else setRows(data);
    });
  }, []);
  return (
    <>
      <div className="head"><div><h1>الدورات</h1><p>دورات سبارك وطلابها</p></div></div>
      {err && <div className="err" role="alert">{err}</div>}
      {!rows && !err ? <SkCourses n={3} /> : (
        <div className="courses">
          {rows?.map((c, i) => {
            const tl = courseTimeline(c);
            return (
              <button key={c.id} className="ccard press" style={{ ...coverStyle(c), animationDelay: `${i * 40}ms`, border: 0, textAlign: 'start' }} onClick={() => go('course/' + c.id)}>
                <span className="scrim" />
                <span className={`cstatus ${tl?.kind || ''}`}>{tl?.kind === 'soon' ? tl.label : courseStatus(c)}</span>
                <span className="info">
                  <h3>{c.title}</h3>
                  <span className="tr">{[c.category, c.trainer_name && `المدرب: ${c.trainer_name}`].filter(Boolean).join(' · ')}</span>
                  {tl?.kind === 'live' && (
                    <span className="cprog"><span className="bar2"><i style={{ width: `${tl.pct}%` }} /></span><span>{tl.label}</span></span>
                  )}
                  <Faces faces={c.faces} count={c.member_count} />
                </span>
              </button>
            );
          })}
          {rows && !rows.length && <Empty art="courses" title="الدورات جاية قريباً 📚" text="أول ما تنضاف دورة بتطلع هون مع طلابها." />}
        </div>
      )}
    </>
  );
}
