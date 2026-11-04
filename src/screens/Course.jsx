import { useEffect, useState } from 'react';
import { friendlyError, supabase } from '../lib/supabase.js';
import { Spinner } from '../ui.jsx';
import { BackBtn } from './Member.jsx';
import { courseStatus, coverStyle } from './Courses.jsx';
import { MemberCard } from './Students.jsx';

const fmt = (d) => (d ? new Date(d + 'T00:00').toLocaleDateString('ar', { day: 'numeric', month: 'long', year: 'numeric' }) : '');

export default function Course({ id }) {
  const [c, setC] = useState(null);
  const [roster, setRoster] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    Promise.all([supabase.rpc('public_courses'), supabase.rpc('course_roster', { p_course: Number(id) })])
      .then(([a, b]) => {
        if (a.error || b.error) { setErr(friendlyError(a.error || b.error)); return; }
        setC(a.data.find((x) => String(x.id) === String(id)) || false);
        setRoster(b.data);
      });
  }, [id]);

  if (err) return <><BackBtn to="courses" /><div className="err" role="alert">{err}</div></>;
  if (c === null) return <Spinner />;
  if (!c) return <><BackBtn to="courses" /><p className="empty">الدورة مش موجودة.</p></>;
  return (
    <>
      <BackBtn to="courses" />
      <div className="chero" style={coverStyle(c)}>
        <span className="scrim" />
        <span className="cstatus">{courseStatus(c)}</span>
        <div className="info">
          <h1>{c.title}</h1>
          <span className="tr">{[c.category, c.trainer_name && `المدرب: ${c.trainer_name}`, c.start_date && `${fmt(c.start_date)} — ${fmt(c.end_date)}`].filter(Boolean).join(' · ')}</span>
        </div>
      </div>
      {c.description && <p className="cdesc glass">{c.description}</p>}
      <div className="head"><div><h1 style={{ fontSize: 22 }}>طلاب الدورة</h1></div></div>
      <div className="cards">
        {roster.map((m, i) => <MemberCard key={m.student_id || 'seat' + i} m={m} i={i} />)}
        {!roster.length && <p className="empty">{courseStatus(c) === 'قريباً' ? 'الطلاب بيظهروا لما تبلّش الدورة.' : 'لسا ما في طلاب.'}</p>}
      </div>
    </>
  );
}
