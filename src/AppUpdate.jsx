import { useState } from 'react';
import twa from '../android/twa-manifest.json';

// The newest Android app version (from the same file the APK is built from).
const LATEST = twa.appVersionCode;
const KEY = 'spark-apk-version';
const SITE = 'ahmadmoh-911.github.io/spark-members/';

// Remember which APK version opened us: the APK starts the site at ?apk=<versionCode>.
function readApkVersion() {
  const q = new URLSearchParams(location.search);
  const v = Number(q.get('apk'));
  try {
    if (v) {
      localStorage.setItem(KEY, String(v));
      q.delete('apk');
      const rest = q.toString();
      history.replaceState(null, '', location.pathname + (rest ? `?${rest}` : '') + location.hash);
      return v;
    }
    // the very first APK (version 1) opened the site without ?apk — recognise it by its Android referrer
    if (document.referrer.startsWith('android-app://io.github.ahmadmoh911.spark')) {
      const known = Number(localStorage.getItem(KEY)) || 0;
      if (!known) { localStorage.setItem(KEY, '1'); return 1; }
    }
    return Number(localStorage.getItem(KEY)) || 0;
  } catch { return v || 0; }
}

// Inside an old APK: ask the user to open the site in the browser and install the new version.
export default function AppUpdate() {
  const [ver] = useState(readApkVersion);
  const [hide, setHide] = useState(() => { try { return sessionStorage.getItem('spark-apk-later') === '1'; } catch { return false; } });
  // only inside the installed app (the browser shares this storage with the app, so check the display mode)
  const inApp = matchMedia('(display-mode: standalone)').matches || document.referrer.startsWith('android-app://');
  if (!inApp || !ver || ver >= LATEST || hide) return null;
  // open the website in Chrome itself (not inside this app), where the install button lives
  const intent = `intent://${SITE}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent('https://' + SITE)};end`;
  const later = () => { setHide(true); try { sessionStorage.setItem('spark-apk-later', '1'); } catch { /* ignore */ } };
  return (
    <div className="appupd glass" role="alert">
      <span className="ico" aria-hidden="true">✨</span>
      <span className="t">
        <b>في نسخة جديدة من تطبيق سبارك</b>
        <span>افتح موقع سبارك بالمتصفح، واكبس زر «تنزيل» تحت لتنزّل النسخة الجديدة وتثبّتها فوق القديمة. حسابك وبياناتك بيضلّوا زي ما هم.</span>
      </span>
      <div className="acts">
        <a className="save press" href={intent}>افتح الموقع بالمتصفح</a>
        <button className="link" onClick={later}>بعدين</button>
      </div>
    </div>
  );
}
