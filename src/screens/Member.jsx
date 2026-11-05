import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../lib/auth.jsx';
import { friendlyError, membershipNo, supabase } from '../lib/supabase.js';
import { go, peek } from '../lib/router.js';
import { Photo, TierRow, Tick, SkLines, Empty, CountUp, celebrate, courseColor } from '../ui.jsx';
import { onScrollFrame } from '../gestures.js';
import ProfileForm from './ProfileForm.jsx';
import Works from './Works.jsx';
import { StoryGrid, Viewer, STORY_SELECT } from './Stories.jsx';
import { JoinCard } from './Join.jsx';
import Certificate from '../Certificate.jsx';
import { Sheet, Toast } from '../sheet.jsx';

const DOTS = ['var(--green)', 'var(--blue)', 'var(--orange)', 'var(--yellow)'];
const ROLE = { admin: 'إدارة', trainer: 'مدرب' };
const TABS = [['about', 'عنّي'], ['certs', 'الشهادات'], ['works', 'الأعمال'], ['stories', 'الستوريات']];
const isPdf = (u = '') => /\.pdf($|\?)/i.test(u);
export const memberLink = (id) => `${location.origin}${import.meta.env.BASE_URL}#/member/${id}`;

export function BackBtn({ to = 'students' }) {
  return (
    <button className="back glass press" onClick={() => (history.length > 1 ? history.back() : go(to))}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>رجوع
    </button>
  );
}

// share the membership link (native share sheet on phones, copy elsewhere)
async function share(p, toast) {
  const url = memberLink(p.id);
  const text = `عضوية ${p.full_name} في سبارك للابتكار والإبداع`;
  try {
    if (navigator.share) { await navigator.share({ title: text, text, url }); return; }
    await navigator.clipboard.writeText(url); toast('انتسخ الرابط ✓');
  } catch { /* cancelled */ }
}

function QrSheet({ p, onClose }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    import('qrcode').then(({ default: QR }) => QR.toDataURL(memberLink(p.id), { width: 640, margin: 1, color: { dark: '#134F96', light: '#FFFFFF' }, errorCorrectionLevel: 'M' })).then(setSrc);
  }, [p.id]);
  return (
    <Sheet title="QR العضوية" onClose={onClose}>
      <div className="qrbox">
        {src ? <img src={src} alt={`QR لعضوية ${p.full_name}`} /> : <div className="sk" style={{ width: 240, height: 240, borderRadius: 16 }} />}
        <b>{p.full_name}</b>
        {p.member_no && <span dir="ltr">{membershipNo(p.member_no)}</span>}
      </div>
      <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 14, margin: '6px 0 0' }}>بكاميرا أي جوال بيفتح عضويتك مباشرة. حلو للمعارض والفعاليات.</p>
      {src && <a className="cta press" style={{ display: 'grid', placeItems: 'center', textDecoration: 'none' }} href={src} download={`spark-${p.member_no || 'member'}-qr.png`}>نزّل الصورة</a>}
    </Sheet>
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
  const [qr, setQr] = useState(false);
  const [tab, setTab] = useState('about');

  useEffect(() => {
    let alive = true;
    Promise.all([
      supabase.from('profiles').select('id,member_no,full_name,specialty,tagline,about,skills,goals,photo_url,cover_url,role').eq('id', id).maybeSingle(),
      supabase.rpc('member_courses', { p_member: id }),
      supabase.rpc('member_certificates', { p_member: id }),
      supabase.from('works').select('*').eq('owner_id', id).order('id', { ascending: false }),
      supabase.rpc('member_visible', { p_member: id }),
      supabase.rpc('member_stats', { p_member: id }),
    ]).then(([p, c, cert, w, vis, st]) => {
      if (!alive) return;
      const e = p.error || c.error || cert.error || w.error;
      if (e) { setErr(friendlyError(e)); return; }
      setD({ p: p.data, courses: c.data, certs: cert.data, works: w.data, visible: vis.data, stats: st.data?.[0] || null });
    });
    return () => { alive = false; };
  }, [id, me, tick]);

  // a new certificate since my last visit → celebrate once
  useEffect(() => {
    if (!own || !d?.certs) return;
    try {
      const k = 'spark-certs-seen-' + id;
      const seen = Number(localStorage.getItem(k) ?? 0);
      if (d.certs.length > seen) { celebrate(); setMsg('مبروك الشهادة الجديدة! 🎓'); }
      localStorage.setItem(k, String(d.certs.length));
    } catch { /* ignore */ }
  }, [own, d?.certs?.length]);

  // live story → coloured ring on the avatar; tap it to watch
  const [live, setLive] = useState([]);
  const [watching, setWatching] = useState(false);
  useEffect(() => {
    supabase.from('stories').select(STORY_SELECT).eq('author_id', id).gte('created_at', new Date(Date.now() - 864e5).toISOString()).order('created_at')
      .then(({ data }) => setLive(data || []));
  }, [id, watching]);

  // a soft glow in the photo's own colour

  // native-feeling header: the cover drifts slower than the page, and once the photo
  // scrolls away a mini name+photo slides into the top bar (no React re-renders while scrolling)
  const coverRef = useRef(null), avRef = useRef(null), miniRef = useRef(null);
  const ready = !!(d?.p || peek.get(id));
  useEffect(() => {
    if (!ready) return;
    const stop = onScrollFrame((y) => { if (coverRef.current && y < 400) coverRef.current.style.transform = `translateY(${y * 0.35}px)`; });
    const io = new IntersectionObserver(([e]) => miniRef.current?.classList.toggle('on', !e.isIntersecting && e.boundingClientRect.bottom < 90), { rootMargin: '-72px 0px 0px 0px' });
    if (avRef.current) io.observe(avRef.current);
    return () => { stop(); io.disconnect(); miniRef.current?.classList.remove('on'); };
  }, [ready, id]);

  if (err) return <><BackBtn /><div className="err" role="alert">{err}</div></>;
  const pk = peek.get(id);
  const p = d?.p || (d ? null : pk);
  if (d && !d.p) return <><BackBtn /><Empty art="people" title="العضوية مش ظاهرة" text="يمكن لسا دورتها ما بلّشت، أو الرابط غلط." /></>;
  if (!p) return <><BackBtn /><div className="pcard glass"><div className="pcover sk" /><div className="pbody"><SkLines n={4} /></div></div></>;
  const courses = d?.courses || [];
  const certs = d?.certs || [];
  const works = d?.works || [];
  const stats = d?.stats;

  return (
    <>
      {!own && <BackBtn />}
      {createPortal(
        <div className="minihead" ref={miniRef} aria-hidden="true">
          <Photo url={p.photo_url} id={p.id} /><b>{p.full_name}</b>
        </div>, document.body)}
      <section className="pcard glass" style={{ marginTop: own ? 6 : 0 }}>
        <div className="pcover-wrap">
          <div ref={coverRef} className={`pcover ${p.cover_url ? 'has-img' : ''}`} aria-hidden="true">
            {p.cover_url ? <img src={p.cover_url} alt="" /> : <><i /><i /><i /><i /></>}
          </div>
        </div>
        <div className="pbody">
          {live.length > 0 ? (
            <button ref={avRef} className="avatar big pav noring tap press" onClick={() => setWatching(true)} aria-label={`شوف ستوري ${p.full_name}`}>
              <Photo url={p.photo_url} id={p.id} />
            </button>
          ) : (
            <span ref={avRef} className="avatar big pav noring">
              <Photo url={p.photo_url} id={p.id} />
            </span>
          )}
          <h1 className="pname">
            {p.full_name}
            {courses.length >= 2 && <Tick />}
            {ROLE[p.role] && <span className="role-pill">{ROLE[p.role]}</span>}
          </h1>
          {p.specialty && <span className="spec">{p.specialty}</span>}
          {p.tagline && <span className="quote">{p.tagline}</span>}
          {p.role === 'student' && p.member_no && <span className="member">رقم العضوية <b dir="ltr">{membershipNo(p.member_no)}</b></span>}

          {stats && p.role === 'student' && (
            <div className="pstats">
              <button onClick={() => setTab('about')}><b><CountUp to={stats.courses} /></b>{stats.courses === 1 ? 'دورة' : 'دورات'}</button>
              <button onClick={() => setTab('certs')}><b><CountUp to={stats.certificates} /></b>{stats.certificates === 1 ? 'شهادة' : 'شهادات'}</button>
              <button onClick={() => setTab('stories')}><b><CountUp to={stats.stories} /></b>ستوري</button>
            </div>
          )}

          <div className="pacts">
            {own && <button className="pbtn primary press" onClick={() => setEditing(true)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z" /></svg>تعديل</button>}
            <button className="pbtn press" onClick={() => share(p, setMsg)}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg>شارك</button>
            <button className="pbtn press" onClick={() => setQr(true)}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3M21 14v7h-4M17 21v-3" /></svg>QR</button>
            {own && <button className="pbtn press" onClick={async () => { await signOut(); go('students'); }}>خروج</button>}
          </div>
        </div>
      </section>

      {own && p.role === 'student' && d && !d.visible && (
        <div className="hidden-note">عضويتك مخفية عن الناس لحد ما الإدارة تضيف إيميلك على دورة وتبلّش.</div>
      )}

      <div className="seg ptabs2" role="tablist" aria-label="أقسام العضوية">
        {TABS.map(([k, l]) => <button key={k} role="tab" aria-checked={tab === k} onClick={() => setTab(k)}>{l}</button>)}
      </div>

      {!d ? <div className="sec glass"><SkLines n={4} /></div> : (
        <div key={tab} className="tabpane">
          {tab === 'about' && (
            <div className="pcols">
              <div style={{ display: 'grid', gap: 12 }}>
                <section className="sec glass">
                  <h2>عنّي</h2>
                  {p.about ? <p>{p.about}</p> : <p style={{ color: 'var(--muted)' }}>{own ? 'اضغط «تعديل» واكتب كم كلمة عنك.' : 'لسا ما كتب عن حاله.'}</p>}
                  {p.skills?.length > 0 && <div className="picks">{p.skills.map((s) => <span key={s} className="chip">{s}</span>)}</div>}
                </section>
                {p.goals?.length > 0 && (
                  <section className="sec glass">
                    <h2>أهدافي مع مجتمع سبارك</h2>
                    <ul className="goals">{p.goals.map((g, i) => <li key={i}><i style={{ '--c': DOTS[i % 4] }} />{g}</li>)}</ul>
                  </section>
                )}
              </div>
              <div style={{ display: 'grid', gap: 12 }}>
                <section className="sec glass">
                  <h2>دورات سبارك</h2>
                  <div className="list">
                    {courses.map((c) => (
                      <button key={c.course_id} className="row press" style={{ border: 0, textAlign: 'start' }} onClick={() => go('course/' + c.course_id)}>
                        <span>{c.title}</span>
                        {c.category && <span className="chip"><i style={{ '--c': courseColor(c.course_id) }} />{c.category}</span>}
                      </button>
                    ))}
                    {!courses.length && <p style={{ color: 'var(--muted)', margin: 0 }}>لسا ما في دورات.</p>}
                  </div>
                </section>
                {own && p.role === 'student' && <JoinCard myCourses={courses} toast={setMsg} />}
              </div>
            </div>
          )}

          {tab === 'certs' && (
            <section className="sec glass">
              {certs.length ? (
                <div className="certs">
                  {certs.map((c, i) => (
                    <div key={c.course_id} className="ccert" style={{ animationDelay: `${i * 60}ms` }}>
                      {c.certificate_url && isPdf(c.certificate_url) ? (
                        <a className="pdf press" href={c.certificate_url} target="_blank" rel="noopener">
                          <svg viewBox="0 0 24 24" width="44" height="44" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4" /></svg>افتح الشهادة (PDF)
                        </a>
                      ) : (
                        <button className="open press" onClick={() => setDoc(c)} aria-label={`كبّر شهادة ${c.title}`}>
                          {c.certificate_url
                            ? <img className="file" src={c.certificate_url} alt={`شهادة ${c.title}`} />
                            : <Certificate name={p.full_name} course={c.title} date={c.certificate_date} code={c.certificate_code} trainer={c.trainer_name} />}
                        </button>
                      )}
                      <h3>{c.title}</h3>
                      <TierRow tier={c.tier} />
                    </div>
                  ))}
                </div>
              ) : <Empty art="certs" title={own ? 'شهادتك جاية 🎓' : 'لسا ما في شهادات'} text="الشهادات بتظهر هون بعد ما تخلص الدورة وتصدرها الإدارة." />}
              {own && p.role === 'student' && (
                <div className="lock">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
                  دورات سبارك وشهاداتها وتقييماتها بتضيفها الإدارة والمدربين، وما بتتعدّل من عندك.
                </div>
              )}
            </section>
          )}

          {tab === 'works' && (
            works.length || own
              ? <Works works={works} own={own} ownerId={id} onChange={() => setTick((t) => t + 1)} toast={setMsg} />
              : <section className="sec glass"><Empty art="courses" title="لسا ما في أعمال" text="المشاريع والشهادات من برّا سبارك بتظهر هون." /></section>
          )}

          {tab === 'stories' && <section className="sec glass"><StoryGrid member={id} /></section>}
        </div>
      )}

      {editing && (
        <Sheet title="تعديل العضوية" onClose={() => setEditing(false)}>
          {(close) => <ProfileForm mode="edit" onDone={() => { close(); setMsg('انحفظت التعديلات'); }} />}
        </Sheet>
      )}
      {qr && <QrSheet p={p} onClose={() => setQr(false)} />}
      {watching && live.length > 0 && <Viewer groups={[{ author: live[0].author, stories: live }]} start={0} onClose={() => setWatching(false)} />}
      {doc && (
        <Sheet title={`شهادة ${doc.title}`} onClose={() => setDoc(null)}>
          {doc.certificate_url ? (
            <>
              <img src={doc.certificate_url} alt={`شهادة ${doc.title}`} style={{ width: '100%', borderRadius: 16, display: 'block' }} />
              <a className="ghost press" style={{ display: 'grid', placeItems: 'center', textDecoration: 'none', color: 'inherit' }} href={doc.certificate_url} target="_blank" rel="noopener">افتح بحجم كامل</a>
            </>
          ) : <Certificate name={p.full_name} course={doc.title} date={doc.certificate_date} code={doc.certificate_code} trainer={doc.trainer_name} />}
        </Sheet>
      )}
      <Toast msg={msg} onDone={() => setMsg('')} />
    </>
  );
}
