import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase.js';

const AuthCtx = createContext(null);
const ADMIN_MAX_MS = 72 * 60 * 60 * 1000;

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [enrolled, setEnrolled] = useState(false);
  const [ready, setReady] = useState(false);

  const loadProfile = useCallback(async (uid) => {
    if (!uid) { setProfile(null); setEnrolled(false); return; }
    const [{ data: p }, { count }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', uid).maybeSingle(),
      supabase.from('enrollments').select('id', { count: 'exact', head: true }).eq('student_id', uid),
    ]);
    setProfile(p ?? null);
    setEnrolled((count ?? 0) > 0);
  }, []);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      setSession(data.session);
      await loadProfile(data.session?.user?.id);
      // drop the one-time ?code= from the address bar after sign-in
      if (location.search.includes('code=')) history.replaceState(null, '', location.pathname + location.hash);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      // never await Supabase calls inside this callback
      setTimeout(() => loadProfile(s?.user?.id), 0);
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [loadProfile]);

  // admin sign-ins expire 72h after the Google login, wherever the session lives
  useEffect(() => {
    if (profile?.role !== 'admin' || !session?.user?.last_sign_in_at) return;
    const check = () => {
      if (Date.now() - Date.parse(session.user.last_sign_in_at) > ADMIN_MAX_MS) {
        supabase.auth.signOut().then(() => { location.hash = '#/login'; });
      }
    };
    check();
    const t = setInterval(check, 10 * 60 * 1000);
    return () => clearInterval(t);
  }, [profile?.role, session]);

  const signInWithGoogle = () => supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: location.origin + location.pathname, queryParams: { prompt: 'select_account' } },
  });
  const signOut = () => supabase.auth.signOut();

  const value = {
    ready, session, profile, enrolled,
    user: session?.user ?? null,
    role: profile?.role ?? null,
    isAdmin: profile?.role === 'admin',
    isTrainer: profile?.role === 'trainer' || profile?.role === 'admin',
    needsOnboarding: !!session && !!profile && !profile.onboarded,
    refresh: () => loadProfile(session?.user?.id),
    signInWithGoogle, signOut,
  };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
