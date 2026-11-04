import { useState } from 'react';
import { friendlyError, supabase, uploadMedia } from '../lib/supabase.js';
import { Photo } from '../ui.jsx';
import { Sheet } from '../sheet.jsx';

const KIND = { project: 'مشروع', certificate: 'شهادة خارجية' };

// projects and external certificates: grid, open to read, owner can add/delete
export default function Works({ works, own, ownerId, onChange, toast }) {
  const [open, setOpen] = useState(null);
  const [adding, setAdding] = useState(false);
  if (!own && !works.length) return null;
  return (
    <section className="sec glass">
      <div className="sh-head" style={{ marginBottom: 10 }}>
        <h2 style={{ margin: 0 }}>مشاريع وشهادات خارجية</h2>
        {own && <button className="pbtn press" onClick={() => setAdding(true)}>+ أضف</button>}
      </div>
      <div className="works">
        {works.map((w) => (
          <button key={w.id} className="work press" onClick={() => setOpen(w)}>
            <Photo url={w.image_url} id={'w' + w.id} />
            <b>{w.title}</b>
            <span className="k">{KIND[w.kind]}</span>
          </button>
        ))}
      </div>
      {!works.length && <p className="empty" style={{ padding: 12 }}>أضف مشاريعك وشهاداتك من برّا سبارك.</p>}
      {open && <WorkView w={open} own={own} onClose={() => setOpen(null)} onDeleted={() => { setOpen(null); onChange(); toast('انحذف'); }} />}
      {adding && <WorkAdd ownerId={ownerId} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); onChange(); toast('انضاف'); }} />}
    </section>
  );
}

function WorkView({ w, own, onClose, onDeleted }) {
  const [ask, setAsk] = useState(false);
  const [err, setErr] = useState('');
  const del = async () => {
    const { error } = await supabase.from('works').delete().eq('id', w.id);
    if (error) setErr(friendlyError(error)); else onDeleted();
  };
  return (
    <Sheet title={KIND[w.kind]} onClose={onClose}>
      {w.image_url && <Photo url={w.image_url} id={'w' + w.id} style={{ width: '100%', aspectRatio: '16/10', borderRadius: 18 }} />}
      <h3 style={{ fontSize: 18, fontWeight: 700, margin: '12px 0 6px' }}>{w.title}</h3>
      {w.description && <p style={{ margin: 0, lineHeight: 1.7, color: 'var(--ink-2)', whiteSpace: 'pre-line' }}>{w.description}</p>}
      {own && !ask && <button className="ghost press" style={{ color: '#D64535' }} onClick={() => setAsk(true)}>احذف</button>}
      {ask && (
        <div className="lock" style={{ display: 'grid' }} role="alertdialog" aria-label="تأكيد الحذف">
          <span>متأكد بدك تحذف «{w.title}»؟</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="cta press" style={{ background: '#D64535', marginTop: 0, height: 46 }} onClick={del}>احذف</button>
            <button className="ghost press" style={{ marginTop: 0, height: 46 }} onClick={() => setAsk(false)}>تراجع</button>
          </div>
        </div>
      )}
      {err && <div className="err" role="alert">{err}</div>}
    </Sheet>
  );
}

function WorkAdd({ ownerId, onClose, onSaved }) {
  const [kind, setKind] = useState('project');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const save = async (e) => {
    e.preventDefault();
    if (!title.trim()) { setErr('اكتب العنوان.'); return; }
    setBusy(true); setErr('');
    try {
      const image_url = file ? await uploadMedia(ownerId, file, 'work') : null;
      const { error } = await supabase.from('works').insert({ owner_id: ownerId, kind, title: title.trim(), description: desc.trim() || null, image_url });
      if (error) throw error;
      onSaved();
    } catch (x) { setErr(friendlyError(x)); setBusy(false); }
  };
  return (
    <Sheet title="إضافة" onClose={onClose}>
      <form onSubmit={save}>
        <div className="seg" role="radiogroup" aria-label="النوع" style={{ gridTemplateColumns: '1fr 1fr' }}>
          {Object.entries(KIND).map(([k, l]) => (
            <button type="button" key={k} role="radio" aria-checked={kind === k} onClick={() => setKind(k)}>{l}</button>
          ))}
        </div>
        <label className="fld">العنوان<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} required /></label>
        <label className="fld">وصف قصير (سطرين أو تلاتة)<textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={400} /></label>
        <div className="pick-photo">
          {file && <Photo url={URL.createObjectURL(file)} id="new" style={{ borderRadius: 14 }} />}
          <label className="pbtn press" style={{ cursor: 'pointer' }}>
            {file ? 'غيّر الصورة' : 'أضف صورة (اختياري)'}
            <input type="file" accept="image/*" className="sr" onChange={(e) => e.target.files?.[0]?.type.startsWith('image/') && setFile(e.target.files[0])} />
          </label>
        </div>
        {err && <div className="err" role="alert">{err}</div>}
        <button className="cta press" disabled={busy}>{busy ? 'جارٍ الحفظ…' : 'احفظ'}</button>
      </form>
    </Sheet>
  );
}
