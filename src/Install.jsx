import { useEffect, useState } from 'react';
import { Sheet } from './sheet.jsx';

const KEY = 'spark-install-dismissed';
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isInApp = () => /FBAN|FBAV|Instagram|WhatsApp|Line\/|wv\)/i.test(navigator.userAgent);
const isPhone = () => matchMedia('(max-width: 899px)').matches && matchMedia('(pointer: coarse)').matches;
const dismissedRecently = () => { try { return Date.now() - Number(localStorage.getItem(KEY) || 0) < 3 * 864e5; } catch { return false; } };

// Floating "install as an app" bar on phones opened in the browser.
// Android/Chrome: native install prompt. iPhone: short how-to (Safari has no install API).
export default function Install() {
  const [evt, setEvt] = useState(null);
  const [show, setShow] = useState(false);
  const [howto, setHowto] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (isStandalone() || !isPhone() || dismissedRecently()) return;
    const onPrompt = (e) => { e.preventDefault(); setEvt(e); setShow(true); };
    const onInstalled = () => setShow(false);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    // iPhone has no install API, and in-app browsers (WhatsApp, Instagram) never offer one: show the how-to instead
    const t = setTimeout(() => setShow(true), isIOS() || isInApp() ? 1200 : 3500);
    return () => { clearTimeout(t); window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);

  const close = () => { setShow(false); try { localStorage.setItem(KEY, String(Date.now())); } catch { /* private mode */ } };
  const install = async () => {
    if (evt) {
      evt.prompt();
      const r = await evt.userChoice;
      setEvt(null);
      if (r.outcome === 'accepted') { setShow(false); setDone(true); setTimeout(() => setDone(false), 6000); }
    } else setHowto(true);
  };

  if (done) return <div className="toast" role="status">جارٍ التثبيت… بعد ثواني بتلاقي «سبارك» بالشاشة الرئيسية أو بقائمة التطبيقات.</div>;
  if (!show) return null;
  return (
    <>
      <div className="install glass" role="region" aria-label="تثبيت التطبيق">
        <img src={`${import.meta.env.BASE_URL}brand/icon-192.png`} alt="" width="44" height="44" />
        <span className="t"><b>ثبّت تطبيق سبارك</b><span>بيفتح أسرع ومن شاشتك الرئيسية</span></span>
        <button className="save press" onClick={install}>تثبيت</button>
        <button className="x" aria-label="إخفاء" onClick={close}>×</button>
      </div>
      {howto && (
        <Sheet title="تثبيت التطبيق" onClose={() => setHowto(false)}>
          {isIOS() ? (
            <ol style={{ margin: 0, paddingInlineStart: 22, lineHeight: 2, fontSize: 16 }}>
              <li>افتح الموقع بـ <b>Safari</b>.</li>
              <li>اضغط زر المشاركة <span aria-hidden="true">⬆︎</span> تحت الشاشة.</li>
              <li>اختار <b>إضافة إلى الشاشة الرئيسية</b>، بعدين <b>إضافة</b>.</li>
            </ol>
          ) : (
            <ol style={{ margin: 0, paddingInlineStart: 22, lineHeight: 2, fontSize: 16 }}>
              {isInApp() && <li>افتح الرابط بمتصفح <b>Chrome</b> (من القائمة: «فتح في المتصفح»).</li>}
              <li>اضغط على النقاط الثلاث <b>⋮</b> فوق.</li>
              <li>اختار <b>تثبيت التطبيق</b> أو <b>إضافة إلى الشاشة الرئيسية</b>، بعدين <b>تثبيت</b>.</li>
            </ol>
          )}
        </Sheet>
      )}
    </>
  );
}
