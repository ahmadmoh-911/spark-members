import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { friendlyError, supabase } from '../lib/supabase.js';
import { SkCards, Empty, CountUp } from '../ui.jsx';
import { onScrollFrame } from '../gestures.js';
import { BackBtn } from './Member.jsx';
import { courseStatus, coverStyle, courseTimeline } from './Courses.jsx';
import { MemberCard } from './Students.jsx';
import { CourseWall } from './Stories.jsx';

const fmt = (d) => (d ? new Date(d + 'T00:00').toLocaleDateString('ar', { day: 'numeric', month: 'long', year: 'numeric' }) : '');

export default function Course({ id }) {
  const [c, setC] = useState(null);
  const [roster, setRoster] = useState(null);
  const [err, setErr] = useState('');
  const heroRef = useRef(null), artRef = useRef(null), miniRef = useRef(null);
  useEffect(() => {
    Promise.all([supabase.rpc('public_courses', undefined, { get: true }), supabase.rpc('course_roster', { p_course: Number(id) }, { get: true })])
      .then(([a, b]) => {
        if (a.error || b.error) { setErr(friendlyError(a.error || b.error)); return; }
        setC(a.data.find((x) => String(x.id) === String(id)) || false);
        setRoster(b.data);
      });
  }, [id]);

  // cinematic hero: the cover drifts slower than the page; once it's gone the title sits in the top bar
  useEffect(() => {
    if (!c) return;
    const stop = onScrollFrame((y) => { if (artRef.current && y < 500) artRef.current.style.transform = `translateY(${y * 0.3}px) scale(1.06)`; });
    const io = new IntersectionObserver(([e]) => miniRef.current?.classList.toggle('on', !e.isIntersecting && e.boundingClientRect.bottom < 90), { rootMargin: '-72px 0px 0px 0px' });
    if (heroRef.current) io.observe(heroRef.current);
    return () => { stop(); io.disconnect(); miniRef.current?.classList.remove('on'); };
  }, [c]);

  if (err) return <><BackBtn to="courses" /><div className="err" role="alert">{err}</div></>;
  if (c === null) return <><div className="sk sk-course" style={{ maxHeight: 360 }} /><div style={{ height: 16 }} /><SkCards n={6} /></>;
  if (!c) return <><BackBtn to="courses" /><p className="empty">الدورة مش موجودة.</p></>;
  const tl = courseTimeline(c);
  const shown = roster.filter((m) => m.student_id).length;
  return (
    <>
      {createPortal(<div className="minihead" ref={miniRef} aria-hidden="true"><b>{c.title}</b></div>, document.body)}
      <BackBtn to="courses" />
      <div className="chero cine" ref={heroRef}>
        <span className="art" ref={artRef} style={coverStyle(c)} />
        <span className="scrim" />
        <span className={`cstatus ${tl?.kind || ''}`}>{tl?.kind === 'soon' ? tl.label : courseStatus(c)}</span>
        <div className="info">
          <h1>{c.title}</h1>
          <span className="tr">{[c.category, c.trainer_name && `المدرب: ${c.trainer_name}`, c.start_date && `${fmt(c.start_date)} — ${fmt(c.end_date)}`].filter(Boolean).join(' · ')}</span>
          <span className="cnums">
            <span><b><CountUp to={shown} /></b>طالب</span>
            {tl?.kind === 'live' && <span className="cprog"><span className="bar2"><i style={{ width: `${tl.pct}%` }} /></span><span>{tl.label}</span></span>}
          </span>
        </div>
      </div>
      {c.description && <p className="cdesc glass">{c.description}</p>}
      <div className="head"><div><h1 style={{ fontSize: 22 }}>طلاب الدورة {roster.length ? `(${roster.length})` : ''}</h1></div></div>
      <div className="cards">
        {roster.map((m, i) => <MemberCard key={m.student_id || 'seat' + i} m={m} i={i} />)}
        {!roster.length && <div style={{ gridColumn: '1/-1' }}><Empty art="people" title={courseStatus(c) === 'قريباً' ? 'الطلاب بيظهروا أول يوم بالدورة 🚀' : 'لسا ما في طلاب'} text={courseStatus(c) === 'قريباً' ? 'استنّوا الانطلاقة!' : ''} /></div>}
      </div>
      {courseStatus(c) !== 'قريباً' && (
        <>
          <div className="head"><div><h1 style={{ fontSize: 22 }}>حائط الدورة</h1><p>ستوريات طلاب الدورة، اكبس على أي وحدة</p></div></div>
          <CourseWall courseId={c.id} />
        </>
      )}
    </>
  );
}
