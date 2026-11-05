import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../lib/auth.jsx';
import { friendlyError, supabase } from '../lib/supabase.js';
import { Photo, Spinner } from '../ui.jsx';
import { Sheet } from '../sheet.jsx';
import { courseStatus } from './Courses.jsx';

const today = () => new Date().toLocaleDateString('en-CA');
const fmt = (d) => (d ? new Date(d + 'T00:00').toLocaleDateString('ar', { day: 'numeric', month: 'long' }) : '');

// Student side: ask to be added to an open / upcoming course (completes an enrolment done with Spark staff)
export function JoinCard({ myCourses = [], toast }) {
  const { user } = useAuth();
  const [mine, setMine] = useState(null);
  const [open, setOpen] = useState(false);
  const load = useCallback(async () => {
    const { data } = await supabase.from('join_requests').select('id,course_id,created_at,course:courses(title,start_date)').eq('user_id', user.id).order('created_at');
    setMine(data || []);
  }, [user]);
  useEffect(() => { load(); }, [load]);

  const cancel = async (id) => {
    const { error } = await supabase.from('join_requests').delete().eq('id', id);
    if (error) toast(friendlyError(error)); else { toast('انلغى الطلب'); load(); }
  };

  return (
    <section className="sec glass join">
      <h2>الانضمام لدورة</h2>
      <p style={{ color: 'var(--ink-2)', lineHeight: 1.8 }}>إذا سجّلت بدورة مع إدارة سبارك، قدّم طلب انضمام لصفحتها هون عشان تكمّل تسجيلك.</p>
      {mine?.length > 0 && (
        <div className="list" style={{ marginTop: 10 }}>
          {mine.map((r) => (
            <div key={r.id} className="irow">
              <span className="t"><b style={{ display: 'block' }}>{r.course?.title}</b><span style={{ fontSize: 12, color: 'var(--muted)' }}>طلبك عند الإدارة قيد المراجعة ⏳</span></span>
              <button className="link" style={{ color: '#D64535' }} onClick={() => cancel(r.id)}>إلغاء</button>
            </div>
          ))}
        </div>
      )}
      <button className="pbtn primary press" style={{ marginTop: 12 }} onClick={() => setOpen(true)}>+ قدّم طلب انضمام</button>
      {open && <JoinSheet taken={new Set([...(mine || []).map((r) => r.course_id), ...myCourses.map((c) => c.course_id)])} onClose={() => setOpen(false)} onSent={() => { setOpen(false); toast('انبعت طلبك للإدارة'); load(); }} />}
    </section>
  );
}

function JoinSheet({ taken, onClose, onSent }) {
  const { user } = useAuth();
  const [courses, setCourses] = useState(null);
  const [pick, setPick] = useState(new Set());
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => {
    supabase.rpc('public_courses').then(({ data, error }) => {
      if (error) { setErr(friendlyError(error)); return; }
      setCourses((data || []).filter((c) => c.end_date >= today() && !taken.has(c.id)).sort((a, b) => (a.start_date > b.start_date ? 1 : -1)));
    });
  }, []);
  const toggle = (id) => { const n = new Set(pick); n.has(id) ? n.delete(id) : n.add(id); setPick(n); };
  const send = async () => {
    if (!pick.size) { setErr('اختار دورة وحدة على الأقل.'); return; }
    if (!ok) { setErr('أكّد إنك مسجّل بالدورة مع إدارة سبارك.'); return; }
    setBusy(true); setErr('');
    const { error } = await supabase.from('join_requests').insert([...pick].map((course_id) => ({ course_id, user_id: user.id })));
    if (error) { setErr(friendlyError(error)); setBusy(false); return; }
    onSent();
  };
  return (
    <Sheet title="طلب انضمام لدورة" onClose={onClose}>
      <div className="hidden-note" style={{ marginTop: 0, alignItems: 'flex-start' }}>
        <span>هالطلب <b>لإكمال التسجيل بس</b>. لازم تكون مسجّل بالدورة من قبل ومتواصل مع إدارة سبارك، والإدارة رح تتأكد قبل ما تقبلك.</span>
      </div>
      {!courses && !err ? <Spinner /> : (
        <div className="list" style={{ marginTop: 12 }}>
          {courses?.map((c) => (
            <button key={c.id} type="button" className={`irow press jpick ${pick.has(c.id) ? 'on' : ''}`} aria-pressed={pick.has(c.id)} onClick={() => toggle(c.id)}>
              <span className="jbox" aria-hidden="true">{pick.has(c.id) ? '✓' : ''}</span>
              <span className="t" style={{ textAlign: 'start' }}>
                <b style={{ display: 'block' }}>{c.title}</b>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>{courseStatus(c) === 'قريباً' ? `بتفتح ${fmt(c.start_date)}` : 'فاتحة هلأ'}{c.trainer_name ? ` · ${c.trainer_name}` : ''}</span>
              </span>
            </button>
          ))}
          {courses && !courses.length && <p className="empty" style={{ padding: 12 }}>ما في دورات فاتحة أو قريبة هلأ.</p>}
        </div>
      )}
      <label className="jconfirm">
        <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} />
        <span>أنا مسجّل بهالدورة مع إدارة سبارك</span>
      </label>
      {err && <div className="err" role="alert">{err}</div>}
      <button className="cta press" onClick={send} disabled={busy || !courses?.length}>{busy ? 'جارٍ الإرسال…' : `ابعت الطلب${pick.size > 1 ? ` (${pick.size})` : ''}`}</button>
    </Sheet>
  );
}

// Admin side: incoming requests, approve (enrols the member) or delete
export function Requests({ toast, onCount }) {
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(null);
  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('admin_join_requests');
    if (error) toast(friendlyError(error)); else { setRows(data); onCount?.(data.length); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const act = async (r, approve) => {
    setBusy(r.id);
    const { error } = approve
      ? await supabase.rpc('approve_join_request', { p_request: r.id })
      : await supabase.from('join_requests').delete().eq('id', r.id);
    setBusy(null);
    if (error) toast(friendlyError(error)); else { toast(approve ? `انضاف ${r.full_name} لـ ${r.course_title}` : 'انحذف الطلب'); load(); }
  };
  if (!rows) return <Spinner />;
  return (
    <section className="sec glass">
      <h2>طلبات الانضمام {rows.length ? `(${rows.length})` : ''}</h2>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>تأكد إنه الطالب مسجّل فعلاً بالدورة قبل ما تقبله.</p>
      <div className="list">
        {rows.map((r) => (
          <div key={r.id} className="erow">
            <div className="top-line">
              <Photo url={r.photo_url} id={r.user_id} />
              <span style={{ minWidth: 0 }}>
                <b style={{ display: 'block' }}>{r.full_name}</b>
                <span dir="ltr" style={{ display: 'block', fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.email}</span>
                <span style={{ display: 'block', fontSize: 13, color: 'var(--blue)', fontWeight: 600 }}>{r.course_title}</span>
              </span>
            </div>
            <div className="acts" style={{ justifyContent: 'flex-end' }}>
              <button className="link" style={{ color: '#D64535' }} disabled={busy === r.id} onClick={() => act(r, false)}>حذف</button>
              <button className="save press" disabled={busy === r.id} onClick={() => act(r, true)}>تأكيد</button>
            </div>
          </div>
        ))}
        {!rows.length && <p className="empty" style={{ padding: 12 }}>ما في طلبات جديدة.</p>}
      </div>
    </section>
  );
}
