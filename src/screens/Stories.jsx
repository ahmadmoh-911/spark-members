import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../lib/auth.jsx';
import { friendlyError, supabase, uploadMedia } from '../lib/supabase.js';
import { go } from '../lib/router.js';
import { Photo, Spinner } from '../ui.jsx';
import { Sheet, Toast } from '../sheet.jsx';

const DAY = 24 * 60 * 60 * 1000;
const SELECT = 'id,author_id,course_id,kind,body,media_url,created_at,author:profiles(id,full_name,photo_url),course:courses(title,category)';
const DOTS = ['var(--green)', 'var(--blue)', 'var(--orange)', 'var(--yellow)'];

export function ago(t) {
  const m = Math.max(1, Math.round((Date.now() - Date.parse(t)) / 60000));
  if (m < 60) return `قبل ${m} د`;
  const h = Math.round(m / 60);
  if (h < 24) return `قبل ${h} س`;
  return new Date(t).toLocaleDateString('ar', { day: 'numeric', month: 'short', year: 'numeric' });
}

// group a flat list (oldest first inside each person)
const group = (list) => {
  const map = new Map();
  for (const s of list) {
    if (!map.has(s.author_id)) map.set(s.author_id, { author: s.author, stories: [] });
    map.get(s.author_id).stories.push(s);
  }
  for (const g of map.values()) g.stories.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  return [...map.values()];
};

// courses this member can post to right now (started, member enrolled)
export function usePostable() {
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  useEffect(() => {
    if (!user) { setCourses([]); return; }
    const today = new Date().toISOString().slice(0, 10);
    supabase.rpc('member_courses', { p_member: user.id }).then(({ data }) => {
      setCourses((data || []).filter((c) => c.start_date && c.start_date <= today));
    });
  }, [user]);
  return courses;
}

export default function Stories() {
  const { user, profile } = useAuth();
  const postable = usePostable();
  const [groups, setGroups] = useState(null);
  const [seen, setSeen] = useState(new Set());
  const [err, setErr] = useState('');
  const [open, setOpen] = useState(null);
  const [composing, setComposing] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const since = new Date(Date.now() - DAY).toISOString();
    const { data, error } = await supabase.from('stories').select(SELECT).gte('created_at', since).order('created_at', { ascending: false });
    if (error) { setErr(friendlyError(error)); return; }
    let g = group(data);
    // my own ring first
    if (user) g = [...g.filter((x) => x.author?.id === user.id), ...g.filter((x) => x.author?.id !== user.id)];
    setGroups(g);
    if (user && data.length) {
      const { data: v } = await supabase.from('story_views').select('story_id').in('story_id', data.map((s) => s.id));
      setSeen(new Set((v || []).map((x) => x.story_id)));
    }
  }, [user]);
  useEffect(() => { load(); }, [load]);

  const mine = groups?.find((g) => g.author?.id === user?.id);
  const others = groups?.filter((g) => g.author?.id !== user?.id) || [];
  const canPost = postable.length > 0;

  return (
    <>
      <div className="head"><div><h1>الستوريات</h1><p>ستوريات أعضاء الدورات خلال آخر 24 ساعة</p></div>
        {canPost && <button className="pbtn primary press" onClick={() => setComposing(true)}>+ ستوري جديدة</button>}
      </div>
      {err && <div className="err" role="alert">{err}</div>}
      {!groups && !err ? <Spinner /> : (
        <div className="rings glass">
          {canPost && (
            <button className="sring press" onClick={() => (mine ? setOpen({ list: groups, i: 0 }) : setComposing(true))}>
              <span className={`avatar ${mine ? '' : 'noring'}`} style={{ position: 'relative' }}>
                <span className="ring" /><span className="gap" /><Photo url={profile?.photo_url} id={user.id} />
                {!mine && <span className="add" aria-hidden="true">+</span>}
              </span>
              {mine ? 'ستوريك' : 'أضف ستوري'}
            </button>
          )}
          {others.map((g) => {
            const all = g.stories.every((s) => seen.has(s.id));
            return (
              <button key={g.author.id} className="sring press" onClick={() => setOpen({ list: groups, i: groups.indexOf(g) })}>
                <span className={`avatar ${all ? 'seen' : ''}`}><span className="ring" /><span className="gap" /><Photo url={g.author.photo_url} id={g.author.id} /></span>
                <span style={{ maxWidth: 88, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.author.full_name?.split(' ')[0]}</span>
              </button>
            );
          })}
          {!others.length && !canPost && <p className="empty">ما في ستوريات بآخر 24 ساعة.</p>}
          {!others.length && canPost && !mine && <p style={{ alignSelf: 'center', color: 'var(--muted)', fontSize: 14, gridColumn: 'span 3' }}>كون أول واحد بينزّل ستوري اليوم.</p>}
        </div>
      )}
      {!user && <div className="note glass">بتقدر تتفرج بدون دخول. لتنزّل ستوري لازم تكون عضو بدورة بلّشت.</div>}
      {user && !canPost && profile?.role === 'student' && <div className="note glass">بتقدر تنزّل ستوريات لما تبلّش دورتك.</div>}

      {open && <Viewer groups={open.list} start={open.i} onClose={() => { setOpen(null); load(); }} onDeleted={() => setMsg('انحذفت الستوري')} />}
      {composing && <Composer courses={postable} onClose={() => setComposing(false)} onPosted={() => { setComposing(false); setMsg('انتشرت الستوري لمدة 24 ساعة'); load(); }} />}
      <Toast msg={msg} onDone={() => setMsg('')} />
    </>
  );
}

// ---------- composer ----------
function Composer({ courses, onClose, onPosted }) {
  const { user } = useAuth();
  const [kind, setKind] = useState('text');
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [course, setCourse] = useState(courses.find((c) => !c.end_date || c.end_date >= new Date().toISOString().slice(0, 10))?.course_id ?? courses[0]?.course_id);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const preview = file ? URL.createObjectURL(file) : '';

  const pick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith(kind === 'video' ? 'video/' : 'image/')) { setErr(kind === 'video' ? 'اختار ملف فيديو.' : 'اختار صورة.'); return; }
    if (f.size > 50 * 1024 * 1024) { setErr('الملف أكبر من 50 ميغا.'); return; }
    setErr(''); setFile(f);
  };
  const publish = async () => {
    if (kind === 'text' && !text.trim()) { setErr('اكتب إشي.'); return; }
    if (kind !== 'text' && !file) { setErr(kind === 'video' ? 'اختار فيديو.' : 'اختار صورة.'); return; }
    if (!course) { setErr('اختار الدورة.'); return; }
    setBusy(true); setErr('');
    try {
      const media_url = kind === 'text' ? null : await uploadMedia(user.id, file, 'story');
      const { error } = await supabase.from('stories').insert({ author_id: user.id, course_id: course, kind, body: text.trim() || null, media_url });
      if (error) throw error;
      onPosted();
    } catch (x) { setErr(friendlyError(x)); setBusy(false); }
  };

  return (
    <Sheet title="ستوري جديدة" onClose={onClose}>
      <div className="seg" role="radiogroup" aria-label="نوع الستوري">
        {[['text', 'نص'], ['image', 'صورة'], ['video', 'فيديو']].map(([k, l]) => (
          <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => { setKind(k); setFile(null); setErr(''); }}>{l}</button>
        ))}
      </div>
      {kind === 'text' ? (
        <>
          <label htmlFor="stxt" className="sr">نص الستوري</label>
          <textarea id="stxt" className="ctext" maxLength={280} placeholder="شو عملت اليوم بالدورة؟" value={text} onChange={(e) => setText(e.target.value)} />
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--muted)', display: 'flex', justifyContent: 'space-between' }}><span>النص بيطلع على خلفية سودا.</span><span>{text.length}/280</span></p>
        </>
      ) : (
        <>
          <label className="pbtn press" style={{ cursor: 'pointer', width: '100%', justifyContent: 'center', height: 48 }}>
            {file ? 'غيّر الملف' : kind === 'video' ? 'اختار فيديو' : 'اختار صورة'}
            <input type="file" accept={kind === 'video' ? 'video/*' : 'image/*'} className="sr" onChange={pick} />
          </label>
          {file && (kind === 'video'
            ? <video src={preview} muted playsInline controls style={{ width: '100%', maxHeight: 280, borderRadius: 18, marginTop: 10, background: '#000' }} />
            : <img src={preview} alt="" style={{ width: '100%', maxHeight: 280, objectFit: 'cover', borderRadius: 18, marginTop: 10 }} />)}
          <label className="fld" style={{ marginTop: 10 }}>تعليق (اختياري)<input value={text} onChange={(e) => setText(e.target.value)} maxLength={280} /></label>
        </>
      )}
      {courses.length > 1 && (
        <fieldset style={{ border: 0, padding: 0, margin: '14px 0 0' }}>
          <legend style={{ fontSize: 15, fontWeight: 600 }}>لأي دورة بتنحسب الستوري؟</legend>
          <div className="picks">
            {courses.map((c, i) => (
              <button key={c.course_id} type="button" className="pick press" aria-pressed={course === c.course_id} style={{ '--c': DOTS[i % 4] }} onClick={() => setCourse(c.course_id)}><i />{c.title}</button>
            ))}
          </div>
        </fieldset>
      )}
      {err && <div className="err" role="alert">{err}</div>}
      <button className="cta press" onClick={publish} disabled={busy}>{busy ? (kind === 'text' ? 'جارٍ النشر…' : 'جارٍ الرفع…') : 'انشر لمدة 24 ساعة'}</button>
    </Sheet>
  );
}

// ---------- viewer ----------
// groups: [{author, stories}] ; swipe/arrows move between stories, then people
export function Viewer({ groups: initial, start = 0, onClose, onDeleted }) {
  const { user, isAdmin } = useAuth();
  const [groups, setGroups] = useState(initial);
  const [gi, setGi] = useState(start);
  const [si, setSi] = useState(0);
  const [anim, setAnim] = useState('open');
  const [closing, setClosing] = useState(false);
  const [views, setViews] = useState(null);
  const [ask, setAsk] = useState(false);
  const [dur, setDur] = useState(5);
  const timer = useRef(null);
  const x0 = useRef(null);
  const closeBtn = useRef(null);

  const g = groups[gi];
  const s = g?.stories[si];
  const mine = s && user?.id === s.author_id;

  const close = useCallback(() => { clearTimeout(timer.current); setClosing(true); setTimeout(onClose, 200); }, [onClose]);
  const step = useCallback((d) => {
    clearTimeout(timer.current); setAsk(false);
    if (d > 0) {
      if (si + 1 < g.stories.length) { setSi(si + 1); setAnim('in-next'); }
      else if (gi + 1 < groups.length) { setGi(gi + 1); setSi(0); setAnim('in-next'); }
      else close();
    } else {
      if (si > 0) { setSi(si - 1); setAnim('in-prev'); }
      else if (gi > 0) { setGi(gi - 1); setSi(groups[gi - 1].stories.length - 1); setAnim('in-prev'); }
    }
  }, [si, gi, g, groups, close]);
  const jump = (d) => { // whole person
    clearTimeout(timer.current); setAsk(false);
    const n = gi + d;
    if (n < 0) return;
    if (n >= groups.length) return close();
    setGi(n); setSi(0); setAnim(d > 0 ? 'in-next' : 'in-prev');
  };

  // auto-advance (text/image 5s, video its own length), record the view, owner's view count
  useEffect(() => {
    if (!s) return;
    setViews(null);
    if (s.kind !== 'video') { setDur(5); if (!ask) timer.current = setTimeout(() => step(1), 5000); }
    if (user && !mine) supabase.from('story_views').upsert({ story_id: s.id, viewer_id: user.id }, { onConflict: 'story_id,viewer_id', ignoreDuplicates: true }).then(() => {});
    if (mine || isAdmin) supabase.rpc('story_view_count', { p_story: s.id }).then(({ data }) => setViews(data ?? 0));
    return () => clearTimeout(timer.current);
  }, [s?.id, ask]);

  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') close(); if (e.key === 'ArrowLeft') step(1); if (e.key === 'ArrowRight') step(-1); };
    document.addEventListener('keydown', k);
    document.body.style.overflow = 'hidden';
    closeBtn.current?.focus({ preventScroll: true });
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = ''; };
  }, [step, close]);

  const del = async () => {
    const { error } = await supabase.from('stories').delete().eq('id', s.id);
    if (error) { setAsk(false); return; }
    onDeleted?.();
    const left = g.stories.filter((x) => x.id !== s.id);
    const next = left.length ? groups.map((x, i) => (i === gi ? { ...x, stories: left } : x)) : groups.filter((_, i) => i !== gi);
    if (!next.length) return close();
    setAsk(false); setGroups(next);
    if (!left.length) { setGi(Math.min(gi, next.length - 1)); setSi(0); } else setSi(Math.min(si, left.length - 1));
    setAnim('open');
  };

  if (!s) return null;
  return createPortal(
    <div className={`overlay ${closing ? 'closing' : ''}`} role="dialog" aria-modal="true" aria-label={`ستوري ${g.author?.full_name || ''}`}
      onClick={(e) => e.target === e.currentTarget && close()}>
      <button className="navarrow r press" onClick={() => step(-1)} aria-label="السابقة"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg></button>
      <article key={`${gi}-${s.id}`} className={`story ${anim}`} style={{ perspective: 900 }}
        onPointerDown={(e) => { x0.current = e.clientX; }}
        onPointerUp={(e) => { if (x0.current == null) return; const dx = e.clientX - x0.current; x0.current = null; if (Math.abs(dx) > 50) jump(dx > 0 ? 1 : -1); }}>
        <div className="bg" style={{ background: '#000' }} />
        {s.kind === 'image' && <img src={s.media_url} alt={s.body || 'صورة ستوري'} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />}
        {s.kind === 'video' && (
          <video src={s.media_url} autoPlay playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }}
            onLoadedMetadata={(e) => setDur(Math.min(60, e.currentTarget.duration || 15))} onEnded={() => step(1)} />
        )}
        <div className="progress">
          {g.stories.map((x, k) => <span key={x.id} className={k < si ? 'done' : k === si && !ask ? 'now' : ''}><i style={k === si ? { animationDuration: `${dur}s` } : undefined} /></span>)}
        </div>
        <header className="shead">
          <Photo url={g.author?.photo_url} id={g.author?.id} />
          <button className="who" style={{ border: 0, background: 'transparent', color: 'inherit', textAlign: 'start', padding: 0 }} onClick={() => { close(); go('member/' + s.author_id); }}>
            <b>{g.author?.full_name}</b>{ago(s.created_at)}{s.course?.title ? ` · ${s.course.title}` : ''}
          </button>
          <button ref={closeBtn} className="cbtn press" onClick={close} aria-label="إغلاق"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
        </header>
        {s.kind === 'text' ? <div className="txt">{s.body}</div> : s.body ? <p className="cap">{s.body}</p> : null}
        <button className="tap r" onClick={() => step(-1)} aria-label="السابقة" />
        <button className="tap l" onClick={() => step(1)} aria-label="التالية" />
        {(mine || isAdmin) && (
          <footer className="sfoot">
            {views != null ? (
              <span className="gbtn" role="status" aria-label={`شافها ${views}`}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>{views}
              </span>
            ) : <span />}
            <button className="gbtn press" onClick={() => { clearTimeout(timer.current); setAsk(true); }}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>حذف
            </button>
          </footer>
        )}
        {ask && (
          <div className="confirm" role="alertdialog" aria-label="تأكيد الحذف">
            <span>{mine ? 'بدك تحذف هالستوري؟ ما بتقدر ترجّعها.' : `حذف ستوري ${g.author?.full_name}؟ (صلاحية الإدارة)`}</span>
            <div><button className="del" onClick={del}>احذف</button><button className="keep" onClick={() => setAsk(false)}>خلّيها</button></div>
          </div>
        )}
        {Date.now() - Date.parse(s.created_at) > DAY && <span style={{ position: 'absolute', top: 66, insetInlineStart: 14, fontSize: 12, padding: '2px 8px', borderRadius: 999, background: 'rgba(255,255,255,.2)', zIndex: 2 }}>أرشيف</span>}
      </article>
      <button className="navarrow l press" onClick={() => step(1)} aria-label="التالية"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg></button>
    </div>,
    document.body,
  );
}

// all of one member's stories (live + archived), for their profile
export function ArchiveButton({ member }) {
  const [list, setList] = useState(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    supabase.from('stories').select(SELECT).eq('author_id', member).order('created_at', { ascending: true })
      .then(({ data }) => setList(data || []));
  }, [member, open]);
  if (!list?.length) return null;
  const live = list.some((s) => Date.now() - Date.parse(s.created_at) < DAY);
  return (
    <>
      <button className="pbtn press" onClick={() => setOpen(true)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" strokeDasharray="4 2.6" /><circle cx="12" cy="12" r="4.2" /></svg>
        {live ? 'الستوريات' : 'أرشيف الستوريات'} ({list.length})
      </button>
      {open && <Viewer groups={[{ author: list[0].author, stories: list }]} start={0} onClose={() => setOpen(false)} />}
    </>
  );
}
