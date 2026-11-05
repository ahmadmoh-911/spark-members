import { LOGO_DARK } from './ui.jsx';

const fmtDate = (d) => (d ? new Date(d + 'T00:00').toLocaleDateString('ar', { day: 'numeric', month: 'long', year: 'numeric' }) : '');

// Fixed Spark certificate. Scales with its box (container query units), so it looks the same
// as a small card on a phone and full-size on a laptop. Student + course names are filled in.
export default function Certificate({ name, course, date, code, trainer }) {
  return (
    <div className="certx" role="img" aria-label={`شهادة سبارك: ${name}، دورة ${course}`}>
      <div className="cx-in">
        <span className="cx-corner tr" aria-hidden="true" /><span className="cx-corner bl" aria-hidden="true" />
        <span className="cx-dots" aria-hidden="true"><i /><i /><i /><i /><i /><i /></span>
        <img className="cx-logo" src={LOGO_DARK} alt="" />
        <div className="cx-kicker">شهادة إتمام</div>
        <div className="cx-line">تُمنح هذه الشهادة إلى</div>
        <div className="cx-name">{name}</div>
        <div className="cx-line">تقديراً لإتمام دورة</div>
        <div className="cx-course">{course}</div>
        <div className="cx-foot">
          <div><b>{fmtDate(date)}</b><span>التاريخ</span></div>
          <div className="cx-seal" aria-hidden="true"><span>سبارك</span></div>
          <div><b>{trainer || 'إدارة سبارك'}</b><span>{trainer ? 'المدرب' : 'التوقيع'}</span></div>
        </div>
        <div className="cx-code" dir="ltr">{code}</div>
      </div>
    </div>
  );
}
