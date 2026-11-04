import { createClient } from '@supabase/supabase-js';

// Public project URL and anon key. Safe in the browser: every table is protected by row-level security.
export const SUPABASE_URL = 'https://eqifcrpkwyzvgdbwzydg.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxaWZjcnBrd3l6dmdkYnd6eWRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2Mzc0NzIsImV4cCI6MjEwOTIxMzQ3Mn0.33XDUD5REAXNrKhto-lywI3W8ddfiRFl0dG0rIvzULk';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export const membershipNo = (n) => (n ? `SPK-M-${String(n).padStart(4, '0')}` : '');

export const uploadAvatar = (userId, file) => uploadMedia(userId, file, 'avatar');

export async function uploadMedia(userId, file, prefix = 'file') {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `u/${userId}/${prefix}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('media').upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return supabase.storage.from('media').getPublicUrl(path).data.publicUrl;
}

export function friendlyError(e) {
  const m = e?.message || '';
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'ما في اتصال بالإنترنت. جرّب كمان شوي.';
  if (/provider is not enabled|Unsupported provider/i.test(m)) return 'تسجيل الدخول بـ Google لسا مش مفعّل بقاعدة البيانات.';
  if (/row-level security|permission denied/i.test(m)) return 'ما عندك صلاحية لهالعملية.';
  if (/Unexpected token|not valid JSON|504|timed? ?out/i.test(m)) return 'السيرفر ما ردّ بالوقت. جرّب كمان مرة.';
  if (/exceeded the maximum allowed size|Payload too large/i.test(m)) return 'الصورة أكبر من الحجم المسموح (50 ميغا).';
  return m || 'صار خطأ غير متوقع.';
}
