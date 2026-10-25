// Проверка страницы целиком: скрипт исполняется в заглушке DOM и рисует рецепт.
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'pizza.html'), 'utf8');
// В странице несколько скриптов (в <head> — перехват приглашения к установке),
// берём главный: тот, где объявлены поля калькулятора.
const parts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const script = parts.find(s => s.includes('/*CALC-START*/')) || parts[0];

let fails = 0;
function ok(name, cond, extra) {
  if (!cond) fails++;
  console.log((cond ? 'OK  ' : 'FAIL') + '  ' + name + (extra ? ' — ' + extra : ''));
}
function has(name, haystack, needle) {
  ok(name, haystack.indexOf(needle) !== -1, needle);
}
function noJunk(name, text) {
  const bad = ['NaN', 'undefined', 'Infinity'].filter(w => text.indexOf(w) !== -1);
  let where = '';
  if (bad.length) {
    const i = text.indexOf(bad[0]);
    where = ' …' + text.slice(Math.max(0, i - 70), i + 40).replace(/\s+/g, ' ') + '…';
  }
  ok(name, bad.length === 0, bad.join(', ') + where);
}

/* ---------- заглушка DOM ---------- */
const els = {};
const listeners = {};

function El(id) {
  this.id = id;
  this.value = '';
  this.checked = false;
  this.disabled = false;
  this.hidden = false;
  this.type = 'text';
  this.textContent = '';
  this.style = {};
  this._html = '';
  this._l = {};
  this.attrs = {};
}
El.prototype.addEventListener = function (t, f) { (this._l[t] = this._l[t] || []).push(f); };
El.prototype.dispatch = function (t, ev) {
  (this._l[t] || []).forEach(f => f(Object.assign({ target: this, preventDefault() {} }, ev || {})));
};
El.prototype.closest = function () { return null; };
El.prototype.scrollIntoView = function () {};
El.prototype.getAttribute = function (k) { return this.attrs[k]; };
El.prototype.setAttribute = function (k, v) { this.attrs[k] = v; };
El.prototype.querySelectorAll = function () { return []; };
Object.defineProperty(El.prototype, 'innerHTML', {
  get() { return this._html; },
  set(v) { this._html = String(v); registerInputs(this._html); }
});

function getEl(id) {
  if (!els[id]) els[id] = new El(id);
  return els[id];
}

/* поля, созданные через innerHTML, тоже должны стать элементами */
function registerInputs(markup) {
  const re = /<input id="([a-zA-Z]+)"([^>]*)>/g;
  let m;
  while ((m = re.exec(markup))) {
    const e = getEl(m[1]);
    const attrs = m[2];
    const v = attrs.match(/value="([^"]*)"/);
    if (v) e.value = v[1];
    e.type = /type="checkbox"/.test(attrs) ? 'checkbox' : 'number';
    if (/checked/.test(attrs)) e.checked = true;
  }
}

/* начальные значения статических полей берём прямо из pizza.html */
const selects = {};
const selRe = /<select id="([a-zA-Z]+)">([\s\S]*?)<\/select>/g;
let sm;
while ((sm = selRe.exec(html))) {
  const first = sm[2].match(/value="([^"]+)"/);
  selects[sm[1]] = first ? first[1] : '';
}
const inpRe = /<input id="([a-zA-Z]+)"([^>]*)>/g;
let im;
while ((im = inpRe.exec(html))) {
  const id = im[1], attrs = im[2];
  const e = getEl(id);
  const v = attrs.match(/value="([^"]*)"/);
  if (v) e.value = v[1];
  e.type = /type="checkbox"/.test(attrs) ? 'checkbox' : 'text';
  if (/checked/.test(attrs)) e.checked = true;
}
Object.keys(selects).forEach(id => { getEl(id).value = selects[id]; });

const store = {};
const document = {
  getElementById: getEl,
  addEventListener(t, f) { (listeners[t] = listeners[t] || []).push(f); },
  querySelectorAll() { return []; },
  createElement() { return new El('_tmp'); },
  execCommand() { return false; },
  body: { appendChild() {}, removeChild() {} },
  documentElement: { style: {}, scrollWidth: 420, className: '' }
};

const window = {
  addEventListener(t, f) { (listeners['w:' + t] = listeners['w:' + t] || []).push(f); },
  innerWidth: 420,
  print() { window._printed = true; }
};

const ctx = vm.createContext({
  document,
  window,
  navigator: {},
  location: { protocol: 'file:', hostname: '', search: '', href: 'file:///pizza.html' },
  localStorage: {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  },
  setTimeout: () => 0,
  console
});
ctx.self = ctx.window;

try {
  vm.runInContext(script, ctx, { filename: 'pizza-inline.js' });
} catch (e) {
  console.error('FAIL: скрипт упал —', e && e.message);
  console.error(e && e.stack);
  process.exit(1);
}
console.log('OK  скрипт выполнился без ошибок\n');

/* ---------- что нарисовалось ---------- */
const all = () => ['bigNumber', 'stats', 'recipeTables', 'waterBox', 'bakeBox', 'plan', 'alerts']
  .map(id => getEl(id).innerHTML).join('\n');

let text = all();
console.log('-- стартовый экран (6 пицц по 250 г, 24 ч при 20 °C) --');
has('итог теста в крупной цифре', getEl('bigNumber').innerHTML, '1');
has('итог содержит 1 500', getEl('bigNumber').innerHTML.replace(/\u00A0/g, ' '), '1 500 г');
has('в подписи — 6 пицц по 250 г', getEl('bigNumber').innerHTML, '250');
has('статистика: мука', getEl('stats').innerHTML, 'мука');
has('статистика: 910 г муки', getEl('stats').innerHTML, '910');
has('статистика: диаметр', getEl('stats').innerHTML, '30 см');
has('таблица: строка муки', getEl('recipeTables').innerHTML, 'Мука 00');
has('таблица: итого теста', getEl('recipeTables').innerHTML, 'Итого теста');
has('таблица: дрожжи с десятой', getEl('recipeTables').innerHTML, '1,4');
has('таблица: контроль', getEl('recipeTables').innerHTML, 'Гидратация');
has('вода: 25 °C', getEl('waterBox').innerHTML, '25 °C');
has('вода: формула', getEl('waterBox').innerHTML, 'трение');
has('пересчёт дрожжей', getEl('waterBox').innerHTML, 'Сухие быстродействующие');
has('выпечка: дровяная', getEl('bakeBox').innerHTML, 'Дровяная');
has('выпечка: 60–90 с', getEl('bakeBox').innerHTML, '60–90 с');
has('план: замес', getEl('plan').innerHTML, 'Замес');
has('план: пунтата', getEl('plan').innerHTML, 'Пунтата');
has('план: аппрето', getEl('plan').innerHTML, 'Аппрето');
has('план: выпечка', getEl('plan').innerHTML, 'Выпечка');
has('план: начало 09:00', getEl('plan').innerHTML, '09:00');
has('план: завтрашнее время помечено', getEl('plan').innerHTML, 'дн.');
const norm = s => String(s).replace(/\u00A0/g, ' ');
has('липкая строка показывает вес', norm(getEl('sbVal').textContent), '1 500 г');
has('есть спокойная сводка', getEl('alerts').innerHTML, 'class="ok"');
ok('в норме нет предупреждений', getEl('alerts').innerHTML.indexOf('class="warn"') === -1,
  getEl('alerts').innerHTML);
ok('нет ошибок в разметке', getEl('alerts').innerHTML.indexOf('err') === -1);
noJunk('нет NaN/undefined на старте', text);
ok('state сохранён в localStorage', !!store['pizza-calc-v1']);
ok('в состоянии есть режим', JSON.parse(store['pizza-calc-v1']).mode === 'pizzas');

/* ---------- дрожжи подобраны автоматически ---------- */
console.log('\n-- дрожжи --');
ok('поле дрожжей заблокировано (автоподбор)', getEl('yeastPct').disabled === true);
ok('в поле подставлено 0.15', Math.abs(parseFloat(getEl('yeastPct').value) - 0.15) < 0.001,
  getEl('yeastPct').value);
has('подсказка объясняет подбор', getEl('yeastHint').textContent, 'подобрано');

/* ---------- смена режима брожения ---------- */
console.log('\n-- переключение на холодильник --');
getEl('ferment').value = 'cold';
listeners.change.forEach(f => f({ target: { id: 'ferment' } }));
ok('появилось поле часов в холодильнике', !!els.coldHours);
ok('появилось поле температуры холодильника', !!els.fridgeTemp);
ok('появилось поле согревания', !!els.warmHours);
text = all();
has('план: шаг в холодильник', getEl('plan').innerHTML, 'В холодильник');
has('план: согревание', getEl('plan').innerHTML, 'согреться');
has('итог пересчитан', norm(getEl('sbVal').textContent), '1 500 г');
noJunk('нет NaN после переключения', text);

/* ---------- пресет ---------- */
console.log('\n-- пресеты --');
ok('кнопки пресетов нарисованы', getEl('presets').innerHTML.split('<button').length - 1 === 5);
const fakePresets = els.presets;
fakePresets.dispatch('click', { target: { closest: () => ({ getAttribute: () => '3' }) } });
has('пресет 72 ч: план длиннее', getEl('plan').innerHTML, 'дн.');
ok('пресет применил гидратацию 63 %', Math.abs(parseFloat(getEl('hydration').value) - 63) < 0.001,
  getEl('hydration').value);
ok('пресет поставил 72 часа', parseFloat(getEl('coldHours').value) === 72, getEl('coldHours').value);

/* ---------- режим "по муке" ---------- */
console.log('\n-- по муке --');
getEl('mode').value = 'flour';
listeners.change.forEach(f => f({ target: { id: 'mode' } }));
ok('появилось поле муки', !!els.flourWeight);
ok('мука 1 000', parseFloat(getEl('flourWeight').value) === 1000, getEl('flourWeight').value);
const bigFlour = parseInt(norm(getEl('bigNumber').innerHTML).replace(/\s/g, ''), 10);
ok('итог из 1 кг муки — около 1 660 г', bigFlour > 1600 && bigFlour < 1700, bigFlour + ' г');
noJunk('нет NaN в режиме по муке', all());

/* ---------- мусор в поле ---------- */
console.log('\n-- мусор в полях --');
getEl('salt').value = 'abc';
listeners.input.forEach(f => f({ target: { id: 'salt' } }));
noJunk('слово вместо соли не ломает вывод', all());
getEl('salt').value = '';
listeners.change.forEach(f => f({ target: { id: 'salt' } }));
noJunk('пустая соль не ломает вывод', all());
getEl('flourWeight').value = '0';
listeners.change.forEach(f => f({ target: { id: 'flourWeight' } }));
has('ноль муки — понятная ошибка', getEl('alerts').innerHTML, 'больше нуля');
noJunk('ноль муки не рождает NaN', all());

/* ---------- печать ---------- */
console.log('\n-- кнопки --');
getEl('printBtn').dispatch('click');
ok('кнопка печати вызвала window.print', window._printed === true);
ok('кнопка копирования подключена', (getEl('copyBtn')._l.click || []).length === 1);
ok('кнопка перехода к рецепту подключена', (getEl('sbJump')._l.click || []).length === 1);

/* ---------- CSS-обещания ---------- */
console.log('\n-- стили --');
ok('поля не мельче 16px (без зума на iPhone)',
  /input\[type=number\][^{]*\{[^}]*font-size:16px/.test(html) || /font-size:16px/.test(html));
ok('горизонтальная прокрутка выключена', /html,body\{overflow-x:hidden\}/.test(html));
ok('блоки вывода прокручиваются внутри себя', /#recipeTables,#waterBox,#bakeBox,#plan\{overflow-x:auto\}/.test(html));
ok('переносы в примечаниях разрешены', /td\.note,th\.note\{white-space:normal/.test(html));
ok('есть мобильный медиазапрос', /@media \(max-width:880px\)/.test(html));
const printBlock = (html.match(/@media print\{[\s\S]*?\n\}/) || [''])[0];
ok('липкая строка не печатается', /#stickyBar/.test(printBlock) && /display:none/.test(printBlock));
ok('на печати остаётся только рецепт', /section\.input/.test(printBlock), 'панель ввода скрыта');
ok('на печати светлая тема', /--bg:#fff/.test(printBlock));
ok('в Telegram одна колонка', /html\.tg \.grid\{grid-template-columns:1fr\}/.test(html));

/* Регрессия: в режиме «холодильник» таблица «Контроль» тянула колонку на 456 px
   и страница вылезала за экран телефона. Держим три вещи, которые это лечат. */
console.log('\n-- ширина на телефоне --');
ok('панели не раздуваются содержимым', /\.grid > \*\{min-width:0\}/.test(html));
ok('панель тоже с min-width:0', /\.panel\{[^}]*min-width:0/.test(html));
ok('фраза в таблице переносится', /\.tbl td\.val\{[^}]*white-space:normal/.test(html));
ok('строка «Брожение» помечена как val, а не num',
  /class="val"><b>' \+ fermentText/.test(html));
ok('на узком экране план становится списком', /@media \(max-width:620px\)/.test(html) && /\.tbl\.plan\{display:block\}/.test(html));

/* ---------- установка на экран ---------- */
console.log('\n-- установка --');
ok('в шапке есть кнопка установки', /id="installBtn"/.test(html));
ok('есть блок с инструкцией', /id="installHint"/.test(html));
ok('приглашение к установке ловим в <head>', /beforeinstallprompt/.test(html) && /__installEvent/.test(html));
ok('событие appinstalled тоже', /appinstalled/.test(html) && /__installDone/.test(html));
ok('функция installSetup объявлена', /function installSetup\(\)/.test(script));
ok('installSetup вызывается на старте', /installSetup\(\)\s*;/.test(script));
ok('режим приложения распознаётся', /display-mode: standalone/.test(script) && /navigator\.standalone/.test(script));
ok('инструкция для iPhone', /На экран „Домой“/.test(script));
ok('инструкция для встроенного браузера', /Открыть в Safari|Открыть в Chrome/.test(script));
ok('на печати инструкция скрыта', /\.install[,{]/.test(printBlock) && /display:none/.test(printBlock));
ok('кнопка показана в обычном браузере',
  getEl('installBtn').hidden === false && getEl('installBtn').textContent === 'Установить',
  getEl('installBtn').textContent);
ok('инструкция по умолчанию скрыта', /id="installHint"[^>]*hidden/.test(html),
  'в разметке стоит атрибут hidden');

/* ---------- итог ---------- */
console.log(fails === 0 ? '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ' : `\nПРОВАЛЕНО ПРОВЕРОК: ${fails}`);
process.exit(fails === 0 ? 0 : 1);
