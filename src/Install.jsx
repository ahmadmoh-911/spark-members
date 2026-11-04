import { useEffect, useState } from 'react';
import { Sheet } from './sheet.jsx';

const KEY = 'spark-install-dismissed';
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isPhone = () => matchMedia('(max-width: 899px)').matches && matchMedia('(pointer: coarse)').matches;
const dismissedRecently = () => { try { return Date.now() - Number(localStorage.getItem(KEY) || 0) < 3 * 864e5; } catch { return false; } };

// Floating "install as an app" bar on phones opened in the browser.
// Android/Chrome: native install prompt. iPhone: short how-to (Safari has no install API).
export default function Install() {
  const [evt, setEvt] = useState(null);
  const [show, setShow] = useState(false);
  const [howto, setHowto] = useState(false);

  useEffect(() => {
    if (isStandalone() || !isPhone() || dismissedRecently()) return;
    const onPrompt = (e) => { e.preventDefault(); setEvt(e); setShow(true); };
    const onInstalled = () => setShow(false);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    let t;
    if (isIOS()) t = setTimeout(() => setShow(true), 1200);
    return () => { clearTimeout(t); window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);

  const close = () => { setShow(false); try { localStorage.setItem(KEY, String(Date.now())); } catch { /* private mode */ } };
  const install = async () => {
    if (evt) { evt.prompt(); const r = await evt.userChoice; setEvt(null); if (r.outcome === 'accepted') setShow(false); }
    else setHowto(true);
  };

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
        <Sheet title="التثبيت على الآيفون" onClose={() => setHowto(false)}>
          <ol style={{ margin: 0, paddingInlineStart: 22, lineHeight: 2, fontSize: 16 }}>
            <li>افتح الموقع بـ <b>Safari</b>.</li>
            <li>اضغط زر المشاركة <span aria-hidden="true">⬆︎</span> تحت الشاشة.</li>
            <li>اختار <b>إضافة إلى الشاشة الرئيسية</b>، بعدين <b>إضافة</b>.</li>
          </ol>
        </Sheet>
      )}
    </>
  );
}
