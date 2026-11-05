import { useEffect, useState } from 'react';
import { Sheet } from './sheet.jsx';

export const APK_URL = 'https://github.com/ahmadmoh-911/spark-members/releases/download/android/spark.apk';
const KEY = 'spark-install-dismissed';
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
  || document.referrer.startsWith('android-app://');
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isAndroid = () => /android/i.test(navigator.userAgent);
const isPhone = () => matchMedia('(max-width: 899px)').matches && matchMedia('(pointer: coarse)').matches;
const dismissedRecently = () => { try { return Date.now() - Number(localStorage.getItem(KEY) || 0) < 3 * 864e5; } catch { return false; } };

// Floating "get the app" bar on phones in the browser.
// Android: downloads the real APK. iPhone: how to add it to the home screen (Apple allows nothing else).
export default function Install() {
  const [show, setShow] = useState(false);
  const [howto, setHowto] = useState(false);

  useEffect(() => {
    if (isStandalone() || !isPhone() || dismissedRecently()) return;
    // stop Chrome's own "add to home screen" — on Android we offer the APK instead
    const stop = (e) => e.preventDefault();
    window.addEventListener('beforeinstallprompt', stop);
    const t = setTimeout(() => setShow(true), 1500);
    return () => { clearTimeout(t); window.removeEventListener('beforeinstallprompt', stop); };
  }, []);

  const close = () => { setShow(false); try { localStorage.setItem(KEY, String(Date.now())); } catch { /* private mode */ } };

  if (!show) return null;
  const android = isAndroid();
  return (
    <>
      <div className="install glass" role="region" aria-label="تنزيل التطبيق">
        <img src={`${import.meta.env.BASE_URL}brand/icon-192.png`} alt="" width="44" height="44" />
        <span className="t"><b>نزّل تطبيق سبارك</b><span>{android ? 'تطبيق أندرويد، بيفتح أسرع' : 'ضيفه على شاشتك الرئيسية'}</span></span>
        <button className="save press" onClick={() => setHowto(true)}>{android ? 'تنزيل' : 'تثبيت'}</button>
        <button className="x" aria-label="إخفاء" onClick={close}>×</button>
      </div>
      {howto && (
        <Sheet title={android ? 'تطبيق سبارك للأندرويد' : 'التثبيت على الآيفون'} onClose={() => setHowto(false)}>
          {android ? (
            <>
              <ol style={{ margin: 0, paddingInlineStart: 22, lineHeight: 2, fontSize: 16 }}>
                <li>اكبس <b>نزّل التطبيق</b> تحت، وبينزل ملف <span dir="ltr">spark.apk</span>.</li>
                <li>افتحه من الإشعارات أو من التنزيلات.</li>
                <li>إذا سألك الجوال، اسمح بـ <b>«تثبيت تطبيقات من هذا المصدر»</b>، بعدين <b>تثبيت</b>.</li>
              </ol>
              <a className="cta press" style={{ display: 'grid', placeItems: 'center', textDecoration: 'none' }} href={APK_URL} onClick={() => setTimeout(close, 500)}>نزّل التطبيق</a>
              <p style={{ fontSize: 13, color: 'var(--muted)', margin: '10px 0 0' }}>التطبيق بيفتح نفس الموقع وبنفس حسابك، وكل التحديثات بتوصله لحالها.</p>
            </>
          ) : (
            <ol style={{ margin: 0, paddingInlineStart: 22, lineHeight: 2, fontSize: 16 }}>
              <li>افتح الموقع بـ <b>Safari</b>.</li>
              <li>اضغط زر المشاركة <span aria-hidden="true">⬆︎</span> تحت الشاشة.</li>
              <li>اختار <b>إضافة إلى الشاشة الرئيسية</b>، بعدين <b>إضافة</b>.</li>
            </ol>
          )}
        </Sheet>
      )}
    </>
  );
}
