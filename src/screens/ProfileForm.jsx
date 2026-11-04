import { useState } from 'react';
import { useAuth } from '../lib/auth.jsx';
import { friendlyError, membershipNo, supabase, uploadAvatar } from '../lib/supabase.js';
import { Photo } from '../ui.jsx';
import { ListInput } from '../sheet.jsx';

// "فعّل عضويتك" on first sign-in; the same form edits the basics later.
export default function ProfileForm({ mode = 'onboard', onDone }) {
  const { user, profile, refresh, signOut } = useAuth();
  const google = user?.user_metadata ?? {};
  const [f, setF] = useState({
    full_name: profile?.full_name || google.full_name || google.name || '',
    specialty: profile?.specialty || '',
    tagline: profile?.tagline || '',
    about: profile?.about || '',
  });
  const [photo, setPhoto] = useState(profile?.photo_url || google.avatar_url || '');
  const [file, setFile] = useState(null);
  const [skills, setSkills] = useState(profile?.skills || []);
  const [goals, setGoals] = useState(profile?.goals || []);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const pick = (e) => {
    const fl = e.target.files?.[0];
    if (!fl) return;
    if (!fl.type.startsWith('image/')) { setErr('اختار صورة (JPG أو PNG).'); return; }
    setFile(fl); setPhoto(URL.createObjectURL(fl)); setErr('');
  };

  const save = async (e) => {
    e.preventDefault();
    if (!f.full_name.trim()) { setErr('اكتب اسمك.'); return; }
    setBusy(true); setErr('');
    try {
      let photo_url = photo || null;
      if (file) photo_url = await uploadAvatar(user.id, file);
      const { error } = await supabase.from('profiles').update({
        full_name: f.full_name.trim(), specialty: f.specialty.trim() || null,
        tagline: f.tagline.trim() || null, about: f.about.trim() || null,
        photo_url, skills, goals, onboarded: true,
      }).eq('id', user.id);
      if (error) throw error;
      await refresh();
      onDone?.();
    } catch (x) { setErr(friendlyError(x)); setBusy(false); }
  };

  return (
    <form className={mode === 'onboard' ? 'onb glass' : ''} onSubmit={save} aria-labelledby="onb-h">
      {mode === 'onboard' && <h1 id="onb-h" style={{ fontSize: 22, fontWeight: 700 }}>فعّل عضويتك</h1>}
      {profile?.member_no && <span className="member">رقم العضوية <b dir="ltr">{membershipNo(profile.member_no)}</b></span>}
      <div className="pick-photo">
        <Photo url={photo} id={user?.id} />
        <label className="pbtn press" style={{ cursor: 'pointer' }}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
          {photo ? 'غيّر الصورة' : 'أضف صورة'}
          <input type="file" accept="image/*" className="sr" onChange={pick} />
        </label>
        {photo && <button type="button" className="link" onClick={() => { setPhoto(''); setFile(null); }}>احذف</button>}
      </div>
      <label className="fld">الاسم الكامل<input value={f.full_name} onChange={set('full_name')} autoComplete="name" maxLength={60} required /></label>
      <label className="fld">التخصص<input value={f.specialty} onChange={set('specialty')} placeholder="مثلاً: تصميم واجهات" maxLength={60} /></label>
      <label className="fld">جملة عنك<input value={f.tagline} onChange={set('tagline')} placeholder="بتظهر تحت اسمك بكرت الطالب" maxLength={90} /></label>
      <label className="fld">نبذة<textarea rows={3} value={f.about} onChange={set('about')} maxLength={500} /></label>
      <ListInput label="المهارات" items={skills} setItems={setSkills} chips max={15} maxLen={40} placeholder="مثلاً: Figma" />
      <ListInput label="أهدافي مع مجتمع سبارك" items={goals} setItems={setGoals} max={6} maxLen={140} placeholder="اكتب هدف واضغط أضف" />
      {err && <div className="err" role="alert">{err}</div>}
      <button className="cta press" disabled={busy}>{busy ? 'جارٍ الحفظ…' : mode === 'onboard' ? 'فعّل العضوية' : 'احفظ'}</button>
      {mode === 'onboard'
        ? <button type="button" className="ghost press" onClick={signOut}>تسجيل الخروج</button>
        : null}
    </form>
  );
}
