/* ===========================================================
   GELEN LOUNGE · AI МИКСОЛОГ 2026
   Логика: подтверждённая база наличия, подбор микса, анимации
   =========================================================== */
'use strict';

/* ---------- 1. БАЗА ВКУСОВ (внешний файл flavors.js кладёт window.FLAVORS) ---------- */
const flavors = (window.FLAVORS || []).map(f => ({...f}));

const BRANDS = [...new Set(flavors.map(f => f.brand))].sort((a, b) => a.localeCompare(b, 'ru'));
const STOCK_COUNT = flavors.filter(f => f.inStock).length;

/* ---------- 2. СОСТОЯНИЕ ---------- */
let mode = 'guest';
let availability = 'stock';
let lastMix = null;

const $ = id => document.getElementById(id);

/* ---------- 3. УТИЛИТЫ ---------- */
const norm = s => (s || '').toLowerCase().replaceAll('ё', 'е');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function hashText(s) {
  let h = 0; s = norm(s || '');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function toast(msg) {
  const t = $('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ---------- 4. НАСТРОЙКИ РЕЖИМОВ ---------- */
function setMode() {
  mode = 'guest';
  if (lastMix) renderMix(lastMix.ings, lastMix.intent, lastMix.q);
}

function setAvailability() {
  availability = 'stock';
  const hint = $('availabilityHint');
  if (hint) hint.innerHTML = `Используем только подтверждённое наличие Gelen — <em>${STOCK_COUNT} вкусов</em>`;
}

function quick(t, el) {
  $('query').value = t;
  updateCounter();
  submitMix();
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('on'));
  if (el && el.classList) el.classList.add('on');
  if (innerWidth < 1000) $('result').scrollIntoView({behavior: 'smooth', block: 'center'});
}

function updateCounter() {
  const v = $('query').value.length;
  $('counter').textContent = v ? `${v} симв.` : '';
}

/* ---------- 5. 18+ ---------- */
function acceptAge() {
  try { localStorage.setItem('age-ok', 'yes'); } catch (e) {}
  const g = $('ageGate');
  g.classList.add('hide');
  setTimeout(() => g.style.display = 'none', 600);
  burst();
}
function denyAge() { $('denied').style.display = 'block'; }
try { if (localStorage.getItem('age-ok') === 'yes') $('ageGate').style.display = 'none'; } catch (e) {}

/* ---------- 6. АНАЛИЗ ЗАПРОСА ---------- */
function analyze(q) {
  q = norm(q || 'удиви');
  let pref = [], target = {}, mood = 'ассоциативный';
  const add = a => pref.push(...a);

  if (/бали|пляж|море|отпуск|закат|тропик/.test(q)) { add(['тропик','бали','пляж','отпуск','солнце']); mood = 'тропический'; }
  if (/ноч|город|неон|бар|клуб|тус/.test(q)) { add(['ночь','город','бар','коктейль','тёмный']); mood = 'вечерний'; }
  if (/свидан|поцел|роман|девушк|парн/.test(q)) { add(['свидание','романтика','мягкий','ягода']); mood = 'романтичный'; }
  if (/лес|дожд|зел|трав|природ/.test(q)) { add(['лес','дождь','зелёный','свежесть']); mood = 'зелёный и свежий'; }
  if (/десерт|слад|детств|конфет|выпеч|ванил/.test(q)) { add(['десерт','сладкий','ваниль','мягкий']); target.sw = 4; mood = 'десертный'; }
  if (/коктейл|дорог|премиум|люкс/.test(q)) { add(['коктейль','бар','цитрус','горчинка']); mood = 'коктейльный'; }
  if (/свеж|холод|лед|прохлад/.test(q)) { add(['свежий','холод']); target.fr = 4; mood = 'свежий'; }
  if (/кисл/.test(q)) { add(['кислый','цитрус']); target.so = 4; }
  if (/креп|плотн|жёстк|сильн/.test(q)) target.st = 4;
  if (/мяг|легк|спокойн|нович/.test(q)) target.st = 2;
  if (/удиви|стран|необыч|эксперимент|сюрприз/.test(q)) { add(['необычный','гастрономический','коктейль']); mood = 'экспериментальный'; }
  if (/мят|ментол/.test(q)) { add(['мятный','свежий','холод']); mood = 'мятный'; }
  if (/кофе|шоколад/.test(q)) { add(['кофе','десерт','тёмный']); mood = 'кофейный'; }
  if (/кориц|прян|восток/.test(q)) { add(['пряный','восток','тёмный']); mood = 'пряный'; }
  if (!pref.length) add(['коктейль','лето','ягода']);
  return {q, pref, target, mood};
}

/* ---------- 7. СКОРИНГ ---------- */
function score(f, intent) {
  const hay = [...f.cat, ...f.assoc, ...(f.realTags || []), f.note || '', f.use || '', f.ru, f.name, f.brand]
    .map(norm).join(' ');
  let s = 0;
  intent.pref.forEach(p => { if (hay.includes(norm(p))) s += 8; });
  Object.keys(intent.target).forEach(k => { s += 5 - Math.abs(f[k] - intent.target[k]); });
  if (f.role.includes('base')) s += 2;
  if (f.role.includes('accent')) s += 1;
  if (f.inStock) s += 10;
  return s;
}

/* ---------- 8. НАЗВАНИЕ МИКСА ---------- */
function title(q) {
  q = norm(q);
  if (/бали|отпуск|тропик/.test(q)) return ['🌴', 'Bali Mood'];
  if (/закат/.test(q)) return ['🌅', 'Закатный бриз'];
  if (/ноч|город/.test(q)) return ['🌃', 'Neon Night'];
  if (/свидан|поцел|роман/.test(q)) return ['💌', 'First Date'];
  if (/лес|дожд/.test(q)) return ['🌲', 'Лес после дождя'];
  if (/детств/.test(q)) return ['🍌', 'Вкус детства'];
  if (/десерт|слад/.test(q)) return ['🍰', 'Sweet Layer'];
  if (/коктейл|бар|дорог/.test(q)) return ['🍸', 'Signature Long'];
  if (/удиви|стран|необыч/.test(q)) return ['🧪', 'Weird but Good'];
  if (/мят|ментол/.test(q)) return ['🌿', 'Cold Mint'];
  if (/кофе|шоколад/.test(q)) return ['☕', 'Dark Roast'];
  if (/свеж|лёгк|легк|холод/.test(q)) return ['🧊', 'Ice Fresh'];
  return ['🔥', 'Ассоциация'];
}

/* ---------- 9. МАТЕМАТИКА МИКСА ---------- */
const avg = (ings, k) => Math.round(ings.reduce((a, i) => a + i.flavor[k] * i.p, 0) / 100);

function strength10(ings) {
  const raw = ings.reduce((a, i) => a + i.flavor.st * i.p, 0) / 100;
  return clamp(Math.round(raw * 2), 1, 10);
}

function requestedCount(q, intent) {
  q = norm(q);
  let m = q.match(/(?:на|из)?\s*([2-6])\s*(?:вкус|компон|табак)/);
  if (m) return parseInt(m[1], 10);
  if (/два вкуса|2 вкуса/.test(q)) return 2;
  if (/три вкуса|3 вкуса/.test(q)) return 3;
  if (/четыре вкуса|4 вкуса/.test(q)) return 4;
  if (/пять вкусов|5 вкусов/.test(q)) return 5;
  if (/шесть вкусов|6 вкусов/.test(q)) return 6;
  if (/сложн|многослой|богат|интерес/.test(q)) return 5;
  if (/удиви|стран|необыч/.test(q) || intent.mood === 'экспериментальный') return 5;
  if (/легк|мягк|прост|понятн|нович/.test(q)) return 2 + (hashText(q) % 2);
  return 3 + (hashText(q) % 3);
  return 3 + (hashText(q) % 3);
}

function makePercents(selected, intent, q) {
  const n = selected.length, h = hashText(q + intent.mood);
  let w = [];
  for (let i = 0; i < n; i++) {
    const f = selected[i];
    let v;
    if (i === 0) v = 42 + (h % 8);
    else if (i === 1) v = 24 + ((h >> 3) % 8);
    else if (f.role.includes('modifier')) v = 8 + ((h >> i) % 8);
    else v = 12 + ((h >> i) % 10);

    if (f.cat.includes('кислый') && intent.target.so !== 4) v -= 3;
    if ((f.cat.includes('холод') || f.cat.includes('свежий')) && intent.target.fr !== 4) v -= 3;
    if (f.cat.includes('гастрономический') && !/стран|удиви|эксперимент/.test(q)) v -= 4;
    w.push(Math.max(5, v));
  }
  const sum = w.reduce((a, b) => a + b, 0);
  let per = w.map(v => Math.round((v / sum * 100) / 5) * 5);
  per[0] += 100 - per.reduce((a, b) => a + b, 0);

  for (let i = 0; i < n; i++) {
    const f = selected[i];
    if ((f.role.includes('modifier') || f.cat.includes('кислый') || f.cat.includes('холод')) && per[i] > 20) {
      const extra = per[i] - 20;
      per[i] = 20;
      per[0] += extra;
    }
  }
  per[0] += 100 - per.reduce((a, b) => a + b, 0);
  return per;
}

/* ---------- 10. СБОРКА МИКСА ---------- */
function buildMix(q) {
  const intent = analyze(q);
  let pool = flavors.filter(f => f.inStock);
  if (pool.length < 2) pool = flavors;

  const ranked = pool.map(f => ({f, s: score(f, intent)})).sort((a, b) => b.s - a.s);
  const selected = [];
  const push = f => { if (f && !selected.find(x => x.id === f.id)) selected.push(f); };

  const targetCount = requestedCount(q, intent);
  push((ranked.find(x => x.f.role.includes('base')) || ranked[0]).f);
  push((ranked.find(x => x.f.role.includes('accent') && !selected.find(y => y.id === x.f.id)) || ranked[1] || ranked[0]).f);

  const wantsFresh = intent.target.fr >= 4 || /коктейл|ноч|тропик/.test(intent.pref.join(' '));
  if (wantsFresh) push((ranked.find(x => x.f.role.includes('modifier') && !selected.find(y => y.id === x.f.id)) || {}).f);
  else push((ranked.find(x => !selected.find(y => y.id === x.f.id) && !x.f.cat.includes('гастрономический')) || {}).f);

  if (intent.mood === 'экспериментальный') {
    push((ranked.find(x => !selected.find(y => y.id === x.f.id) &&
      (x.f.cat.includes('необычный') || x.f.cat.includes('цитрус') ||
       x.f.cat.includes('травяной') || x.f.cat.includes('пряный') || x.f.cat.includes('кофе'))) || {}).f);
  }

  for (const item of ranked) {
    if (selected.length >= targetCount) break;
    push(item.f);
  }
  const final = selected.slice(0, clamp(targetCount, 2, 6));
  const per = makePercents(final, intent, q);
  const ings = final.map((f, i) => ({flavor: f, p: per[i]}));
  return {ings, intent, q};
}

/* ---------- 11. РЕНДЕР РЕЗУЛЬТАТА ---------- */
function roleOf(p) { return p >= 35 ? 'база' : p >= 20 ? 'акцент' : 'модификатор'; }

function renderMix(ings, intent, q) {
  const [emoji, name] = title(q);
  const st = strength10(ings);
  const cats = [...new Set(ings.flatMap(i => i.flavor.cat))];
  const stockUsed = ings.every(i => i.flavor.inStock);

  const profile = `Получится ${cats.slice(0, 5).join(', ')} микс: ${intent.mood}, комфортный и без случайных сочетаний. В составе ${ings.length} ${ings.length === 2 ? 'вкуса' : 'вкусов/компонентов'}. Режим базы: только подтверждённое наличие Gelen.`;

  const why = ings.map((i, idx) => {
    if (idx === 0) return `${i.flavor.ru} держит основную базу`;
    if (idx === 1) return `${i.flavor.ru} раскрывает вкус и даёт объём`;
    if (idx === ings.length - 1) return `${i.flavor.ru} работает как финальный штрих`;
    return `${i.flavor.ru} добавляет слой вкуса`;
  }).join(', ') + '.';


  const infoHtml = ings.map(i => `
    <div class="flavorInfoItem">
      <b>${esc(i.flavor.ru)} · ${esc(i.flavor.brand)} · ${esc(i.flavor.name)}</b>
      <p>${esc(i.flavor.note)}</p>
      <p><span class="mini">Как использовать:</span> ${esc(i.flavor.use)}</p>
      <p><span class="mini">Роль в этом миксе:</span> ${i.p}% — ${roleOf(i.p)}.</p>
    </div>`).join('') +
    `<div class="sourceNote">Заметки собраны по открытым обзорам и вкусовому профилю брендов. Если гости Gelen Lounge описывают вкус иначе — базу можно быстро поправить под ваш реальный опыт.</div>`;

  $('result').innerHTML = `
    <div class="mixCard">
      <div class="mixTop">
        <div class="mixHead">
          <div class="mixEmoji">${emoji}</div>
          <div>
            <h2 class="mixTitle">${esc(name)}</h2>
            <div class="mixMeta">
              <span>Подбор по наличию</span>
              <span>·</span>
              <span>${ings.length} ${ings.length === 2 ? 'вкуса' : 'компонентов'}</span>
              <span class="tagline live">● всё в наличии</span>
            </div>
          </div>
        </div>
        <div class="ring">
          <svg viewBox="0 0 104 104">
            <defs>
              <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#7ce0b0"/>
                <stop offset="100%" stop-color="#ff9d61"/>
              </linearGradient>
            </defs>
            <circle class="track" cx="52" cy="52" r="45"></circle>
            <circle class="bar" id="ringBar" cx="52" cy="52" r="45"></circle>
          </svg>
          <div><b>${st}</b><span>крепость</span></div>
        </div>
      </div>

      <div class="meters">
        <div class="meter"><b>Сладость <i>${avg(ings, 'sw')}/5</i></b><div class="meterBar"><i data-w="${avg(ings,'sw')/5*100}"></i></div></div>
        <div class="meter"><b>Кислотность <i>${avg(ings, 'so')}/5</i></b><div class="meterBar"><i data-w="${avg(ings,'so')/5*100}"></i></div></div>
        <div class="meter"><b>Свежесть <i>${avg(ings, 'fr')}/5</i></b><div class="meterBar"><i data-w="${avg(ings,'fr')/5*100}"></i></div></div>
      </div>

      <div class="ingredients">
        ${ings.map((i, idx) => `
          <div class="ingredient" style="animation-delay:${idx * 80}ms">
            <div class="ingLine">
              <div class="num">${idx + 1}</div>
              <div>
                <strong>${esc(i.flavor.ru)}</strong>
                <span class="meta">${esc(i.flavor.brand)} · ${esc(i.flavor.name)} · в наличии Gelen</span>
              </div>
            </div>
            <div class="percentWrap">
              <div class="percent">${i.p}%</div>
              <div class="roleTag">${roleOf(i.p)}</div>
            </div>
            <div class="ingBar"><i data-w="${i.p}"></i></div>
          </div>`).join('')}
      </div>

      <div class="section">Профиль</div>
      <p class="text">${esc(profile)}</p>

      <div class="section">Почему подходит</div>
      <p class="text">${esc(why)} Под запрос «${esc(q)}» это звучит как ${esc(intent.mood)} образ — как раз под спокойный отдых в Gelen Lounge.</p>

      <button class="infoBtn" onclick="toggleFlavorInfo()">ℹ️ Инфо по вкусам в этом миксе</button>
      <div id="flavorInfo" class="flavorInfo">${infoHtml}</div>

      <div class="mixActions">
        <button class="miniBtn" onclick="submitMix()">🔁 Другой вариант</button>
        <button class="miniBtn" onclick="copyMix()">📋 Скопировать состав</button>
        <button class="miniBtn" onclick="shareMix()">🔗 Ссылка на микс</button>
      </div>

      <p class="notice">Кальян и табачные продукты не являются безопасными для здоровья. Только для 18+.</p>
    </div>`;

  lastMix = {ings, intent, q};
  requestAnimationFrame(() => {
    const ring = $('ringBar');
    if (ring) ring.style.strokeDashoffset = String(283 - 283 * (st / 10));
    document.querySelectorAll('#result .meterBar i, #result .ingBar i').forEach(el => {
      el.style.width = `${clamp(parseFloat(el.dataset.w), 0, 100)}%`;
    });
  });
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
}

function toggleFlavorInfo() {
  const el = $('flavorInfo');
  if (el) el.classList.toggle('open');
}

function copyMix() {
  if (!lastMix) return;
  const text = `Микс Gelen Lounge: ${title(lastMix.q)[1]}\n` +
    lastMix.ings.map(i => `• ${i.flavor.ru} (${i.flavor.brand}) — ${i.p}%  [в наличии]`).join('\n') +
    `\n\nКрепость: ${strength10(lastMix.ings)}/10`;
  navigator.clipboard?.writeText(text).then(
    () => toast('Состав скопирован ✓'),
    () => toast('Не удалось скопировать')
  );
}

/* Ссылка на микс — параметры в URL, чтобы открыть тот же состав */
function shareMix() {
  if (!lastMix) return;
  const params = new URLSearchParams({
    q: lastMix.q,
    f: lastMix.ings.map(i => `${i.flavor.id}:${i.p}`).join(',')
  });
  const url = `${location.origin}${location.pathname}?${params.toString()}`;
  if (navigator.share) {
    navigator.share({title: 'Микс Gelen Lounge', text: title(lastMix.q)[1], url}).catch(() => {});
  } else {
    navigator.clipboard?.writeText(url).then(
      () => toast('Ссылка на микс скопирована ✓'),
      () => toast('Не удалось скопировать ссылку')
    );
  }
}

/* Открытие микса из ссылки */
function loadFromUrl() {
  const p = new URLSearchParams(location.search);
  const q = p.get('q');
  const f = p.get('f');
  if (q) {
    $('query').value = q;
    updateCounter();
  }
  if (f) {
    const ings = f.split(',').map(pair => {
      const [id, pct] = pair.split(':');
      const flavor = flavors.find(x => x.id === id);
      return flavor ? {flavor, p: parseInt(pct, 10) || 0} : null;
    }).filter(Boolean);
    if (ings.length >= 2) {
      renderMix(ings, analyze(q || 'микс из ссылки'), q || 'микс из ссылки');
      toast('Микс открыт по ссылке ✓');
      return true;
    }
  }
  if (q) { submitMix(); return true; }
  return false;
}

function submitMix() {
  const q = $('query').value.trim() || 'удиви меня';
  const btn = document.querySelector('.primary');
  if (btn) { btn.style.transform = 'scale(.97)'; setTimeout(() => btn.style.transform = '', 140); }
  const {ings, intent} = buildMix(q);
  renderMix(ings, intent, q);
}

/* ---------- 13. АВТОРИЗАЦИЯ ---------- */
const maskPhone = p => {
  p = (p || '').trim();
  return p.length < 5 ? 'Гость' : `${p.slice(0, 3)} *** ${p.slice(-4)}`;
};

function initAuth() {
  let phone = null;
  try { phone = localStorage.getItem('gelen-user-phone'); } catch (e) {}
  const status = $('authStatus'), btn = $('authTopButton');
  if (phone) {
    status.innerHTML = `<span class="dot"></span>Гость: ${esc(maskPhone(phone))}`;
    btn.textContent = 'Профиль';
  } else {
    status.innerHTML = '<span class="dot"></span>Гость не зарегистрирован';
    btn.textContent = 'Регистрация';
  }
}

function openAuth() {
  const o = $('authOverlay');
  o.classList.add('open');
  $('authError').style.display = 'none';
  $('authSuccess').style.display = 'none';
  try {
    const saved = localStorage.getItem('gelen-user-phone');
    if (saved) $('phoneInput').value = saved;
  } catch (e) {}
}
function closeAuth() { $('authOverlay').classList.remove('open'); }

const validPhone = p => (p || '').replace(/\D/g, '').length >= 10;

function sendSmsCode() {
  const phone = $('phoneInput').value.trim();
  const err = $('authError'), ok = $('authSuccess'), demo = $('authDemoCode');
  err.style.display = 'none'; ok.style.display = 'none';
  if (!validPhone(phone)) {
    err.textContent = 'Проверь номер телефона: нужно минимум 10 цифр.';
    err.style.display = 'block';
    return;
  }
  const code = String(Math.floor(1000 + Math.random() * 9000));
  try {
    sessionStorage.setItem('gelen-sms-code', code);
    sessionStorage.setItem('gelen-sms-phone', phone);
  } catch (e) {}
  $('authOverlay').classList.add('codeSent');
  demo.innerHTML = `Демо-код для теста: <b>${code}</b><br>В реальном режиме здесь будет отправка настоящего SMS.`;
  demo.style.display = 'block';
  ok.textContent = 'Код подготовлен. Введи его ниже.';
  ok.style.display = 'block';
  $('codeInput').focus();
}

function verifySmsCode() {
  let code = null, phone = null;
  try {
    code = sessionStorage.getItem('gelen-sms-code');
    phone = sessionStorage.getItem('gelen-sms-phone');
  } catch (e) {}
  const input = $('codeInput').value.trim();
  const err = $('authError'), ok = $('authSuccess');
  err.style.display = 'none'; ok.style.display = 'none';
  if (!code || !phone) { err.textContent = 'Сначала запроси код.'; err.style.display = 'block'; return; }
  if (input !== code) { err.textContent = 'Код не совпал. Попробуй ещё раз.'; err.style.display = 'block'; return; }
  try {
    localStorage.setItem('gelen-user-phone', phone);
    localStorage.setItem('gelen-user-registered-at', new Date().toISOString());
    sessionStorage.removeItem('gelen-sms-code');
  } catch (e) {}
  ok.textContent = 'Готово, ты зарегистрирован как гость Gelen Lounge.';
  ok.style.display = 'block';
  initAuth();
  setTimeout(closeAuth, 900);
}

/* ---------- 14. АНИМАЦИИ ---------- */
/* Дым на канвасе */
function initSmoke() {
  const c = $('smoke');
  if (!c || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ctx = c.getContext('2d');
  let w, h, puffs = [];

  function resize() {
    w = c.width = innerWidth;
    h = c.height = innerHeight;
    const count = innerWidth < 700 ? 14 : 26;
    puffs = Array.from({length: count}, () => spawn(true));
  }
  function spawn(initial) {
    return {
      x: Math.random() * w,
      y: initial ? Math.random() * h : h + 80,
      r: 60 + Math.random() * 150,
      vx: (Math.random() - .5) * .28,
      vy: -.18 - Math.random() * .42,
      a: .015 + Math.random() * .035,
      hue: Math.random() > .55 ? 26 : 155,
      t: Math.random() * 100
    };
  }
  function frame() {
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < puffs.length; i++) {
      const p = puffs[i];
      p.t += .006;
      p.x += p.vx + Math.sin(p.t) * .32;
      p.y += p.vy;
      if (p.y + p.r < -60) puffs[i] = spawn(false);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
      g.addColorStop(0, `hsla(${p.hue},62%,58%,${p.a})`);
      g.addColorStop(1, 'hsla(0,0%,0%,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    requestAnimationFrame(frame);
  }
  addEventListener('resize', resize, {passive: true});
  resize();
  frame();
}

/* Всплеск искр при входе */
function burst() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;inset:0;z-index:115;pointer-events:none;overflow:hidden';
  document.body.appendChild(host);
  for (let i = 0; i < 22; i++) {
    const s = document.createElement('span');
    const angle = Math.random() * Math.PI * 2, dist = 120 + Math.random() * 320;
    s.style.cssText = `position:absolute;left:50%;top:52%;width:${5 + Math.random() * 7}px;height:${5 + Math.random() * 7}px;
      border-radius:50%;background:${Math.random() > .5 ? '#ff9d61' : '#7ce0b0'};opacity:.9;
      transition:transform 1.1s cubic-bezier(.22,1,.36,1), opacity 1.1s ease`;
    host.appendChild(s);
    requestAnimationFrame(() => {
      s.style.transform = `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist}px) scale(.2)`;
      s.style.opacity = '0';
    });
  }
  setTimeout(() => host.remove(), 1300);
}

/* Ревил при скролле */
function initReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('in')); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e, i) => {
      if (e.isIntersecting) {
        setTimeout(() => e.target.classList.add('in'), i * 90);
        io.unobserve(e.target);
      }
    });
  }, {threshold: .12, rootMargin: '0px 0px -40px'});
  els.forEach(el => io.observe(el));
}

/* Липкая навигация */
function initNav() {
  const nav = $('nav');
  const onScroll = () => nav.classList.toggle('shrink', scrollY > 30);
  addEventListener('scroll', onScroll, {passive: true});
  onScroll();
}

/* Бегущая строка брендов */
function initMarquee() {
  const track = $('marqueeTrack');
  if (!track) return;
  const list = BRANDS.map(b => `<span>${esc(b)}</span>`).join('');
  track.innerHTML = list + list;
}

/* Счётчики в hero */
function initCounters() {
  const targets = [[$('statFlavors'), flavors.length], [$('statBrands'), BRANDS.length], [$('statStock'), STOCK_COUNT]];
  targets.forEach(([el, val]) => {
    if (!el) return;
    let n = 0;
    const step = Math.max(1, Math.round(val / 34));
    const tick = () => {
      n = Math.min(val, n + step);
      el.textContent = n;
      if (n < val) requestAnimationFrame(tick);
    };
    setTimeout(tick, 260);
  });
}

/* Счётчик символов */
function initCounter() {
  const ta = $('query');
  ta.addEventListener('input', updateCounter);
  updateCounter();
}

/* Хоткеи */
function initKeys() {
  addEventListener('keydown', e => {
    if (e.key === 'Escape') closeAuth();
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submitMix();
  });
}

/* ---------- 15. СТАРТ ---------- */
function boot() {
  setAvailability(availability);
  initAuth();
  initSmoke();
  initReveal();
  initNav();
  initMarquee();
  initCounters();
  initCounter();
  initKeys();
  loadFromUrl();
  document.body.classList.add('siteLoaded');
  console.log(`Gelen Lounge · база ${flavors.length} вкусов / ${BRANDS.length} брендов / ${STOCK_COUNT} в наличии`);
}

if (document.readyState === 'loading') addEventListener('DOMContentLoaded', boot);
else boot();

addEventListener('error', e => console.warn('Gelen site error:', e.message));
