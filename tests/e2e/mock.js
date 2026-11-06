// A fake Supabase backend so the app can be exercised end to end without touching real data.
const iso = (d) => d.toISOString().slice(0, 10);
const add = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
export const UID = '00000001-0000-0000-0000-000000000000';
const names = ['سارة أحمد', 'محمد خالد', 'لين يوسف', 'عمر حسن', 'رهف سمير', 'عبد الرحمن الشريف'];
export const members = names.map((n, i) => ({ id: `0000000${i + 1}-0000-0000-0000-000000000000`, member_no: i + 1, full_name: n, tagline: 'بحب أصمم تجارب سهلة', photo_url: null, specialty: 'تصميم', course_count: i % 2 ? 2 : 1, course_ids: [1] }));
const courses = [
  { id: 1, title: 'تصميم واجهات المستخدم', category: 'تصميم', description: 'دورة عملية', cover_url: null, start_date: add(-17), end_date: add(25), trainer_name: 'رامي سالم', member_count: 6, faces: [] },
  { id: 2, title: 'البرمجة بالبايثون', category: 'برمجة', cover_url: null, start_date: add(5), end_date: add(40), trainer_name: 'هبة', member_count: 0, faces: [] },
];
const now = Date.now();
const stories = Array.from({ length: 8 }, (_, k) => {
  const a = members[1 + (k % 5)];
  return { id: k + 1, author_id: a.id, course_id: 1, kind: 'text', body: 'تعلمنا اليوم إشي جديد ' + k, media_url: null, thumb_url: null, created_at: new Date(now - (k + 1) * 1800e3).toISOString(), author: { id: a.id, full_name: a.full_name, photo_url: null }, course: { title: 'تصميم' } };
});
export const calls = [];

export async function mockSupabase(page, { signedIn = false, role = 'student' } = {}) {
  await page.addInitScript(([uid, signedIn]) => {
    localStorage.setItem('spark-install-dismissed', String(Date.now()));
    if (signedIn) localStorage.setItem('sb-eqifcrpkwyzvgdbwzydg-auth-token', JSON.stringify({ access_token: 'x', refresh_token: 'y', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: uid, email: 's@gmail.com', app_metadata: { provider: 'google' }, user_metadata: {}, aud: 'authenticated' } }));
  }, [UID, signedIn]);
  await page.route('**/*.supabase.co/**', (r) => {
    const u = r.request().url();
    calls.push(u);
    let body = [];
    const h = {};
    if (u.includes('log_client_error')) body = null;
    else if (u.includes('public_members')) body = members;
    else if (u.includes('home_stats')) body = [{ members: 42, live_courses: 3, stories_today: 8 }];
    else if (u.includes('public_courses')) body = courses;
    else if (u.includes('course_roster')) body = members.map((m) => ({ ...m, student_id: m.id }));
    else if (u.includes('member_courses')) body = [{ course_id: 1, title: 'تصميم واجهات المستخدم', category: 'تصميم', start_date: add(-17), end_date: add(25) }];
    else if (u.includes('member_certificates')) body = [];
    else if (u.includes('member_stats')) body = [{ courses: 1, certificates: 0, stories: 3 }];
    else if (u.includes('member_visible')) body = true;
    else if (u.includes('panel_insights')) body = { students_live: 6, active_7d: 4, stories_7d: 8, stories_prev_7d: 5, views_7d: 30, reactions_7d: 12, daily: Array.from({ length: 14 }, (_, i) => ({ d: add(i - 13), n: i % 4 })), courses: [{ id: 1, title: 'تصميم واجهات المستخدم', live: true, ended: false, students: 6, stories_7d: 8, stories_total: 20, active_7d: 4 }], quiet: [{ id: members[5].id, name: members[5].full_name, photo: null, course: 'تصميم واجهات المستخدم', last: null }] };
    else if (u.includes('/stories') && u.includes('select=author_id')) body = [{ author_id: members[1].id }];
    else if (u.includes('/stories')) body = stories;
    else if (u.includes('/profiles')) body = { id: UID, member_no: 1, full_name: 'سارة أحمد', specialty: 'تصميم واجهات', tagline: 'بحب أصمم', about: 'طالبة تصميم.', skills: ['Figma'], goals: [], photo_url: null, role, onboarded: true, course_count: 1 };
    else if (u.includes('/enrollments')) h['content-range'] = '0-0/1';
    else if (u.includes('/auth/v1/user')) body = { id: UID, email: 's@gmail.com', app_metadata: { provider: 'google' }, aud: 'authenticated' };
    r.fulfill({ status: 200, contentType: 'application/json', headers: h, body: JSON.stringify(body) });
  });
}
