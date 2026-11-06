import { useEffect, useState } from 'react';
import { friendlyError, supabase } from '../lib/supabase.js';
import { go } from '../lib/router.js';
import { Photo, Spinner, CountUp } from '../ui.jsx';

const dayName = (d) => String(new Date(d + 'T00:00').getDate());
const since = (t) => {
  if (!t) return 'ولا ستوري لسا';
  const days = Math.floor((Date.now() - new Date(t)) / 864e5);
  return days < 1 ? 'اليوم' : days === 1 ? 'من يوم' : days === 2 ? 'من يومين' : days <= 10 ? `من ${days} أيام` : `من ${days} يوم`;
};

// Activity at a glance: who's posting, which course is alive, who went quiet
export function Insights() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    supabase.rpc('panel_insights').then(({ data, error }) => (error ? setErr(friendlyError(error)) : setD(data)));
  }, []);
  if (err) return <div className="err" role="alert">{err}</div>;
  if (!d) return <Spinner />;
  const max = Math.max(1, ...d.daily.map((x) => x.n));
  const trend = d.stories_prev_7d ? Math.round(((d.stories_7d - d.stories_prev_7d) / d.stories_prev_7d) * 100) : null;
  const rate = d.students_live ? Math.round((d.active_7d / d.students_live) * 100) : 0;
  return (
    <div className="ins">
      <div className="kpis">
        <div className="kpi" style={{ '--c': 'var(--green)' }}><b><CountUp to={rate} />%</b><span>من طلاب الدورات الجارية نزّلوا ستوري هالأسبوع ({d.active_7d} من {d.students_live})</span></div>
        <div className="kpi" style={{ '--c': 'var(--orange)' }}><b><CountUp to={d.stories_7d} /></b><span>ستوري آخر 7 أيام{trend !== null && <em className={trend >= 0 ? 'up' : 'down'}> {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}%</em>}</span></div>
        <div className="kpi" style={{ '--c': 'var(--blue)' }}><b><CountUp to={d.views_7d} /></b><span>مشاهدة للستوريات</span></div>
        <div className="kpi" style={{ '--c': 'var(--yellow)' }}><b><CountUp to={d.reactions_7d} /></b><span>تفاعل (إيموجي)</span></div>
      </div>

      <section className="sec glass">
        <h2>الستوريات آخر أسبوعين</h2>
        <div className="bars" role="img" aria-label="عدد الستوريات كل يوم آخر 14 يوم">
          {d.daily.map((x) => (
            <div key={x.d} className="bar" title={`${x.d}: ${x.n}`}>
              <span className="n">{x.n || ''}</span>
              <i style={{ height: `${(x.n / max) * 100}%` }} />
              <span className="l">{dayName(x.d)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="sec glass">
        <h2>الدورات</h2>
        {!d.courses.length && <p className="empty">لسا ما في دورات بلّشت.</p>}
        <div className="ctable">
          {d.courses.map((c) => {
            const r = c.students ? Math.round((c.active_7d / c.students) * 100) : 0;
            return (
              <button key={c.id} className="crow press" onClick={() => go('course/' + c.id)}>
                <span className="t"><b>{c.title}</b><small>{c.live ? 'جارية' : c.ended ? 'خلصت' : ''} · {c.students} طالب · {c.stories_total} ستوري</small></span>
                {c.live ? (
                  <span className="meter" aria-label={`${r}% نشطين`}><i style={{ width: `${r}%`, background: r >= 60 ? 'var(--green)' : r >= 30 ? 'var(--yellow)' : 'var(--orange)' }} /><em>{c.active_7d}/{c.students} نشطين</em></span>
                ) : <span className="meter off"><em>{c.stories_7d} هالأسبوع</em></span>}
              </button>
            );
          })}
        </div>
      </section>

      <section className="sec glass">
        <h2>طلاب ما نزّلوا ستوري هالأسبوع {d.quiet.length > 0 && <span className="badge">{d.quiet.length}</span>}</h2>
        <p className="hint">ممكن يحتاجوا تشجيع صغير. الستوريات بتأثر على شارة شهادتهم.</p>
        {!d.quiet.length ? <p className="empty">الكل نشيط 🔥</p> : (
          <div className="quiet">
            {d.quiet.map((s) => (
              <button key={s.id + s.course} className="qrow press" onClick={() => go('member/' + s.id)}>
                <span className="avatar sm"><Photo url={s.photo} id={s.id} /></span>
                <span className="t"><b>{s.name}</b><small>{s.course} · آخر ستوري {since(s.last)}</small></span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// Errors that happened on people's devices (admin only)
export function Errors() {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState(null);
  useEffect(() => {
    supabase.rpc('admin_client_errors').then(({ data, error }) => (error ? setErr(friendlyError(error)) : setRows(data)));
  }, []);
  if (err) return <div className="err" role="alert">{err}</div>;
  if (!rows) return <Spinner />;
  if (!rows.length) return <section className="sec glass"><p className="empty">ما صار ولا خطأ آخر 30 يوم 🎉</p></section>;
  return (
    <section className="sec glass">
      <h2>أخطاء عند المستخدمين (آخر 30 يوم)</h2>
      <p className="hint">كل خطأ بيصير بجهاز حدا بيوصل هون لحاله. نفس الخطأ بيتجمّع بسطر واحد مع عدد مرات تكراره.</p>
      <div className="errs">
        {rows.map((e) => (
          <button key={e.id} className="erow press" onClick={() => setOpen(open === e.id ? null : e.id)} aria-expanded={open === e.id}>
            <span className="t"><b dir="ltr">{e.message}</b>
              <small>{new Date(e.created_at).toLocaleString('ar', { dateStyle: 'medium', timeStyle: 'short' })} · {e.count > 1 ? `${e.count} مرات · ` : ''}{e.user_name || 'زائر'} · {/Android/.test(e.ua) ? 'أندرويد' : /iPhone|iPad/.test(e.ua) ? 'آيفون' : 'كمبيوتر'} · <span dir="ltr">{e.app_version}</span></small>
            </span>
            {open === e.id && <pre dir="ltr">{e.url}{'\n'}{e.ua}{'\n\n'}{e.stack}</pre>}
          </button>
        ))}
      </div>
    </section>
  );
}
