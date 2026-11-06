import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../lib/auth.jsx';
import { friendlyError, supabase } from '../lib/supabase.js';
import { MAX_SECONDS, videoInfo } from '../lib/video.js';
import { postStory, queueStory } from '../lib/outbox.js';
import { go } from '../lib/router.js';
import { Photo, Spinner, Empty, celebrate } from '../ui.jsx';
import { Sheet, Toast } from '../sheet.jsx';

const DAY = 24 * 60 * 60 * 1000;
const SELECT = 'id,author_id,course_id,kind,body,media_url,thumb_url,created_at,author:profiles!stories_author_id_fkey(id,full_name,photo_url),course:courses(title,category)';
export const STORY_SELECT = SELECT;
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
    const today = new Date().toLocaleDateString('en-CA');
    supabase.rpc('member_courses', { p_member: user.id }, { get: true }).then(({ data }) => {
      setCourses((data || []).filter((c) => c.start_date && c.start_date <= today));
    });
  }, [user]);
  return courses;
}

// live stories (last 24h) grouped per person, my ring first, plus which ones I've seen
export function useLiveStories() {
  const { user } = useAuth();
  const [groups, setGroups] = useState(null);
  const [seen, setSeen] = useState(new Set());
  const [err, setErr] = useState('');
  const load = useCallback(async () => {
    const since = new Date(Date.now() - DAY).toISOString();
    const { data, error } = await supabase.from('stories').select(SELECT).gte('created_at', since).order('created_at', { ascending: false });
    if (error) { setErr(friendlyError(error)); return; }
    let g = group(data);
    if (user) g = [...g.filter((x) => x.author?.id === user.id), ...g.filter((x) => x.author?.id !== user.id)];
    setGroups(g);
    if (user && data.length) {
      const { data: v } = await supabase.from('story_views').select('story_id').in('story_id', data.map((x) => x.id));
      setSeen(new Set((v || []).map((x) => x.story_id)));
    }
  }, [user]);
  useEffect(() => { load(); }, [load]);
  return { groups, seen, err, load };
}

// first story ever from this device/account → a little party
export function maybeCelebrateFirstStory(uid) {
  try {
    const k = 'spark-first-story-' + uid;
    if (!localStorage.getItem(k)) { localStorage.setItem(k, '1'); celebrate(); return true; }
  } catch { /* ignore */ }
  return false;
}

// horizontal row of story rings for the home page
export function StoryStrip() {
  const { user, profile } = useAuth();
  const postable = usePostable();
  const { groups, seen, load } = useLiveStories();
  const [open, setOpen] = useState(null);
  if (!groups) return <div className="strip"><div className="sk sk-ring" /><div className="sk sk-ring" /><div className="sk sk-ring" /></div>;
  const mine = groups.find((g) => g.author?.id === user?.id);
  const others = groups.filter((g) => g.author?.id !== user?.id);
  if (!others.length && !postable.length && !mine) return null;
  return (
    <div className="strip" aria-label="ستوريات اليوم">
      {postable.length > 0 && (
        <button className="sring press" onClick={() => (mine ? setOpen({ i: 0 }) : go('stories'))}>
          <span className={`avatar ${mine ? '' : 'noring'}`}><span className="ring" /><span className="gap" /><Photo url={profile?.photo_url} id={user.id} />{!mine && <span className="add" aria-hidden="true">+</span>}</span>
          <span className="nm">{mine ? 'ستوريك' : 'أضف'}</span>
        </button>
      )}
      {others.map((g) => (
        <button key={g.author.id} className="sring press" onClick={() => setOpen({ i: groups.indexOf(g) })}>
          <span className={`avatar ${g.stories.every((x) => seen.has(x.id)) ? 'seen' : ''}`}><span className="ring" /><span className="gap" /><Photo url={g.author.photo_url} id={g.author.id} /></span>
          <span className="nm">{g.author.full_name?.split(' ')[0]}</span>
        </button>
      ))}
      {open && <Viewer groups={groups} start={open.i} onClose={() => { setOpen(null); load(); }} />}
    </div>
  );
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
  const openAt = (gi, si = 0) => setOpen({ list: groups, i: gi, si });

  return (
    <>
      <div className="head"><div><h1>الستوريات</h1><p>شو صار اليوم بدورات سبارك · آخر 24 ساعة</p></div></div>
      {err && <div className="err" role="alert">{err}</div>}
      {!groups && !err ? (
        <div className="stage">
          <div className="pick-row"><div className="sk sk-ring" /><div className="sk sk-ring" /><div className="sk sk-ring" /></div>
          <div className="sk" style={{ height: 300, borderRadius: 26, margin: '0 18%' }} />
        </div>
      ) : groups && (
        <Cylinder groups={groups} seen={seen} me={user?.id} canPost={canPost} mine={!!mine} myPhoto={profile?.photo_url}
          onOpen={openAt} onAdd={() => setComposing('text')} />
      )}
      {!user && <div className="note glass">بتقدر تتفرج بدون دخول. لتنزّل ستوري لازم تكون عضو بدورة بلّشت.</div>}
      {user && !canPost && profile?.role === 'student' && <div className="note glass">بتقدر تنزّل ستوريات لما تبلّش دورتك.</div>}

      {open && <Viewer groups={open.list} start={open.i} startStory={open.si || 0} onClose={() => { setOpen(null); load(); }} onDeleted={() => setMsg('انحذفت الستوري')} />}
      {composing && <Composer courses={postable} initialKind={composing} onClose={() => setComposing(false)} onPosted={(how) => { setComposing(false); if (how === 'queued') { setMsg('ما في نت هلأ. الستوري محفوظة وبتنتشر لحالها أول ما يرجع النت 📶'); return; } setMsg(maybeCelebrateFirstStory(user.id) ? 'أول ستوري إلك! 🎉 بتضل 24 ساعة' : 'انتشرت الستوري لمدة 24 ساعة'); load(); }} />}
      <Toast msg={msg} onDone={() => setMsg('')} />
    </>
  );
}

// ---------- wheel ----------
// Faces only, on a half-circle that turns like a watch crown: the one in the middle is sharp,
// the rest fade down the arc to both sides. Tap the middle face to watch; tap another to turn to it.
const SPACING = 96, ARC = 0.5, RADIUS = 190;
const arcY = (d) => (1 - Math.cos(Math.max(-3.1, Math.min(3.1, d)) * ARC)) * RADIUS;
function Cylinder({ groups, seen, me, canPost, mine, myPhoto, onOpen, onAdd }) {
  const ref = useRef(null);
  const [cur, setCur] = useState(0);
  const [w, setW] = useState(360);
  const items = canPost && !mine ? [{ add: true }, ...groups.map((g, gi) => ({ g, gi }))] : groups.map((g, gi) => ({ g, gi }));
  const n = items.length;
  const paint = useCallback(() => {
    const el = ref.current; if (!el) return;
    const mid = el.scrollLeft + el.clientWidth / 2;
    let best = 0, bestD = 1e9;
    [...el.children].forEach((c, i) => {
      const d = (c.offsetLeft + c.offsetWidth / 2 - mid) / SPACING;
      const a = Math.abs(d);
      c.style.transform = `translateY(${arcY(d)}px) rotate(${d * ARC * -57}deg) scale(${Math.max(0.5, 1.2 - a * 0.22)})`;
      c.style.opacity = String(Math.max(0, 1 - a * 0.34));
      if (a < bestD) { bestD = a; best = i; }
    });
    setCur((p) => { if (p !== best && navigator.vibrate) try { navigator.vibrate(4); } catch { /* not allowed */ } return best; });
  }, []);
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    let raf = 0;
    const on = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; paint(); }); };
    const size = () => { setW(el.clientWidth); on(); };
    size();
    el.addEventListener('scroll', on, { passive: true });
    window.addEventListener('resize', size);
    return () => { el.removeEventListener('scroll', on); window.removeEventListener('resize', size); cancelAnimationFrame(raf); };
  }, [paint, n]);
  // start on the first person who actually has a story
  useLayoutEffect(() => { if (items[0]?.add && n > 1) goTo(1, false); }, [n]); // eslint-disable-line react-hooks/exhaustive-deps
  const goTo = (i, smooth = true) => {
    const el = ref.current, c = el?.children[i]; if (!c) return;
    el.scrollTo({ left: c.offsetLeft + c.offsetWidth / 2 - el.clientWidth / 2, behavior: smooth ? 'smooth' : 'auto' });
  };
  if (!groups.length) {
    return (
      <div className="stage">
        {canPost && <button className="wadd press" onClick={onAdd}><span className="wface"><Photo url={myPhoto} id={me} /></span><i aria-hidden="true">+</i><b>أضف ستوري</b></button>}
        <section className="sec glass">
          <Empty art="stories" title={canPost ? 'كون أول واحد اليوم ✨' : 'هدوء اليوم 😴'} text={canPost ? 'نزّل ستوري عن شو تعلمت، وبتنحسب بتفاعلك بالدورة.' : 'ما حدا نزّل ستوري بآخر 24 ساعة. ارجع بعد شوي.'} />
        </section>
      </div>
    );
  }
  // the faint half-circle the faces ride on
  const pts = [];
  for (let x = -w / 2; x <= w / 2; x += 6) pts.push(`${(x + w / 2).toFixed(0)},${(arcY(x / SPACING) + 66).toFixed(1)}`);
  const it = items[cur] || items[0];
  const isMe = it.g?.author?.id === me;
  const last = it.g?.stories[it.g.stories.length - 1];
  return (
    <div className="stage">
      <div className="wheelbox">
        <svg className="warc" viewBox={`0 0 ${w} 300`} preserveAspectRatio="none" aria-hidden="true"><polyline points={pts.join(' ')} /></svg>
        <div className="wheel" ref={ref} role="listbox" aria-label="مين نزّل اليوم">
          {items.map((x, i) => x.add ? (
            <button key="add" className="witem" role="option" aria-selected={i === cur} onClick={() => (i === cur ? onAdd() : goTo(i))} aria-label="أضف ستوري">
              <span className="wface plain"><Photo url={myPhoto} id={me} /></span><i className="wplus" aria-hidden="true">+</i>
            </button>
          ) : (
            <button key={x.g.author?.id || i} className={`witem ${x.g.stories.every((st) => seen.has(st.id)) || x.g.author?.id === me ? 'seen' : ''}`} role="option" aria-selected={i === cur}
              onClick={() => (i === cur ? onOpen(x.gi) : goTo(i))} aria-label={x.g.author?.full_name}>
              <span className="wface"><Photo url={x.g.author?.photo_url} id={x.g.author?.id} /></span>
            </button>
          ))}
        </div>
      </div>
      <div className="wname" aria-live="polite">
        {it.add ? <><b>أضف ستوري</b><span>اكبس على صورتك</span></>
          : <><b>{isMe ? 'ستوريك' : it.g.author?.full_name}</b><span>{it.g.stories.length > 1 ? `${it.g.stories.length} ستوريات · ` : ''}{ago(last.created_at)} · اكبس على الصورة</span></>}
        {isMe && canPost && <button className="wmore press" onClick={onAdd}>+ ستوري جديدة</button>}
      </div>
    </div>
  );
}

// ---------- composer ----------
function Composer({ courses, initialKind = 'text', onClose, onPosted }) {
  const { user } = useAuth();
  const [kind, setKind] = useState(typeof initialKind === 'string' ? initialKind : 'text');
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [course, setCourse] = useState(courses.find((c) => !c.end_date || c.end_date >= new Date().toLocaleDateString('en-CA'))?.course_id ?? courses[0]?.course_id);
  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState(null); // video preparation 0..1
  const [err, setErr] = useState('');
  const preview = file ? URL.createObjectURL(file) : '';

  const pick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith(kind === 'video' ? 'video/' : 'image/')) { setErr(kind === 'video' ? 'اختار ملف فيديو.' : 'اختار صورة.'); return; }
    if (f.size > (kind === 'video' ? 300 : 50) * 1024 * 1024) { setErr(kind === 'video' ? 'الفيديو كبير كتير. صوّر مقطع أقصر.' : 'الملف أكبر من 50 ميغا.'); return; }
    setErr(''); setFile(f);
    if (kind === 'video') videoInfo(f).then((i) => i.duration > MAX_SECONDS + 1 && setErr(`الفيديو أطول من ${MAX_SECONDS} ثانية، رح ننشر أول ${MAX_SECONDS} ثانية منه بس.`)).catch(() => {});
  };
  const publish = async () => {
    if (kind === 'text' && !text.trim()) { setErr('اكتب إشي.'); return; }
    if (kind !== 'text' && !file) { setErr(kind === 'video' ? 'اختار فيديو.' : 'اختار صورة.'); return; }
    if (!course) { setErr('اختار الدورة.'); return; }
    setBusy(true); setErr('');
    const item = { user_id: user.id, course_id: course, kind, body: text.trim(), file: kind === 'text' ? null : file };
    // no internet: keep it on the phone and send it by itself later
    if (!navigator.onLine) {
      try { await queueStory(item); onPosted('queued'); } catch (x) { setErr(friendlyError(x)); setBusy(false); }
      return;
    }
    try {
      await postStory(user.id, item, setProg);
      onPosted();
    } catch (x) {
      setProg(null);
      if (/Failed to fetch|NetworkError|Load failed/i.test(x?.message || '')) {
        try { await queueStory(item); onPosted('queued'); return; } catch { /* fall through */ }
      }
      setErr(friendlyError(x)); setBusy(false);
    }
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
      {prog !== null && (
        <div className="vprog" role="progressbar" aria-valuenow={Math.round(prog * 100)} aria-valuemin={0} aria-valuemax={100}>
          <i style={{ width: `${prog * 100}%` }} /><span>بجهّز الفيديو عشان يطلع خفيف… {Math.round(prog * 100)}% · خليك على هالشاشة</span>
        </div>
      )}
      <button className="cta press" onClick={publish} disabled={busy}>{busy ? (prog !== null ? 'بجهّز الفيديو…' : kind === 'text' ? 'جارٍ النشر…' : 'جارٍ الرفع…') : 'انشر لمدة 24 ساعة'}</button>
    </Sheet>
  );
}

// ---------- viewer ----------
// groups: [{author, stories}] ; swipe/arrows move between stories, then people
export function Viewer({ groups: initial, start = 0, startStory = 0, onClose, onDeleted }) {
  const { user, isAdmin } = useAuth();
  const [groups, setGroups] = useState(initial);
  const [gi, setGi] = useState(start);
  const [si, setSi] = useState(startStory);
  const [anim, setAnim] = useState('open');
  const [closing, setClosing] = useState(false);
  const [views, setViews] = useState(null);
  const [reacts, setReacts] = useState(null);
  const [myReact, setMyReact] = useState(null);
  const [burst, setBurst] = useState(null);
  const [ask, setAsk] = useState(false);
  const [dur, setDur] = useState(5);
  const [paused, setPaused] = useState(false);
  const [ghost, setGhost] = useState(null); // the face turning away during the cube turn
  const ghostT = useRef(null);
  const [switching, setSwitching] = useState(null); // person→person: zoom out, pick, zoom in
  const swT = useRef([]);
  const stageRef = useRef(null);
  const [half, setHalf] = useState(190);
  useLayoutEffect(() => {
    const el = stageRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setHalf(el.offsetWidth / 2));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  useEffect(() => () => { swT.current.forEach(clearTimeout); clearTimeout(ghostT.current); }, []);
  const timer = useRef(null);
  const left = useRef(5000);      // ms left on the current text/image story
  const startedAt = useRef(0);
  const hold = useRef({ t: null, held: false });
  const video = useRef(null);
  const x0 = useRef(null);
  const closeBtn = useRef(null);

  const g = groups[gi];
  const s = g?.stories[si];
  const mine = s && user?.id === s.author_id;

  // cube turn. RTL: the next story is on the left, so it turns in from the left
  const turn = (d) => {
    clearTimeout(ghostT.current);
    setGhost({ g, s, dir: d > 0 ? 'fwd' : 'back', k: Date.now() });
    setAnim(d > 0 ? 'cube-in-fwd' : 'cube-in-back');
    ghostT.current = setTimeout(() => setGhost(null), 640);
  };
  // another person: zoom out of this cube, slide to the next person, zoom into theirs
  const personGo = (n, si0) => {
    if (switching) return;
    clearTimeout(ghostT.current); setGhost(null);
    setSwitching({ phase: 'out', from: gi, to: n });
    swT.current = [
      setTimeout(() => setSwitching({ phase: 'pick', from: gi, to: n }), 320),
      setTimeout(() => { setGi(n); setSi(si0); setAnim(''); setSwitching({ phase: 'in', from: gi, to: n }); }, 700),
      setTimeout(() => setSwitching(null), 1120),
    ];
  };
  const close = useCallback(() => { clearTimeout(timer.current); setClosing(true); setTimeout(onClose, 200); }, [onClose]);
  const step = useCallback((d) => {
    clearTimeout(timer.current); setAsk(false); setPaused(false);
    if (d > 0) {
      if (si + 1 < g.stories.length) { turn(1); setSi(si + 1); }
      else if (gi + 1 < groups.length) personGo(gi + 1, 0);
      else close();
    } else {
      if (si > 0) { turn(-1); setSi(si - 1); }
      else if (gi > 0) personGo(gi - 1, groups[gi - 1].stories.length - 1);
    }
  }, [si, gi, g, groups, close, switching]);
  const jump = (d) => { // whole person
    clearTimeout(timer.current); setAsk(false); setPaused(false);
    const n = gi + d;
    if (n < 0) return;
    if (n >= groups.length) return close();
    personGo(n, 0);
  };

  // auto-advance (text/image 5s, video its own length), record the view, owner's view count
  useEffect(() => {
    if (!s) return;
    setViews(null); setReacts(null); setMyReact(null);
    left.current = 5000;
    if (s.kind !== 'video') setDur(5);
    if (user && !mine) {
      supabase.from('story_views').upsert({ story_id: s.id, viewer_id: user.id }, { onConflict: 'story_id,viewer_id', ignoreDuplicates: true }).then(() => {});
      supabase.from('story_reactions').select('emoji').eq('story_id', s.id).eq('user_id', user.id).maybeSingle().then(({ data }) => setMyReact(data?.emoji || null));
    }
    if (mine || isAdmin) {
      supabase.rpc('story_view_count', { p_story: s.id }).then(({ data }) => setViews(data ?? 0));
      supabase.rpc('story_reaction_counts', { p_story: s.id }).then(({ data }) => setReacts(data || []));
    }
  }, [s?.id]);

  // react: tap an emoji (tap it again to take it back); only the author sees the totals
  const react = async (emoji) => {
    const sid = s.id;
    const next = myReact === emoji ? null : emoji;
    setMyReact(next);
    if (next) { setBurst({ emoji: next, k: Date.now() }); if (navigator.vibrate) { try { navigator.vibrate(10); } catch { /* ignore */ } } }
    const { error } = next
      ? await supabase.from('story_reactions').upsert({ story_id: sid, user_id: user.id, emoji: next }, { onConflict: 'story_id,user_id' })
      : await supabase.from('story_reactions').delete().eq('story_id', sid).eq('user_id', user.id);
    if (error) setMyReact(myReact);
  };

  // run / pause the clock (long-press, centre tap, or the delete confirm)
  const halted = paused || ask || !!switching;
  useEffect(() => {
    if (!s) return;
    if (s.kind === 'video') {
      const v = video.current;
      if (v) { if (halted) v.pause(); else v.play().catch(() => {}); }
      return;
    }
    if (halted) return;
    startedAt.current = Date.now();
    timer.current = setTimeout(() => step(1), left.current);
    return () => { clearTimeout(timer.current); left.current = Math.max(0, left.current - (Date.now() - startedAt.current)); };
  }, [s?.id, halted, step]);

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
      {switching && (
        <div className={`people glass ${switching.phase}`} aria-hidden="true">
          {groups.map((x, i) => {
            const focus = switching.phase === 'out' ? switching.from : switching.to;
            const off = i - focus;
            if (Math.abs(off) > 3) return null;
            return (
              <span key={x.author?.id || i} className={`pp ${i === focus ? 'on' : ''}`} style={{ transform: `translateX(${-off * 84}px) scale(${i === focus ? 1.12 : 0.86})` }}>
                <span className="avatar"><span className="ring" /><span className="gap" /><Photo url={x.author?.photo_url} id={x.author?.id} /></span>
                <b>{x.author?.full_name?.split(' ')[0]}</b>
              </span>
            );
          })}
        </div>
      )}
      <div ref={stageRef} className={`stage ${ghost ? 'turning' : ''} ${switching && switching.phase !== 'in' ? 'zoomed-out' : ''}`} style={{ '--o': `${-half}px` }}>
      {ghost && (
        <article key={'ghost' + ghost.k} className={`story cube-out-${ghost.dir}`} aria-hidden="true">
          <div className="bg" style={{ background: '#000' }} />
          {ghost.s.kind === 'image' && <img src={ghost.s.media_url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />}
          {ghost.s.kind === 'text' ? <div className="txt">{ghost.s.body}</div> : ghost.s.body ? <p className="cap">{ghost.s.body}</p> : null}
          <header className="shead"><Photo url={ghost.g.author?.photo_url} id={ghost.g.author?.id} /><span className="who"><b>{ghost.g.author?.full_name}</b>{ago(ghost.s.created_at)}</span></header>
          <span className="shade" />
        </article>
      )}
      <article key={`${gi}-${s.id}`} className={`story ${anim}`}
        onPointerDown={(e) => {
          x0.current = e.clientX;
          if (e.target.closest('.shead,.sbar,.confirm')) return;
          hold.current.held = false;
          hold.current.t = setTimeout(() => { hold.current.held = true; setPaused(true); }, 220);
        }}
        onPointerUp={(e) => {
          clearTimeout(hold.current.t);
          if (hold.current.held) { setPaused(false); setTimeout(() => { hold.current.held = false; }, 0); x0.current = null; return; }
          if (x0.current == null) return;
          const dx = e.clientX - x0.current; x0.current = null;
          if (Math.abs(dx) > 50) { hold.current.held = true; setTimeout(() => { hold.current.held = false; }, 0); jump(dx > 0 ? 1 : -1); }
        }}
        onPointerCancel={() => { clearTimeout(hold.current.t); if (hold.current.held) setPaused(false); }}
        onContextMenu={(e) => e.preventDefault()}>
        <div className="bg" style={{ background: '#000' }} />
        {/* the story itself gets all the space between the header and the bottom bar */}
        <div className="smid">
          {s.kind === 'image' && <img src={s.media_url} alt={s.body || 'صورة ستوري'} />}
          {s.kind === 'video' && (
            <video ref={video} src={s.media_url} poster={s.thumb_url || undefined} autoPlay playsInline
              onLoadedMetadata={(e) => setDur(Math.min(60, e.currentTarget.duration || 15))} onEnded={() => step(1)} />
          )}
          {s.kind === 'text' && <div className="txt2">{s.body}</div>}
        </div>
        {s.kind !== 'text' && s.body && <p className="cap2">{s.body}</p>}
        <div className="progress">
          {g.stories.map((x, k) => <span key={x.id} className={k < si ? 'done' : k === si ? 'now' : ''}><i style={k === si ? { animationDuration: `${dur}s`, animationPlayState: halted ? 'paused' : 'running' } : undefined} /></span>)}
        </div>
        <header className="shead">
          <Photo url={g.author?.photo_url} id={g.author?.id} />
          <button className="who" style={{ border: 0, background: 'transparent', color: 'inherit', textAlign: 'start', padding: 0 }} onClick={() => { close(); go('member/' + s.author_id); }}>
            <b>{g.author?.full_name}</b>{ago(s.created_at)}{s.course?.title ? ` · ${s.course.title}` : ''}
          </button>
          <button ref={closeBtn} className="cbtn press" onClick={close} aria-label="إغلاق"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
        </header>
        <button className="tap r" onClick={() => !hold.current.held && step(-1)} aria-label="السابقة" />
        <button className="tap mid" onClick={() => !hold.current.held && setPaused((p) => !p)} aria-label={paused ? 'تشغيل' : 'إيقاف مؤقت'} aria-pressed={paused} />
        <button className="tap l" onClick={() => !hold.current.held && step(1)} aria-label="التالية" />
        {/* one bottom bar, under the story: views/reaction totals · reactions · delete */}
        {(mine || isAdmin || user) && (
          <footer className="sbar">
            {(mine || isAdmin) && views != null ? (
              <span className="gbtn stat" role="status" aria-label={`شافها ${views}`}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>{views}
                {reacts?.length > 0 && <span className="rsum">{reacts.map((r) => <span key={r.emoji}>{r.emoji}{r.n}</span>)}</span>}
              </span>
            ) : <span />}
            {user && !mine && (
              <span className="react2" role="group" aria-label="تفاعل مع الستوري">
                {['❤️', '👏', '🔥', '🎉'].map((e) => (
                  <button key={e} className={myReact === e ? 'on' : ''} aria-pressed={myReact === e} aria-label={`تفاعل ${e}`} onClick={() => react(e)}>{e}</button>
                ))}
              </span>
            )}
            {(mine || isAdmin) ? (
              <button className="gbtn press" onClick={() => setAsk(true)} aria-label="حذف الستوري">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>{mine ? 'حذف' : ''}
              </button>
            ) : <span />}
          </footer>
        )}
        {burst && <span key={burst.k} className="burst" aria-hidden="true">{burst.emoji}</span>}
        {ask && (
          <div className="confirm" role="alertdialog" aria-label="تأكيد الحذف">
            <span>{mine ? 'بدك تحذف هالستوري؟ ما بتقدر ترجّعها.' : `حذف ستوري ${g.author?.full_name}؟ (صلاحية الإدارة)`}</span>
            <div><button className="del" onClick={del}>احذف</button><button className="keep" onClick={() => setAsk(false)}>خلّيها</button></div>
          </div>
        )}
        {Date.now() - Date.parse(s.created_at) > DAY && <span style={{ position: 'absolute', top: 66, insetInlineStart: 14, fontSize: 12, padding: '2px 8px', borderRadius: 999, background: 'rgba(255,255,255,.2)', zIndex: 2 }}>أرشيف</span>}
      </article>
      </div>
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

// Course wall: every story posted for this course, newest first, grouped by day
const dayLabel = (t) => {
  const d = new Date(t); const today = new Date(); const y = new Date(); y.setDate(today.getDate() - 1);
  const same = (a, b) => a.toDateString() === b.toDateString();
  return same(d, today) ? 'اليوم' : same(d, y) ? 'مبارح' : d.toLocaleDateString('ar', { weekday: 'long', day: 'numeric', month: 'long' });
};
export function CourseWall({ courseId }) {
  const [list, setList] = useState(null);
  const [open, setOpen] = useState(null);
  const load = useCallback(() => {
    supabase.from('stories').select(SELECT).eq('course_id', courseId).order('created_at', { ascending: false }).limit(60)
      .then(({ data }) => setList(data || []));
  }, [courseId]);
  useEffect(() => { load(); }, [load]);
  // a loose chain in a shuffled order that stays put for the day
  const chain = useMemo(() => {
    if (!list) return [];
    let a = (Number(courseId) * 7919 + Math.floor(Date.now() / DAY)) >>> 0;
    const r = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
    return out.map((st) => ({ st, tilt: Math.round((r() - 0.5) * 16), lift: Math.round((r() - 0.5) * 18), size: (0.85 + r() * 0.3).toFixed(2) }));
  }, [list, courseId]);
  if (!list) return <div className="chain">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="sk link" />)}</div>;
  if (!list.length) return <Empty art="stories" title="الحائط فاضي لسا" text="ستوريات طلاب الدورة بتتجمّع هون، كل يوم بيومه." />;
  const openAt = (st) => {
    const groups = group(list);
    const gi = groups.findIndex((g) => g.author?.id === st.author_id);
    setOpen({ groups, gi, si: groups[gi].stories.findIndex((x) => x.id === st.id) });
  };
  return (
    <div className="chain">
      {chain.map(({ st, tilt, lift, size }, i) => (
        <button key={st.id} className="link press" style={{ '--t': `${tilt}deg`, '--y': `${lift}px`, '--s': size, animationDelay: `${Math.min(i, 20) * 25}ms` }} onClick={() => openAt(st)} aria-label={`ستوري ${st.author?.full_name}`}>
          {st.kind === 'image' && <img src={st.media_url} alt="" loading="lazy" decoding="async" />}
          {st.kind === 'video' && <><video src={st.media_url} poster={st.thumb_url || undefined} muted playsInline preload="metadata" /><span className="play" aria-hidden="true">▶</span></>}
          {st.kind === 'text' && <span className="ltxt">{st.body}</span>}
          <span className="who"><Photo url={st.author?.photo_url} id={st.author_id} /></span>
        </button>
      ))}
      {open && <Viewer groups={open.groups} start={open.gi} startStory={open.si} onClose={() => { setOpen(null); load(); }} />}
    </div>
  );
}

// all of one member's stories as a grid of tiles (profile "الستوريات" tab)
export function StoryGrid({ member }) {
  const [list, setList] = useState(null);
  const [open, setOpen] = useState(null);
  const load = useCallback(() => {
    supabase.from('stories').select(SELECT).eq('author_id', member).order('created_at', { ascending: true })
      .then(({ data }) => setList(data || []));
  }, [member]);
  useEffect(() => { load(); }, [load]);
  if (!list) return <div className="sgrid">{[0, 1, 2].map((i) => <div key={i} className="sk sk-tile" />)}</div>;
  if (!list.length) return <Empty art="stories" title="لسا ما في ستوريات" text="الستوريات اللي بتنزل بتضل هون كأرشيف بعد ما يخلص يومها." />;
  const newestFirst = [...list].reverse();
  return (
    <>
      <div className="sgrid">
        {newestFirst.map((st) => (
          <button key={st.id} className="stile press" onClick={() => setOpen(list.indexOf(st))} aria-label={`ستوري ${ago(st.created_at)}`}>
            {st.kind === 'image' && <img src={st.media_url} alt="" loading="lazy" />}
            {st.kind === 'video' && <><video src={st.media_url} poster={st.thumb_url || undefined} muted playsInline preload="metadata" /><span className="play" aria-hidden="true">▶</span></>}
            {st.kind === 'text' && <span className="txt">{st.body}</span>}
            <span className="when">{Date.now() - Date.parse(st.created_at) < DAY ? 'اليوم' : ago(st.created_at)}</span>
          </button>
        ))}
      </div>
      {open != null && <Viewer groups={[{ author: list[0].author, stories: list }]} start={0} startStory={open} onClose={() => { setOpen(null); load(); }} />}
    </>
  );
}
