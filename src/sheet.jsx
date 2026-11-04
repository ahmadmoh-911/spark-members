import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Bottom sheet on phones, centred card on laptops. Closes on backdrop tap and Escape.
export function Sheet({ title, onClose, action, children }) {
  const [closing, setClosing] = useState(false);
  const box = useRef(null);
  const close = () => { setClosing(true); setTimeout(onClose, 200); };
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && close();
    document.addEventListener('keydown', k);
    document.body.style.overflow = 'hidden';
    box.current?.querySelector('input,textarea,button')?.focus({ preventScroll: true });
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = ''; };
  }, []);
  return createPortal(
    <div className={`sheet-wrap ${closing ? 'closing' : ''}`} onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} ref={box}>
        <span className="grab" aria-hidden="true" />
        <div className="sh-head">
          <button type="button" className="link" onClick={close}>إغلاق</button>
          <h2>{title}</h2>
          {action || <span style={{ width: 52 }} />}
        </div>
        {typeof children === 'function' ? children(close) : children}
      </div>
    </div>,
    document.body,
  );
}

// add/remove short items (skills, goals)
export function ListInput({ label, items, setItems, max = 12, maxLen = 60, placeholder, chips }) {
  const [v, setV] = useState('');
  const add = () => {
    const s = v.trim();
    if (!s || items.includes(s) || items.length >= max) return;
    setItems([...items, s.slice(0, maxLen)]); setV('');
  };
  return (
    <div className="fld">
      <span>{label}</span>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} maxLength={maxLen}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} style={{ flex: 1, minWidth: 0 }} />
        <button type="button" className="save press" onClick={add} disabled={items.length >= max}>أضف</button>
      </div>
      {items.length > 0 && (
        <div className={chips ? 'picks' : 'list'} style={{ marginTop: 6 }}>
          {items.map((s, i) => chips ? (
            <span key={s} className="chip" style={{ paddingInlineEnd: 4 }}>{s}
              <button type="button" aria-label={`احذف ${s}`} onClick={() => setItems(items.filter((x) => x !== s))}
                style={{ border: 0, background: 'transparent', width: 28, height: 28, borderRadius: 8, color: 'var(--muted)', fontSize: 16 }}>×</button>
            </span>
          ) : (
            <div key={i} className="irow"><span className="t">{s}</span>
              <button type="button" className="ib" aria-label="احذف" onClick={() => setItems(items.filter((_, j) => j !== i))}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" /></svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Toast({ msg, onDone }) {
  useEffect(() => { if (msg) { const t = setTimeout(onDone, 2400); return () => clearTimeout(t); } }, [msg]);
  return msg ? createPortal(<div className="toast" role="status">{msg}</div>, document.body) : null;
}
