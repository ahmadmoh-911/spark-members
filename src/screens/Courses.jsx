import { useEffect, useState } from 'react';
import { friendlyError, supabase } from '../lib/supabase.js';
import { go } from '../lib/router.js';
import { gradFor, Spinner } from '../ui.jsx';

export function courseStatus(c) {
  const t = new Date().toISOString().slice(0, 10);
  if (c.start_date && t < c.start_date) return 'قريباً';
  if (c.end_date && t > c.end_date) return 'انتهت';
  return 'جارية';
}
export const coverStyle = (c) => ({
  '--cover': c.cover_url ? `center/cover no-repeat url("${c.cover_url}")` : gradFor('c' + c.id),
});

export default function Courses() {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    supabase.rpc('public_courses').then(({ data, error }) => {
      if (error) setErr(friendlyError(error)); else setRows(data);
    });
  }, []);
  return (
    <>
      <div className="head"><div><h1>الدورات</h1><p>دورات سبارك وطلابها</p></div></div>
      {err && <div className="err" role="alert">{err}</div>}
      {!rows && !err ? <Spinner /> : (
        <div className="courses">
          {rows?.map((c, i) => (
            <button key={c.id} className="ccard press" style={{ ...coverStyle(c), animationDelay: `${i * 40}ms`, border: 0, textAlign: 'start' }} onClick={() => go('course/' + c.id)}>
              <span className="scrim" />
              <span className="cstatus">{courseStatus(c)}</span>
              <span className="info">
                <h3>{c.title}</h3>
                <span className="tr">{[c.category, c.trainer_name && `المدرب: ${c.trainer_name}`].filter(Boolean).join(' · ')}</span>
              </span>
            </button>
          ))}
          {rows && !rows.length && <p className="empty">لسا ما انضافت دورات.</p>}
        </div>
      )}
    </>
  );
}
