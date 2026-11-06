// Builds link-preview pages for every visible member: dist/p/<id>/index.html (+ card.png).
// WhatsApp/Facebook/Telegram don't run JavaScript, so each profile gets a tiny static page with
// Open Graph tags and a picture card, which then forwards real visitors into the app.
// usage (after `vite build`): node scripts/build-share.mjs
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const URL_ = 'https://eqifcrpkwyzvgdbwzydg.supabase.co';
const ANON = readFileSync('src/lib/supabase.js', 'utf8').match(/'(eyJ[^']+)'/)[1];
const SITE = (process.env.SITE_URL || 'https://ahmadmoh-911.github.io/spark-members/').replace(/\/?$/, '/');
const DIST = resolve('dist');
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let members;
if (process.env.MEMBERS_JSON) members = JSON.parse(readFileSync(process.env.MEMBERS_JSON, 'utf8')); // local testing
else {
  const res = await fetch(`${URL_}/rest/v1/rpc/public_members`, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } });
  if (!res.ok) throw new Error(`public_members ${res.status}`);
  members = await res.json();
}
console.log('members:', members.length);

const embed = (f) => 'data:font/woff2;base64,' + readFileSync(resolve(`node_modules/@fontsource/readex-pro/files/${f}`)).toString('base64');
const font = (w) => embed(`readex-pro-arabic-${w}-normal.woff2`);
const fontL = (w) => embed(`readex-pro-latin-${w}-normal.woff2`);
const logo = 'data:image/png;base64,' + readFileSync('public/brand/logo-dark.png').toString('base64');

const card = (m) => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:R;src:url(${font(700)});font-weight:700;unicode-range:U+0600-06FF,U+FB50-FDFF,U+FE70-FEFC}
@font-face{font-family:R;src:url(${font(400)});font-weight:400;unicode-range:U+0600-06FF,U+FB50-FDFF,U+FE70-FEFC}
@font-face{font-family:R;src:url(${fontL(700)});font-weight:700}@font-face{font-family:R;src:url(${fontL(400)});font-weight:400}
*{margin:0;box-sizing:border-box}html{overflow:hidden}body{width:1200px;height:630px;overflow:hidden;font-family:R,sans-serif;background:#EEF2F8;position:relative;color:#0B1A33}
.b{position:absolute;border-radius:50%;filter:blur(70px);opacity:.55}
.c{direction:rtl;position:absolute;inset:40px;border-radius:44px;background:rgba(255,255,255,.78);box-shadow:0 30px 70px -30px rgba(11,26,51,.35);display:flex;align-items:center;gap:56px;padding:0 70px}
.ph{flex:none;width:330px;height:330px;border-radius:50%;padding:12px;background:conic-gradient(#4BB454,#2D7BD8,#F47B20,#FFCD05,#4BB454)}
.ph div{width:100%;height:100%;border-radius:50%;border:10px solid #fff;background:#cbd5e1 center/cover;display:grid;place-items:center;font-size:120px;font-weight:700;color:#fff;background-image:linear-gradient(145deg,#5B9BE6,#1E5AA8)}
.t{display:grid;gap:14px;min-width:0}.n{font-size:72px;font-weight:700;line-height:1.15}.s{font-size:36px;color:#134F96;font-weight:700}
.m{font-size:28px;color:#475569}.l{position:absolute;top:70px;left:80px;width:230px}
</style></head><body>
<div class="b" style="width:620px;height:620px;left:-160px;top:-200px;background:#134F96"></div>
<div class="b" style="width:520px;height:520px;right:-120px;bottom:-200px;background:#F47B20"></div>
<div class="b" style="width:420px;height:420px;left:420px;bottom:-240px;background:#FFCD05"></div>
<div class="c"><div class="ph"><div style="${m.photo_url ? `background-image:url('${esc(m.photo_url)}')` : ''}">${m.photo_url ? '' : esc((m.full_name || '؟').trim()[0])}</div></div>
<div class="t"><div class="n">${esc(m.full_name)}</div>${m.specialty || m.tagline ? `<div class="s">${esc(m.tagline || m.specialty)}</div>` : ''}<div class="m">عضو بطلاب سبارك للابتكار والإبداع</div></div></div>
<img class="l" src="${logo}"></body></html>`;

const page = ({ title, desc, image, to, url }) => `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<title>${esc(title)}</title><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="profile"><meta property="og:site_name" content="طلاب سبارك">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(image)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:url" content="${esc(url)}"><meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0; url=${esc(to)}"><link rel="canonical" href="${esc(url)}">
<script>location.replace(${JSON.stringify(to)})</script></head>
<body style="font-family:sans-serif;text-align:center;padding:40px"><a href="${esc(to)}">${esc(title)}</a></body></html>`;

const { chromium } = await import('playwright');
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const tab = await browser.newPage({ viewport: { width: 1200, height: 630 } });

async function shot(html, out) {
  await tab.setContent(html, { waitUntil: 'networkidle' }).catch(() => {});
  await tab.evaluate(() => document.fonts.ready);
  await tab.screenshot({ path: out, type: 'jpeg', quality: 86 });
}

// site-wide card for the home page and the courses
mkdirSync(join(DIST, 'p'), { recursive: true });
await shot(card({ full_name: 'طلاب سبارك', tagline: 'صفحات طلاب دورات سبارك وستورياتهم وشهاداتهم', photo_url: null }), join(DIST, 'p', 'card.jpg'));

for (const m of members) {
  const dir = join(DIST, 'p', m.id);
  mkdirSync(dir, { recursive: true });
  await shot(card(m), join(dir, 'card.jpg'));
  writeFileSync(join(dir, 'index.html'), page({
    title: `${m.full_name} · طلاب سبارك`,
    desc: m.tagline || m.specialty || 'عضو بطلاب سبارك للابتكار والإبداع',
    image: `${SITE}p/${m.id}/card.jpg`,
    url: `${SITE}p/${m.id}/`,
    to: `${SITE}#/member/${m.id}`,
  }));
}
await browser.close();

// links to profiles created after this build still work: forward /p/<id>/ into the app
writeFileSync(join(DIST, '404.html'), `<!doctype html><meta charset="utf-8"><script>
var m=location.pathname.match(/\\/p\\/([0-9a-f-]{36})/);location.replace(${JSON.stringify(SITE)}+(m?'#/member/'+m[1]:''));
</script>`);

// preview tags for the home page itself
const idx = join(DIST, 'index.html');
if (existsSync(idx)) {
  const tags = `<meta property="og:title" content="طلاب سبارك"><meta property="og:description" content="صفحات طلاب دورات سبارك للابتكار والإبداع: البروفايلات والستوريات والشهادات.">
<meta property="og:image" content="${SITE}p/card.jpg"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:type" content="website"><meta name="twitter:card" content="summary_large_image">`;
  writeFileSync(idx, readFileSync(idx, 'utf8').replace('</title>', `</title>\n${tags}`));
}
console.log('share pages built');
