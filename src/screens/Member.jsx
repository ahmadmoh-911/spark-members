import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth.jsx';
import { friendlyError, membershipNo, supabase } from '../lib/supabase.js';
import { go } from '../lib/router.js';
import { LOGO_DARK, Photo, Spinner, TierRow, Tick } from '../ui.jsx';
import ProfileForm from './ProfileForm.jsx';
import Works from './Works.jsx';
import { ArchiveButton } from './Stories.jsx';
import { Sheet, Toast } from '../sheet.jsx';

const DOTS = ['var(--green)', 'var(--blue)', 'var(--orange)', 'var(--yellow)'];
const ROLE = { admin: 'إدارة', trainer: 'مدرب' };

const isPdf = (u = '') => /\.pdf($|\?)/i.test(u);
// certificate file thumbnail: image preview, PDF badge, or the Spark logo when there's no file
function CertThumb({ c, onOpen }) {
  if (!c.certificate_url) return <span className="seal"><img src={LOGO_DARK} alt="" /></span>;
  if (isPdf(c.certificate_url)) {
    return (
      <a className="seal press" href={c.certificate_url} target="_blank" rel="noopener" aria-label={`افتح شهادة ${c.title} (PDF)`} style={{ textDecoration: 'none', color: '#D64535', fontWeight: 700, fontSize: 13, flexDirection: 'column' }}>
        <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4" /></svg>PDF
      </a>
    );
  }
  return (
    <button className="seal press" onClick={onOpen} aria-label={`اعرض شهادة ${c.title}`} style={{ border: 0, padding: 0, overflow: 'hidden', cursor: 'zoom-in' }}>
      <img src={c.certificate_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </button>
  );
}

export function BackBtn({ to = 'students' }) {
  return (
    <button className="back glass press" onClick={() => (history.length > 1 ? history.back() : go(to))}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>رجوع
    </button>
  );
}

export default function Member({ id }) {
  const { user, profile: me, signOut } = useAuth();
  const own = user?.id === id;
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [editing, setEditing] = useState(false);
  const [tick, setTick] = useState(0);
  const [msg, setMsg] = useState('');
  const [doc, setDoc] = useState(null);

  useEffect(() => {
    let alive = true;
    Promise.all([
      supabase.from('profiles').select('id,member_no,full_name,specialty,tagline,about,skills,goals,photo_url,role').eq('id', id).maybeSingle(),
      supabase.rpc('member_courses', { p_member: id }),
      supabase.rpc('member_certificates', { p_member: id }),
      supabase.from('works').select('*').eq('owner_id', id).order('id', { ascending: false }),
      supabase.rpc('member_visible', { p_member: id }),
    ]).then(([p, c, cert, w, vis]) => {
      if (!alive) return;
      const e = p.error || c.error || cert.error || w.error;
      if (e) { setErr(friendlyError(e)); return; }
      setD({ p: p.data, courses: c.data, certs: cert.data, works: w.data, visible: vis.data });
    });
    return () => { alive = false; };
  }, [id, me, tick]);

  if (err) return <><BackBtn /><div className="err" role="alert">{err}</div></>;
  if (!d) return <Spinner />;
  if (!d.p) return <><BackBtn /><p className="empty">العضوية مش ظاهرة أو مش موجودة.</p></>;
  const { p, courses, certs, works } = d;

  return (
    <>
      {!own && <BackBtn />}
      <section className="phead glass" style={{ marginTop: own ? 6 : 0 }}>
        <span className="avatar big"><span className="ring" /><span className="gap" /><Photo url={p.photo_url} id={p.id} /></span>
        <div style={{ minWidth: 0 }}>
          <h1 className="name" style={{ fontSize: 'inherit' }}>
            <span style={{ fontSize: 22, fontWeight: 700 }}>{p.full_name}</span>
            {courses.length >= 2 && <Tick />}
            {ROLE[p.role] && <span className="role-pill">{ROLE[p.role]}</span>}
          </h1>
          {p.specialty && <span className="spec">{p.specialty}</span>}
          {p.tagline && <span className="quote">{p.tagline}</span>}
          {p.role === 'student' && <span className="member">رقم العضوية <b dir="ltr">{membershipNo(p.member_no)}</b></span>}
          {!own && <div className="pacts"><ArchiveButton member={p.id} /></div>}
          {own && (
            <div className="pacts">
              <ArchiveButton member={p.id} />
              <button className="pbtn primary press" onClick={() => setEditing(true)}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z" /></svg>تعديل
              </button>
              <button className="pbtn press" onClick={async () => { await signOut(); go('students'); }}>خروج</button>
            </div>
          )}
        </div>
      </section>

      {own && p.role === 'student' && !d.visible && (
        <div className="hidden-note">عضويتك مخفية عن الناس لحد ما الإدارة تضيف إيميلك على دورة وتبلّش.</div>
      )}

      <div className="pcols">
        <div style={{ display: 'grid', gap: 12 }}>
          {(own || p.about || p.skills?.length > 0) && (
            <section className="sec glass">
              <h2>نبذة</h2>
              {p.about && <p>{p.about}</p>}
              {own && !p.about && !p.skills?.length && <p style={{ color: 'var(--muted)' }}>اضغط تعديل وضيف نبذة ومهاراتك.</p>}
              {p.skills?.length > 0 && <div className="picks">{p.skills.map((s) => <span key={s} className="chip">{s}</span>)}</div>}
            </section>
          )}
          {p.goals?.length > 0 && (
            <section className="sec glass">
              <h2>أهدافي مع مجتمع سبارك</h2>
              <ul className="goals">{p.goals.map((g, i) => <li key={i}><i style={{ '--c': DOTS[i % 4] }} />{g}</li>)}</ul>
            </section>
          )}
          <section className="sec glass">
            <h2>دورات سبارك</h2>
            <div className="list">
              {courses.map((c, i) => (
                <button key={c.course_id} className="row press" style={{ border: 0, textAlign: 'start' }} onClick={() => go('course/' + c.course_id)}>
                  <span>{c.title}</span>
                  {c.category && <span className="chip"><i style={{ '--c': DOTS[i % 4] }} />{c.category}</span>}
                </button>
              ))}
              {!courses.length && <p className="empty" style={{ padding: 12 }}>لسا ما في دورات.</p>}
            </div>
          </section>
        </div>
        <div style={{ display: 'grid', gap: 12 }}>
          <section className="sec glass">
            <h2>شهادات سبارك</h2>
            <div className="list">
              {certs.map((c) => (
                <div key={c.course_id} className="cert">
                  <div className="cert-top">
                    <CertThumb c={c} onOpen={() => setDoc(c)} />
                    <div style={{ minWidth: 0 }}>
                      <b>{c.title}</b>
                      {c.category && <span className="code" style={{ direction: 'rtl' }}>{c.category}</span>}
                      <span className="code">{c.certificate_code}</span>
                    </div>
                  </div>
                  <TierRow tier={c.tier} />
                </div>
              ))}
              {!certs.length && <p className="empty" style={{ padding: 12 }}>الشهادات بتظهر هون بعد ما تنتهي الدورة.</p>}
            </div>
          </section>
          <Works works={works} own={own} ownerId={id} onChange={() => setTick((t) => t + 1)} toast={setMsg} />
        </div>
      </div>
      {own && p.role === 'student' && (
        <div className="lock">
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
          دورات سبارك وشهاداتها وتقييماتها بتضيفها الإدارة والمدربين، وما بتتعدّل من عندك.
        </div>
      )}
      {editing && (
        <Sheet title="تعديل العضوية" onClose={() => setEditing(false)}>
          {(close) => <ProfileForm mode="edit" onDone={() => { close(); setMsg('انحفظت التعديلات'); }} />}
        </Sheet>
      )}
      {doc && (
        <Sheet title={`شهادة ${doc.title}`} onClose={() => setDoc(null)}>
          <img src={doc.certificate_url} alt={`شهادة ${doc.title}`} style={{ width: '100%', borderRadius: 16, display: 'block' }} />
          <a className="ghost press" style={{ display: 'grid', placeItems: 'center', textDecoration: 'none', color: 'inherit' }} href={doc.certificate_url} target="_blank" rel="noopener">افتح بحجم كامل</a>
        </Sheet>
      )}
      <Toast msg={msg} onDone={() => setMsg('')} />
    </>
  );
}
