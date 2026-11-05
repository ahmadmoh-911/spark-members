import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../lib/auth.jsx';
import { friendlyError, supabase, uploadMedia } from '../lib/supabase.js';
import { Photo, Spinner } from '../ui.jsx';
import { Sheet, Toast } from '../sheet.jsx';
import { courseStatus, coverStyle } from './Courses.jsx';
import { Requests } from './Join.jsx';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TIER = { silver: 'فضي', gold: 'ذهبي', diamond: 'ماسي' };

// Admin: courses, enrollments, certificates, staff. Trainer: their own courses and star ratings only.
export default function Panel() {
  const { isAdmin, isTrainer, user } = useAuth();
  const [tab, setTab] = useState('courses');
  const [reqCount, setReqCount] = useState(0);
  useEffect(() => {
    if (isAdmin) supabase.rpc('admin_join_requests').then(({ data }) => setReqCount(data?.length || 0));
  }, [isAdmin, tab]);
  const [course, setCourse] = useState(null);
  const [msg, setMsg] = useState('');
  if (!isTrainer) return <p className="empty">هاي الصفحة للإدارة والمدربين بس.</p>;
  return (
    <>
      <div className="head"><div><h1>{isAdmin ? 'لوحة الإدارة' : 'لوحة المدرب'}</h1><p>{isAdmin ? 'الدورات والطلاب والمدربين والشهادات' : 'طلاب دوراتك وتقييمهم'}</p></div></div>
      {isAdmin && !course && (
        <div className="seg ptabs" role="tablist">
          <button role="tab" aria-checked={tab === 'courses'} onClick={() => setTab('courses')}>الدورات</button>
          <button role="tab" aria-checked={tab === 'requests'} onClick={() => setTab('requests')}>الطلبات{reqCount > 0 && <span className="badge">{reqCount}</span>}</button>
          <button role="tab" aria-checked={tab === 'students'} onClick={() => setTab('students')}>الطلاب</button>
          <button role="tab" aria-checked={tab === 'staff'} onClick={() => setTab('staff')}>الطاقم</button>
        </div>
      )}
      {course ? <CourseManage c={course} onBack={() => setCourse(null)} toast={setMsg} />
        : tab === 'staff' && isAdmin ? <Staff me={user.email} toast={setMsg} />
        : tab === 'requests' && isAdmin ? <Requests toast={setMsg} onCount={setReqCount} />
        : tab === 'students' && isAdmin ? <AllStudents toast={setMsg} />
          : <CourseList onOpen={setCourse} toast={setMsg} />}
      <Toast msg={msg} onDone={() => setMsg('')} />
    </>
  );
}

function CourseList({ onOpen, toast }) {
  const { isAdmin, user } = useAuth();
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [adding, setAdding] = useState(false);
  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('panel_courses');
    if (error) setErr(friendlyError(error)); else setRows(data);
  }, [isAdmin, user]);
  useEffect(() => { load(); }, [load]);
  return (
    <>
      {isAdmin && <button className="pbtn primary press" style={{ marginBottom: 12 }} onClick={() => setAdding(true)}>+ دورة جديدة</button>}
      {err && <div className="err" role="alert">{err}</div>}
      {!rows && !err ? <Spinner /> : (
        <div className="courses">
          {rows?.map((c) => (
            <button key={c.id} className="ccard press" style={{ ...coverStyle(c), border: 0, textAlign: 'start' }} onClick={() => onOpen(c)}>
              <span className="scrim" /><span className="cstatus">{courseStatus(c)}</span>
              <span className="info"><h3>{c.title}</h3><span className="tr">{c.start_date} → {c.end_date}</span></span>
            </button>
          ))}
          {rows && !rows.length && <p className="empty">{isAdmin ? 'ما في دورات. اضغط «دورة جديدة».' : 'ما في دورات مسجّلة باسمك لسا.'}</p>}
        </div>
      )}
      {adding && <CourseForm onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load(); toast('انضافت الدورة'); }} />}
    </>
  );
}

function CourseForm({ c, onClose, onSaved }) {
  const { user } = useAuth();
  const [f, setF] = useState({
    title: c?.title || '', category: c?.category || '', description: c?.description || '',
    trainer_email: c?.trainer_email || '', start_date: c?.start_date || '', end_date: c?.end_date || '',
  });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async (e) => {
    e.preventDefault();
    const te = f.trainer_email.trim().toLowerCase();
    if (!f.title.trim() || !f.start_date || !f.end_date) { setErr('العنوان وتاريخ البداية والنهاية مطلوبين.'); return; }
    if (f.end_date < f.start_date) { setErr('تاريخ النهاية لازم يكون بعد البداية.'); return; }
    if (te && !EMAIL.test(te)) { setErr('إيميل المدرب مش صحيح.'); return; }
    setBusy(true); setErr('');
    try {
      let cover_url = c?.cover_url || null;
      if (file) cover_url = await uploadMedia(user.id, file, 'course');
      const row = { title: f.title.trim(), category: f.category.trim() || null, description: f.description.trim() || null,
        trainer_email: te || null, start_date: f.start_date, end_date: f.end_date, cover_url };
      const { error } = c ? await supabase.from('courses').update(row).eq('id', c.id) : await supabase.from('courses').insert(row);
      if (error) throw error;
      // make sure the trainer gets the trainer role on sign-in (never downgrade an admin)
      if (te && te !== user.email.toLowerCase()) {
        const { data: s } = await supabase.from('staff_emails').select('role').eq('email', te).maybeSingle();
        if (!s) { const r = await supabase.from('staff_emails').insert({ email: te, role: 'trainer' }); if (r.error) throw r.error; }
      }
      onSaved(row);
    } catch (x) { setErr(friendlyError(x)); setBusy(false); }
  };
  return (
    <Sheet title={c ? 'تعديل الدورة' : 'دورة جديدة'} onClose={onClose}>
      <form onSubmit={save}>
        <label className="fld">اسم الدورة<input value={f.title} onChange={set('title')} maxLength={80} required /></label>
        <label className="fld">التصنيف<input value={f.category} onChange={set('category')} placeholder="مثلاً: برمجة، تصميم، ريادة" maxLength={40} /></label>
        <label className="fld">وصف<textarea rows={3} value={f.description} onChange={set('description')} maxLength={600} /></label>
        <label className="fld">Gmail المدرب<input type="email" dir="ltr" value={f.trainer_email} onChange={set('trainer_email')} placeholder="trainer@gmail.com" />
          <span className="hint">بياخد صلاحية مدرب تلقائياً لما يدخل بهالإيميل.</span></label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label className="fld">البداية<input type="date" value={f.start_date} onChange={set('start_date')} required /></label>
          <label className="fld">النهاية<input type="date" value={f.end_date} onChange={set('end_date')} required /></label>
        </div>
        <div className="pick-photo">
          {(file || c?.cover_url) && <span className="ph" style={{ width: 120, height: 68, borderRadius: 12, background: `center/cover url("${file ? URL.createObjectURL(file) : c.cover_url}")` }} />}
          <label className="pbtn press" style={{ cursor: 'pointer' }}>{file || c?.cover_url ? 'غيّر صورة الغلاف' : 'صورة الغلاف'}
            <input type="file" accept="image/*" className="sr" onChange={(e) => e.target.files?.[0]?.type.startsWith('image/') && setFile(e.target.files[0])} />
          </label>
        </div>
        {err && <div className="err" role="alert">{err}</div>}
        <button className="cta press" disabled={busy}>{busy ? 'جارٍ الحفظ…' : 'احفظ'}</button>
      </form>
    </Sheet>
  );
}

function Stars({ value, onPick, disabled }) {
  return (
    <span style={{ display: 'inline-flex', direction: 'ltr' }} role="radiogroup" aria-label="تقييم المدرب">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} role="radio" aria-checked={value === n} aria-label={`${n} من 5`} disabled={disabled}
          onClick={() => onPick(n)}
          style={{ border: 0, background: 'transparent', width: 34, height: 40, fontSize: 22, color: n <= (value || 0) ? '#E9A814' : 'var(--line)', cursor: disabled ? 'default' : 'pointer' }}>★</button>
      ))}
    </span>
  );
}

function CourseManage({ c: initial, onBack, toast }) {
  const { isAdmin, user } = useAuth();
  const [c, setC] = useState(initial);
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [emails, setEmails] = useState('');
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [welcome, setWelcome] = useState(null);
  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('course_enrollments', { p_course: c.id });
    if (error) setErr(friendlyError(error)); else setRows(data);
  }, [c.id]);
  useEffect(() => { load(); }, [load]);

  const run = async (p, ok) => { const { error } = await p; if (error) toast(friendlyError(error)); else { ok && toast(ok); load(); } };

  const addStudents = async () => {
    const list = [...new Set(emails.split(/[\s,;،]+/).map((x) => x.trim().toLowerCase()).filter(Boolean))];
    const bad = list.filter((x) => !EMAIL.test(x));
    if (!list.length) return;
    if (bad.length) { toast(`إيميل غلط: ${bad[0]}`); return; }
    const have = new Set((rows || []).map((r) => r.email));
    const fresh = list.filter((x) => !have.has(x));
    if (!fresh.length) { toast('كلهم مضافين أصلاً'); return; }
    const { error } = await supabase.from('enrollments').insert(fresh.map((email) => ({ course_id: c.id, email })));
    if (error) { toast(friendlyError(error)); return; }
    setEmails(''); load(); setWelcome(fresh);
  };
  const [cert, setCert] = useState(null);
  const ended = courseStatus(c) === 'انتهت';

  return (
    <>
      <button className="back glass press" onClick={onBack}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>كل الدورات</button>
      <div className="chero" style={{ ...coverStyle(c), maxHeight: 220 }}>
        <span className="scrim" /><span className="cstatus">{courseStatus(c)}</span>
        <div className="info"><h1>{c.title}</h1><span className="tr">{c.start_date} → {c.end_date}{c.trainer_email ? ` · ${c.trainer_email}` : ''}</span></div>
      </div>
      {isAdmin && (
        <div className="pacts">
          <button className="pbtn press" onClick={() => setEditing(true)}>تعديل الدورة</button>
          <button className="pbtn press" style={{ color: '#D64535' }} onClick={() => setConfirm({ text: `حذف دورة «${c.title}» مع كل تسجيلاتها؟`, go: async () => { const { error } = await supabase.from('courses').delete().eq('id', c.id); if (error) toast(friendlyError(error)); else { toast('انحذفت الدورة'); onBack(); } } })}>حذف الدورة</button>
        </div>
      )}

      {isAdmin && (
        <section className="sec glass" style={{ marginTop: 12 }}>
          <h2>إضافة طلاب</h2>
          <label className="fld">إيميلات Gmail (كل واحد بسطر أو بينهم فاصلة)
            <textarea dir="ltr" rows={3} value={emails} onChange={(e) => setEmails(e.target.value)} placeholder={'student1@gmail.com\nstudent2@gmail.com'} />
            <span className="hint">إذا الطالب لسا ما سجّل، بيظهر بالدورة كمقعد محجوز وبينربط أول ما يدخل.</span>
          </label>
          <button className="save press" onClick={addStudents}>أضف للدورة</button>
        </section>
      )}

      <section className="sec glass" style={{ marginTop: 12 }}>
        <h2>الطلاب {rows ? `(${rows.length})` : ''}</h2>
        {err && <div className="err" role="alert">{err}</div>}
        {!rows && !err ? <Spinner /> : (
          <div className="list">
            {rows?.map((r) => (
              <div key={r.id} className="erow">
                <div className="top-line">
                  <Photo url={r.photo_url} id={r.student_id || r.email} />
                  <span style={{ minWidth: 0 }}>
                    <b style={{ display: 'block' }}>{r.full_name || 'لسا ما سجّل'}</b>
                    {r.email && <span dir="ltr" style={{ display: 'block', fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.email}</span>}
                    {r.whatsapp && <span dir="ltr" style={{ display: 'block', fontSize: 12, color: 'var(--muted)' }}>واتساب {r.whatsapp}</span>}
                    {isAdmin && r.certificate_code && <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)' }}><span dir="ltr">{r.certificate_code}</span> · {r.tier ? TIER[r.tier] : 'بدون تصنيف'}</span>}
                  </span>
                </div>
                <div className="acts">
                  <Stars value={r.trainer_stars} disabled={!r.student_id || (c.trainer_email || '').toLowerCase() !== (user?.email || '').toLowerCase()}
                    onPick={(n) => run(supabase.rpc('rate_enrollment', { p_enrollment: r.id, p_stars: n }), 'انحفظ التقييم')} />
                  {isAdmin && (
                    <span style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                      {r.student_id && (
                        <button className="link" style={{ color: 'var(--blue)' }} onClick={() => setCert(r)}>{r.certificate_code ? 'الشهادة' : 'إصدار شهادة'}</button>
                      )}
                      <button className="link" style={{ color: '#D64535' }} onClick={() => setConfirm({ text: `إزالة ${r.full_name || r.email} من الدورة؟`, go: () => run(supabase.from('enrollments').delete().eq('id', r.id), 'انشال من الدورة') })}>إزالة</button>
                    </span>
                  )}
                </div>
              </div>
            ))}
            {rows && !rows.length && <p className="empty" style={{ padding: 12 }}>ما في طلاب لسا.</p>}
          </div>
        )}
        <p className="hint" style={{ fontSize: 13, color: 'var(--muted)', marginTop: 10 }}>{isAdmin && (c.trainer_email || '').toLowerCase() !== (user?.email || '').toLowerCase()
          ? 'النجوم بيعطيها مدرب الدورة بس. إنت بتشوفها هون بدون تعديل.'
          : 'تقييمك بيدخل بحساب تصنيف الشهادة، وما بيبيّن للناس كرقم.'}</p>
      </section>

      {welcome && <Welcome c={c} emails={welcome} onClose={() => setWelcome(null)} />}
      {cert && <CertSheet c={c} r={cert} ended={ended} onClose={() => setCert(null)} onDone={(m) => { setCert(null); toast(m); load(); }} />}
      {editing && <CourseForm c={c} onClose={() => setEditing(false)} onSaved={(row) => { setEditing(false); setC({ ...c, ...row }); toast('انحفظت'); }} />}
      {confirm && <Confirm text={confirm.text} onNo={() => setConfirm(null)} onYes={async () => { const g = confirm.go; setConfirm(null); await g(); }} />}
    </>
  );
}

// issue a certificate, attach / replace / remove its file (image or PDF), or revoke it
function CertSheet({ c, r, ended, onClose, onDone }) {
  const { user } = useAuth();
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [revoke, setRevoke] = useState(false);
  const issued = !!r.certificate_code;
  const pick = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    if (!/^image\/(jpeg|png|webp|gif)$|^application\/pdf$/.test(f.type)) { setErr('الملف لازم يكون صورة (JPG, PNG, WEBP) أو PDF.'); return; }
    if (f.size > 50 * 1024 * 1024) { setErr('الملف أكبر من 50 ميغا.'); return; }
    setErr(''); setFile(f);
  };
  const save = async (patch, msg) => {
    setBusy(true); setErr('');
    try {
      if (file) patch.certificate_url = await uploadMedia(user.id, file, 'cert');
      const { error } = await supabase.from('enrollments').update(patch).eq('id', r.id);
      if (error) throw error;
      onDone(msg);
    } catch (x) { setErr(friendlyError(x)); setBusy(false); }
  };
  const code = `SPK-C-${new Date().getFullYear()}-${String(c.id).padStart(2, '0')}${String(r.id).padStart(4, '0')}`;
  return (
    <Sheet title={issued ? 'شهادة الطالب' : 'إصدار شهادة'} onClose={onClose}>
      <p style={{ margin: '0 0 8px' }}><b>{r.full_name}</b> · {c.title}</p>
      {issued && <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--muted)' }}>رقم الشهادة <span dir="ltr">{r.certificate_code}</span> · التصنيف الحالي: {r.tier ? TIER[r.tier] : 'بدون تصنيف'}</p>}
      {!ended && !issued && <div className="hidden-note" style={{ marginTop: 0 }}>الدورة لسا ما انتهت.</div>}
      {r.trainer_stars == null && <div className="hidden-note">المدرب لسا ما قيّم هالطالب بالنجوم، فتقييمه بينحسب صفر لحد ما يقيّمه.</div>}
      <div className="pick-photo" style={{ marginTop: 12 }}>
        <label className="pbtn press" style={{ cursor: 'pointer' }}>
          {file ? 'غيّر الملف' : r.certificate_url ? 'استبدل ملف الشهادة' : 'أرفق صورة أو PDF الشهادة'}
          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf" className="sr" onChange={pick} />
        </label>
        {file && <span style={{ fontSize: 13, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }} dir="ltr">{file.name}</span>}
        {!file && r.certificate_url && <a className="link" href={r.certificate_url} target="_blank" rel="noopener" style={{ display: 'inline-grid', placeItems: 'center', color: 'var(--blue)' }}>اعرض الملف</a>}
      </div>
      <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>اختياري. إذا ما أرفقت ملف، بيظهر شعار سبارك مكانه.</p>
      {err && <div className="err" role="alert">{err}</div>}
      {!issued
        ? <button className="cta press" disabled={busy} onClick={() => save({ certificate_code: code }, 'انصدرت الشهادة')}>{busy ? 'جارٍ…' : 'أصدر الشهادة'}</button>
        : (
          <>
            <button className="cta press" disabled={busy || !file} onClick={() => save({}, 'انحفظ ملف الشهادة')}>{busy ? 'جارٍ الرفع…' : 'احفظ الملف'}</button>
            {r.certificate_url && !file && <button className="ghost press" disabled={busy} onClick={() => save({ certificate_url: null }, 'انشال ملف الشهادة')}>شيل الملف</button>}
            {!revoke
              ? <button className="ghost press" style={{ color: '#D64535' }} onClick={() => setRevoke(true)}>إلغاء الشهادة</button>
              : <button className="cta press" style={{ background: '#D64535' }} disabled={busy} onClick={() => save({ certificate_code: null, certificate_url: null }, 'انلغت الشهادة')}>أكّد إلغاء الشهادة</button>}
          </>
        )}
    </Sheet>
  );
}

// acceptance message, sent from the admin's own mail app / WhatsApp
const SITE = () => location.origin + import.meta.env.BASE_URL;
const welcomeText = (c, name) => `مرحبا${name ? ' ' + name : ''}،

يسعدنا نبلغك إنه انقبلت بدورة «${c.title}» في سبارك للابتكار والإبداع${c.start_date ? `، وبتبلّش ${c.start_date}` : ''}.

فعّل عضويتك من هون بنفس حساب Gmail اللي سجّلت فيه:
${SITE()}

أهلاً فيك بمجتمع سبارك 🌟`;
// Gmail compose in the browser (works on phone and laptop, no mail app needed). Students go in BCC.
const gmailLink = (c, emails) =>
  `https://mail.google.com/mail/?view=cm&fs=1&bcc=${encodeURIComponent(emails.join(','))}&su=${encodeURIComponent(`قبولك بدورة ${c.title} | سبارك`)}&body=${encodeURIComponent(welcomeText(c))}`;

// shown once, right after adding students. Optional: skipping closes it for good.
function Welcome({ c, emails, onClose }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(welcomeText(c)); setCopied(true); } catch { setCopied(false); }
  };
  return (
    <Sheet title="رسالة قبول (اختياري)" onClose={onClose}>
      <p style={{ margin: '0 0 10px' }}>انضاف {emails.length} للدورة. بدك تبعتلهم رسالة قبول؟</p>
      <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 14, background: 'var(--chip)', borderRadius: 14, padding: 12, margin: 0, maxHeight: 180, overflow: 'auto' }}>{welcomeText(c)}</pre>
      <a className="cta press" style={{ display: 'grid', placeItems: 'center', textDecoration: 'none' }} href={gmailLink(c, emails)} target="_blank" rel="noopener" onClick={() => setTimeout(onClose, 400)}>ابعتها بالإيميل (Gmail)</a>
      <button className="ghost press" onClick={copy}>{copied ? 'انتسخت ✓ — الصقها بواتساب' : 'انسخ الرسالة لواتساب'}</button>
      <button className="ghost press" onClick={onClose}>تخطّي</button>
      <p style={{ fontSize: 12, color: 'var(--muted)', margin: '8px 0 0' }}>الإيميلات بتنحط كنسخة مخفية (BCC)، فما حدا بيشوف إيميل التاني.</p>
    </Sheet>
  );
}

// every student in any course (past or current): compact rows, name first, email under it
function AllStudents({ toast }) {
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState('');
  useEffect(() => {
    supabase.rpc('admin_students').then(({ data, error }) => { if (error) toast(friendlyError(error)); else setRows(data); });
  }, []);
  if (!rows) return <Spinner />;
  const s = q.trim().toLowerCase();
  const list = rows.filter((r) => !s || (r.full_name || '').toLowerCase().includes(s) || (r.email || '').includes(s));
  return (
    <section className="sec glass">
      <h2>كل الطلاب ({rows.length})</h2>
      <label className="search" style={{ background: 'var(--glass-strong)', border: '1px solid var(--line)' }}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
        <span className="sr">بحث</span>
        <input type="search" placeholder="دوّر باسم أو إيميل" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      <div className="slist">
        {list.map((r, i) => (
          <div key={r.student_id || r.email} className="srow" style={{ animationDelay: `${Math.min(i, 20) * 20}ms` }}>
            <Photo url={r.photo_url} id={r.student_id || r.email} />
            <span className="t">
              <b>{r.full_name || 'لسا ما سجّل'}</b>
              <span dir="ltr">{r.email}</span>
            </span>
            {r.course_count > 1 && <span className="chip" title="عدد الدورات">{r.course_count} دورات</span>}
          </div>
        ))}
        {!list.length && <p className="empty" style={{ padding: 12 }}>{rows.length ? 'ما في نتائج.' : 'لسا ما في طلاب.'}</p>}
      </div>
    </section>
  );
}

function Confirm({ text, onYes, onNo }) {
  return (
    <Sheet title="تأكيد" onClose={onNo}>
      <p style={{ margin: '4px 0 12px', fontSize: 16 }}>{text}</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="cta press" style={{ background: '#D64535', marginTop: 0 }} onClick={onYes}>نعم</button>
        <button className="ghost press" style={{ marginTop: 0, height: 54 }} onClick={onNo}>تراجع</button>
      </div>
    </Sheet>
  );
}

function Staff({ me, toast }) {
  const [rows, setRows] = useState(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('trainer');
  const [confirm, setConfirm] = useState(null);
  const load = async () => {
    const { data, error } = await supabase.from('staff_emails').select('*').order('role').order('email');
    if (error) toast(friendlyError(error)); else setRows(data);
  };
  useEffect(() => { load(); }, []);
  const add = async (e) => {
    e.preventDefault();
    const em = email.trim().toLowerCase();
    if (!EMAIL.test(em)) { toast('الإيميل مش صحيح'); return; }
    const { error } = await supabase.from('staff_emails').upsert({ email: em, role });
    if (error) toast(friendlyError(error)); else { setEmail(''); toast('انضاف'); load(); }
  };
  return (
    <>
      <section className="sec glass">
        <h2>إضافة مدرب أو مدير</h2>
        <form onSubmit={add}>
          <label className="fld">Gmail<input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@gmail.com" required /></label>
          <div className="seg" role="radiogroup" aria-label="الصلاحية" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <button type="button" role="radio" aria-checked={role === 'trainer'} onClick={() => setRole('trainer')}>مدرب</button>
            <button type="button" role="radio" aria-checked={role === 'admin'} onClick={() => setRole('admin')}>إدارة</button>
          </div>
          <button className="save press">أضف</button>
        </form>
        <p className="hint" style={{ fontSize: 13, color: 'var(--muted)', marginTop: 10 }}>الصلاحية بتنطبق تلقائياً لما يدخل بهالإيميل، أو فوراً إذا كان داخل من قبل.</p>
      </section>
      <section className="sec glass" style={{ marginTop: 12 }}>
        <h2>الطاقم</h2>
        {!rows ? <Spinner /> : (
          <div className="list">
            {rows.map((r) => (
              <div key={r.email} className="irow">
                <span className="t" dir="ltr" style={{ textAlign: 'right' }}>{r.email}</span>
                <span className="role-pill" style={r.role === 'trainer' ? { background: 'var(--green)' } : undefined}>{r.role === 'admin' ? 'إدارة' : 'مدرب'}</span>
                {r.email !== me.toLowerCase() && (
                  <button className="ib" aria-label={`إزالة ${r.email}`} onClick={() => setConfirm(r)}>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" /></svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
      {confirm && <Confirm text={`إزالة صلاحية ${confirm.email}؟ بيرجع طالب عادي.`} onNo={() => setConfirm(null)}
        onYes={async () => { const r = confirm; setConfirm(null); const { error } = await supabase.from('staff_emails').delete().eq('email', r.email); if (error) toast(friendlyError(error)); else { toast('انشالت الصلاحية'); load(); } }} />}
    </>
  );
}
