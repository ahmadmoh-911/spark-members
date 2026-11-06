import { useAuth } from './lib/auth.jsx';
import { go, useRoute } from './lib/router.js';
import { Light, Logo, Photo, Spinner } from './ui.jsx';
import Login from './screens/Login.jsx';
import Students from './screens/Students.jsx';
import Install from './Install.jsx';
import { Toast } from './sheet.jsx';
import AppUpdate from './AppUpdate.jsx';
import { lazy, Suspense, useEffect, useState } from 'react';

// only the home grid ships in the first download; every other screen loads on demand
// (and is fetched quietly in the background right after the first paint)
const load = {
  ProfileForm: () => import('./screens/ProfileForm.jsx'),
  Courses: () => import('./screens/Courses.jsx'),
  Course: () => import('./screens/Course.jsx'),
  Member: () => import('./screens/Member.jsx'),
  Stories: () => import('./screens/Stories.jsx'),
  Panel: () => import('./screens/Panel.jsx'),
  Help: () => import('./screens/Help.jsx'),
};
const ProfileForm = lazy(load.ProfileForm);
const Courses = lazy(load.Courses);
const Course = lazy(load.Course);
const Member = lazy(load.Member);
const Stories = lazy(load.Stories);
const Panel = lazy(load.Panel);
const Help = lazy(load.Help);

function HelpFab() {
  return (
    <a className="hfab press" href="#/help" aria-label="شو هاد التطبيق وكيف بستعمله؟">
      <span aria-hidden="true">؟</span>
    </a>
  );
}
import { installPullToRefresh, installSwipeNav } from './gestures.js';

const NAV = [
  { id: 'students', label: 'الطلاب', icon: <><circle cx="9" cy="8" r="3.2" /><path d="M3 19c.6-3.4 3-5.2 6-5.2s5.4 1.8 6 5.2" /><circle cx="17" cy="9" r="2.4" /><path d="M16.5 13.9c2.3.2 4 1.6 4.5 4.6" /></> },
  { id: 'stories', label: 'الستوريات', icon: <><circle cx="12" cy="12" r="8.5" strokeDasharray="4 2.6" /><circle cx="12" cy="12" r="4.2" /></> },
  { id: 'courses', label: 'الدورات', icon: <><path d="M3 8l9-4 9 4-9 4z" /><path d="M7 10v5c0 1.6 2.2 3 5 3s5-1.4 5-3v-5" /></> },
];

function TopBar() {
  const { user, profile, isTrainer, isAdmin } = useAuth();
  const route = useRoute();
  return (
    <header className="top">
      <div className="top-in wrap gut">
        <a className="logo press" href="#/students" aria-label="سبارك — الرئيسية"><Logo /></a>
        <nav className="tabs-top" aria-label="الأقسام">
          {NAV.map((n) => (
            <button key={n.id} className="press" aria-current={route.tab === n.id ? 'page' : undefined} onClick={() => go(n.id)}>{n.label}</button>
          ))}
        </nav>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {isTrainer && <button className="staff-btn press" onClick={() => go('panel')}>{isAdmin ? 'لوحة الإدارة' : 'لوحة المدرب'}</button>}
        {user ? (
          <button className="me-btn press" aria-label="عضويتي" onClick={() => go('me')}>
            <Photo url={profile?.photo_url} id={user.id} style={{ width: '100%', height: '100%', borderRadius: '50%', border: '2px solid var(--bg)' }} />
          </button>
        ) : (
          <button className="login-btn press" onClick={() => go('login')}>دخول</button>
        )}
        </div>
      </div>
    </header>
  );
}

function BottomBar({ tab }) {
  const i = NAV.findIndex((n) => n.id === tab);
  return (
    <nav className="bottom glass" aria-label="الأقسام">
      {i >= 0 && <span className="bind" style={{ '--i': i }} aria-hidden="true" />}
      {NAV.map((n) => (
        <button key={n.id} className="press" aria-current={tab === n.id ? 'page' : undefined} onClick={() => go(n.id)}>
          <svg viewBox="0 0 24 24" aria-hidden="true">{n.icon}</svg>{n.label}
        </button>
      ))}
    </nav>
  );
}

export default function App() {
  const { ready, user, needsOnboarding } = useAuth();
  const route = useRoute();
  const [refresh, setRefresh] = useState(0);
  const [note, setNote] = useState('');
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true), down = () => setOnline(false);
    addEventListener('online', up); addEventListener('offline', down);
    return () => { removeEventListener('online', up); removeEventListener('offline', down); };
  }, []);
  // stories saved while offline went out
  useEffect(() => {
    const on = (e) => { setNote(e.detail > 1 ? `انتشرت ${e.detail} ستوريات كانت مستنية النت ✅` : 'انتشرت الستوري اللي كانت مستنية النت ✅'); setRefresh((n) => n + 1); };
    addEventListener('outbox-sent', on);
    return () => removeEventListener('outbox-sent', on);
  }, []);

  // native-app gestures: pull to refresh, swipe between tabs / back
  useEffect(() => {
    installPullToRefresh(() => setRefresh((n) => n + 1));
    installSwipeNav();
    // warm the other screens once the first one is on screen
    const warm = () => ['Member', 'Stories', 'Courses', 'Course', 'Help', 'ProfileForm'].forEach((k) => load[k]().catch(() => {}));
    const id = window.requestIdleCallback ? requestIdleCallback(warm, { timeout: 4000 }) : setTimeout(warm, 2500);
    return () => (window.cancelIdleCallback ? cancelIdleCallback(id) : clearTimeout(id));
  }, []);

  // hand over from the HTML splash once the session is known (shown at least ~1.8s, never extra after that)
  useEffect(() => {
    if (!ready) return;
    const el = document.getElementById('splash');
    if (!el) return;
    const wait = Math.max(0, 1800 - performance.now());
    const t = setTimeout(() => { el.classList.add('hide'); setTimeout(() => el.remove(), 450); }, wait);
    return () => clearTimeout(t);
  }, [ready]);

  let body;
  if (!ready) body = <Spinner />;
  else if (needsOnboarding) body = <ProfileForm mode="onboard" />;
  else {
    switch (route.page) {
      case 'login': body = user ? <Member id={user.id} /> : <Login />; break;
      case 'me': body = user ? <Member id={user.id} /> : <Login />; break;
      case 'member': body = <Member id={route.id} />; break;
      case 'help': body = <Help />; break;
      case 'panel': body = user ? <Panel /> : <Login />; break;
      case 'course': body = <Course id={route.id} />; break;
      case 'courses': body = <Courses />; break;
      case 'stories': body = <Stories />; break;
      default: body = <Students />;
    }
  }

  return (
    <>
      <Light />
      <TopBar />
      {!online && <div className="offline" role="status">📶 ما في إنترنت. بتشوف آخر نسخة محفوظة، والستوريات بتنتشر لما يرجع النت.</div>}
      <main className="wrap gut">
        <div key={`${route.key ?? 'first'}-${refresh}`} className={`view ${refresh && route.anim !== 'no-anim' ? 'tab-anim' : route.anim}`}><Suspense fallback={<Spinner />}>{body}</Suspense></div>
      </main>
      {!needsOnboarding && <BottomBar tab={route.tab} />}
      <Install />
      <AppUpdate />
      <Toast msg={note} onDone={() => setNote('')} />
      {!needsOnboarding && route.page !== 'help' && <HelpFab />}
    </>
  );
}
