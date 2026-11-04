import { useAuth } from '../lib/auth.jsx';
import { go } from '../lib/router.js';
import { Logo } from '../ui.jsx';

const C = { green: 'var(--green)', blue: 'var(--blue)', orange: 'var(--orange)', yellow: 'var(--yellow)' };

function Card({ icon, color, title, children, i }) {
  return (
    <section className="hcard glass" style={{ '--c': color, animationDelay: `${80 + i * 70}ms` }}>
      <span className="hico" aria-hidden="true">{icon}</span>
      <div className="hbody">
        <h2>{title}</h2>
        {children}
      </div>
    </section>
  );
}

export default function Help() {
  const { isAdmin, isTrainer } = useAuth();
  let i = 0;
  return (
    <div className="help">
      <header className="hhero glass">
        <div className="hlogo"><Logo h={56} /></div>
        <h1>أهلاً فيك بطلاب سبارك! <span aria-hidden="true">👋</span></h1>
        <p>هون المكان اللي بيلتقي فيه كل طلاب سبارك للابتكار والإبداع. كل واحد إله <b>عضوية</b> فيها اسمه وصورته وشو بيعرف يعمل، ودوراته وشهاداته وشغله.</p>
        <p>يعني بدل ما تحكي «أنا أخدت دورة»، بتبعت الرابط وخلّي البروفايل يحكي عنك <span aria-hidden="true">😎</span></p>
      </header>

      <Card i={i++} icon="🔑" color={C.blue} title="كيف بدخل؟">
        <p>بحساب <b>Gmail</b> تبعك وبس. ما في كلمات سر تنساها، ولا «نسيت كلمة المرور» كل أسبوع.</p>
        <p>بعد أول دخول بنطلب منك تعبّي عضويتك: الاسم، التخصص، جملة عنك، وصورة حلوة.</p>
        <p className="hnote">عضويتك بتضل مخفية لحد ما الإدارة تضيفك على دورة وتبلّش الدورة. يعني ما في حدا بيشوفك وإنت لسا «تحت الإنشاء» 🏗️</p>
      </Card>

      <Card i={i++} icon="🪪" color={C.green} title="عضويتك">
        <ul>
          <li><b>رقم عضوية</b> خاص فيك، مثل <span dir="ltr" style={{ whiteSpace: 'nowrap' }}>SPK-M-0007</span>.</li>
          <li><b>نبذة ومهارات وأهداف:</b> اكتب اللي بتحبه، بس خليها صادقة. «خبير بكل إشي» ما بتقنع حدا 😅</li>
          <li><b>مشاريع وشهادات من برّا سبارك:</b> ضيفها بصورة وكم سطر.</li>
          <li><b>دورات وشهادات سبارك:</b> هاي بتضيفها الإدارة، وما بتنعدّل من عندك. منعرف إنك كنت بدك تعطي حالك ماسي 💎</li>
        </ul>
        <p>علامة <b style={{ color: '#2D7BD8' }}>✔︎ الزرقا</b> جنب الاسم يعني إنك بدورتين أو أكتر. يعني من أهل البيت.</p>
      </Card>

      <Card i={i++} icon="📸" color={C.orange} title="الستوريات">
        <ul>
          <li>نزّل <b>نص</b> (على خلفية سودا أنيقة) أو <b>صورة</b> أو <b>فيديو</b>.</li>
          <li>إذا إنت بأكتر من دورة، بتختار لأي دورة بتنحسب الستوري.</li>
          <li>الستوري بتعيش <b>24 ساعة</b>، وبعدها بتروح على أرشيفك، ما بتختفي.</li>
          <li><b>إنت بس</b> بتشوف كم واحد شافها 👀. العدد بس، مش مين بالضبط، فارتاح.</li>
        </ul>
        <div className="hgest">
          <span><b>الطرف</b>بتنقل</span>
          <span><b>النص</b>بتوقف</span>
          <span><b>ضغطة طويلة</b>بتوقف لحد ما تشيل إصبعك</span>
          <span><b>سحب</b>بتنقل لشخص تاني</span>
        </div>
      </Card>

      <Card i={i++} icon="🏅" color={C.yellow} title="الشارات: فضي، ذهبي، ماسي">
        <p>كل شهادة سبارك إلها شارة، والشارة بتنحسب من شغلتين:</p>
        <ul>
          <li><b>رأي المدرب فيك:</b> بتعرف حالك 😏</li>
          <li><b>تفاعلك بالدورة:</b> يعني ستورياتك خلال الدورة. تقريباً <b>4 ستوريات بالأسبوع</b> بتخليك بالسليم.</li>
        </ul>
        <p>الأرقام مخفية عن الكل، والشارة بس اللي بتبيّن. يعني ما في حدا بيعرف إنك أخدت 61 مش 60 🤫</p>
        <p className="hnote"><b>السر:</b> نزّل ستوري عن شو تعلمت أو شو عملت. حتى «اليوم فهمت الـ for loop أخيراً 🎉» بتنحسب.</p>
      </Card>

      <Card i={i++} icon="📲" color={C.blue} title="نزّله كتطبيق">
        <ul>
          <li><b>أندرويد:</b> اكبس زر «تثبيت» اللي بيطلعلك تحت، أو من قائمة ⋮ اختار «تثبيت التطبيق».</li>
          <li><b>آيفون:</b> من Safari، زر المشاركة ⬆︎، بعدين «إضافة إلى الشاشة الرئيسية».</li>
        </ul>
        <p>وصار عندك تطبيق بدون ما تستنى المتجر 🚀</p>
      </Card>

      {isTrainer && (
        <Card i={i++} icon="🧑‍🏫" color={C.green} title="للمدربين">
          <p>من «لوحة المدرب» بتشوف طلاب دوراتك وإيميلاتهم، وبتعطي كل واحد <b>نجوم من 1 لـ 5</b>. النجوم سرية، ما حدا بيشوفها غيرك وغير الإدارة. يعني ارتاح وقيّم بضمير 😇</p>
        </Card>
      )}

      {isAdmin && (
        <Card i={i++} icon="🛠️" color={C.orange} title="للإدارة">
          <ul>
            <li>تضيف دورات، وتضيف الطلاب بإيميلاتهم، وتبعتلهم رسالة قبول إذا بدك.</li>
            <li>تصدر الشهادات وترفق صورتها أو PDF.</li>
            <li>تضيف مدربين وإداريين، وتحذف أي ستوري مش مناسبة.</li>
          </ul>
        </Card>
      )}

      <Card i={i++} icon="❓" color={C.yellow} title="أسئلة سريعة">
        <dl className="hfaq">
          <dt>ليش عضويتي مش ظاهرة؟</dt><dd>لأن دورتك لسا ما بلّشت، أو الإدارة لسا ما ضافتك. اصبر، الحلو بيستاهل 🙂</dd>
          <dt>ليش ما بقدر أنزّل ستوري؟</dt><dd>لازم تكون عضو بدورة بلّشت.</dd>
          <dt>رقم الواتساب لازم؟</dt><dd>لا، اختياري، وما بيشوفه غير الإدارة.</dd>
          <dt>الثيم الداكن وين؟</dt><dd>ما في. سبارك منوّرة دايماً ☀️</dd>
        </dl>
      </Card>

      <button className="cta press hgo" onClick={() => (history.length > 1 ? history.back() : go('students'))}>يلا نبلّش ✨</button>
    </div>
  );
}

export function HelpFab() {
  return (
    <a className="hfab press" href="#/help" aria-label="شو هاد التطبيق وكيف بستعمله؟">
      <span aria-hidden="true">؟</span>
    </a>
  );
}
