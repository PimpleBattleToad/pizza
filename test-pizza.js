// Проверка расчётного ядра pizza.html
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const file = path.join(__dirname, 'pizza.html');
const html = fs.readFileSync(file, 'utf8');

const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) { console.error('FAIL: <script> не найден'); process.exit(1); }
const fullScript = scriptMatch[1];

// 1. Синтаксис всего скрипта
try { new vm.Script(fullScript, { filename: 'pizza-inline.js' }); }
catch (e) { console.error('FAIL: синтаксическая ошибка в скрипте —', e.message); process.exit(1); }
console.log('OK  синтаксис скрипта');

// 2. Ядро расчёта
const core = fullScript.match(/\/\*CALC-START\*\/([\s\S]*?)\/\*CALC-END\*\//);
if (!core) { console.error('FAIL: маркеры CALC не найдены'); process.exit(1); }
const ctx = vm.createContext({});
vm.runInContext(core[1] + '\n;this.computeRecipe=computeRecipe;this.roundRecipe=roundRecipe;' +
  'this.buildPlan=buildPlan;this.waterTemp=waterTemp;this.tempFactor=tempFactor;' +
  'this.fermentLoad=fermentLoad;this.recommendedYeastPct=recommendedYeastPct;' +
  'this.ballDiameter=ballDiameter;this.bulkHours=bulkHours;this.num=num;', ctx);

let fails = 0;
function near(name, got, want, tol) {
  tol = tol === undefined ? 0.01 : tol;
  const okv = Math.abs(got - want) <= tol;
  if (!okv) fails++;
  console.log((okv ? 'OK  ' : 'FAIL') + '  ' + name + ': ' + got + (okv ? '' : ' — ожидалось ' + want));
}
function ok(name, cond, extra) {
  if (!cond) fails++;
  console.log((cond ? 'OK  ' : 'FAIL') + '  ' + name + (cond ? (extra ? ' — ' + extra : '') : ' — ' + (extra || '')));
}

const base = {
  mode: 'pizzas', pizzas: 6, ballWeight: 250,
  doughWeight: 1500, flourWeight: 1000,
  hydration: 62, salt: 2.8,
  ferment: 'rt', rtHours: 24, roomTemp: 20,
  coldHours: 48, warmHours: 4, fridgeTemp: 5,
  autoYeast: true, yeastType: 'fresh', yeastPct: 0.15,
  ddt: 23, flourTemp: 21, friction: 3, start: '09:00'
};

// ---------- физика дрожжей ----------
console.log('\n-- модель брожения --');
near('активность при 20 °C', ctx.tempFactor(20), 1);
near('активность при 30 °C (вдвое быстрее)', ctx.tempFactor(30), 2);
near('активность при 10 °C (вдвое медленнее)', ctx.tempFactor(10), 0.5);
near('активность при 5 °C', ctx.tempFactor(5), Math.pow(2, -1.5));
near('дрожжи на 24 ч при 20 °C, %', ctx.recommendedYeastPct(24), 0.15, 0.005);
near('дрожжи на 8 ч при 20 °C, %', ctx.recommendedYeastPct(8), 0.45, 0.01);
near('дрожжи на 72 ч при 5 °C, %', ctx.recommendedYeastPct(72 * Math.pow(2, -1.5)), 0.141, 0.005);
ok('дрожжей не больше 1,2 %', ctx.recommendedYeastPct(0.5) <= 1.2);
ok('дрожжей не меньше 0,02 %', ctx.recommendedYeastPct(100000) >= 0.02);

near('нагрузка 24 ч при 20 °C', ctx.fermentLoad(base), 24);
near('пунтата на 24 ч', ctx.bulkHours(base), 2);
near('пунтата на 8 ч', ctx.bulkHours({ ferment: 'rt', rtHours: 8 }), 1);
near('нагрузка: 48 ч при 5 °C + 4 ч согрева + 1 ч пунтаты',
  ctx.fermentLoad({ ferment: 'cold', coldHours: 48, fridgeTemp: 5, warmHours: 4, roomTemp: 20 }),
  48 * Math.pow(2, -1.5) + 5);

// ---------- температура воды ----------
near('температура воды (23/21/20/3)', ctx.waterTemp(23, 21, 20, 3), 25);
near('температура воды (24/21/23/5)', ctx.waterTemp(24, 21, 23, 5), 23);

// ---------- диаметр ----------
near('диаметр шара 250 г', ctx.ballDiameter(250), 30);
near('диаметр шара 1000 г', ctx.ballDiameter(1000), 60);
near('диаметр шара 220 г', ctx.ballDiameter(220), 28, 0.5);

// ---------- рецепт: число пицц ----------
console.log('\n-- рецепт --');
let r = ctx.computeRecipe(base);
const factor = 1 + 0.62 + 0.028 + 0.0015;
near('мука для 6x250 г', r.flour, 1500 / factor, 0.01);
near('вода', r.water, r.flour * 0.62, 0.01);
near('соль', r.salt, r.flour * 0.028, 0.01);
near('дрожжи', r.yeast, r.flour * 0.0015, 0.005);
near('всего теста', r.totalDough, 1500, 0.01);
near('пицц', r.balls, 6);
near('вес шара', r.ballWeight, 250);
near('диаметр', r.ballDiameter, 30);
near('дрожжи подобраны, %', r.yeastPct, 0.15, 0.005);
ok('флаг автоподбора дрожжей', r.autoYeast === true);

// режим "по весу теста"
r = ctx.computeRecipe(Object.assign({}, base, { mode: 'dough', doughWeight: 1500 }));
near('мука из 1500 г теста', r.flour, 1500 / factor, 0.01);
near('вес теста 1500', r.totalDough, 1500, 0.01);
near('шаров по 250 г', r.balls, 6);

// режим "по муке"
r = ctx.computeRecipe(Object.assign({}, base, { mode: 'flour', flourWeight: 1000 }));
near('мука ровно 1000', r.flour, 1000, 0);
near('тесто из 1 кг муки', r.totalDough, 1000 * factor, 0.01);
near('шаров из 1 кг муки', r.balls, Math.round(1649.5 / 250));

// ручные дрожжи
r = ctx.computeRecipe(Object.assign({}, base, { autoYeast: false, yeastPct: 1 }));
near('дрожжи вручную 1 %', r.yeast, r.flour * 0.01, 0.01);
near('процент дрожжей взят из поля', r.yeastPct, 1);

// холодный режим
r = ctx.computeRecipe(Object.assign({}, base, { ferment: 'cold', coldHours: 48, warmHours: 4 }));
near('холод: нагрузка', r.load, 48 * Math.pow(2, -1.5) + 5);
near('холод: пунтата 1 ч', r.bulkHours, 1);
ok('48 ч в холоде медленнее, чем 24 ч в тепле', r.load < 24,
  'нагрузка ' + r.load.toFixed(1) + ' ч-экв, дрожжей ' + r.yeastPct.toFixed(3) + ' %');

// сухие дрожжи
r = ctx.computeRecipe(Object.assign({}, base, { yeastType: 'instant', autoYeast: false, yeastPct: 0.05 }));
near('сухие: множитель пересчёта', r.yeastFactor, 3);
ok('сухие: подпись', /сухие/.test(r.yeastShortLabel), r.yeastShortLabel);

// мусор
ok('нулевое число пицц — null', ctx.computeRecipe(Object.assign({}, base, { pizzas: 0 })) === null);
ok('нулевая мука — null', ctx.computeRecipe(Object.assign({}, base, { mode: 'flour', flourWeight: 0 })) === null);
ok('гидратация 0 — null', ctx.computeRecipe(Object.assign({}, base, { hydration: 0 })) === null);
ok('неизвестный режим — null', ctx.computeRecipe(Object.assign({}, base, { mode: 'xxx' })) === null);
ok('нет состояния — null', ctx.computeRecipe(null) === null);

// ---------- целые граммы ----------
console.log('\n-- целые граммы --');
function checkRounded(name, s, target) {
  const raw = ctx.computeRecipe(s);
  const o = ctx.roundRecipe(raw, raw ? raw.target : null);
  if (!o) { fails++; console.log('FAIL  ' + name + ': расчёт вернул null'); return null; }
  const bad = ['flour', 'water', 'salt'].filter(f => !Number.isInteger(o[f]));
  if (bad.length) { fails++; console.log('FAIL  ' + name + ': не целые — ' + bad.join(', ')); }
  const sum = o.flour + o.water + o.salt + o.yeast;
  if (Math.abs(sum - o.totalDough) > 1e-9) { fails++; console.log('FAIL  ' + name + ': сумма не равна итогу'); }
  if (target !== null && Math.abs(o.totalDough - target) > 1.2) {
    fails++; console.log('FAIL  ' + name + ': итог ' + o.totalDough + ' не равен цели ' + target);
  }
  if (Math.abs(Math.round(o.yeast * 10) / 10 - o.yeast) > 1e-9) {
    fails++; console.log('FAIL  ' + name + ': дрожжи мельче 0,1 г');
  }
  if (bad.length === 0 && (target === null || Math.abs(o.totalDough - target) <= 1.2)) {
    console.log('OK    ' + name + ': ' + o.flour + ' + ' + o.water + ' + ' + o.salt + ' + ' +
      o.yeast.toFixed(1) + ' = ' + o.totalDough.toFixed(1) + ' г');
  }
  return o;
}

let o = checkRounded('6 x 250 г', base, 1500);
ok('шаров ровно 6', o.balls === 6);
near('деление шара', o.totalDough / o.balls, 250, 0.2);
checkRounded('10 x 280 г', Object.assign({}, base, { pizzas: 10, ballWeight: 280 }), 2800);
checkRounded('2 x 250 г, 8 ч, 21 °C', Object.assign({}, base, { pizzas: 2, rtHours: 8, roomTemp: 21 }), 500);
checkRounded('4 x 250 г, холод 48 ч', Object.assign({}, base, { pizzas: 4, ferment: 'cold' }), 1000);
checkRounded('1 x 180 г (мелкая партия)', Object.assign({}, base, { pizzas: 1, ballWeight: 180 }), 180);
checkRounded('гидратация 58 %', Object.assign({}, base, { hydration: 58 }), 1500);
checkRounded('гидратация 68 %, соль 3,5 %', Object.assign({}, base, { hydration: 68, salt: 3.5 }), 1500);
checkRounded('12 x 250 г', Object.assign({}, base, { pizzas: 12 }), 3000);
checkRounded('по весу теста 1234 г', Object.assign({}, base, { mode: 'dough', doughWeight: 1234, ballWeight: 250 }), 1234);

// по муке: цель не задана, но мука должна остаться ровной
const rr = ctx.roundRecipe(ctx.computeRecipe(Object.assign({}, base, { mode: 'flour', flourWeight: 500 })), null);
ok('по муке 500 г: мука осталась 500', rr.flour === 500, 'получено ' + rr.flour);
ok('по муке 500 г: сумма сходится',
  Math.abs((rr.flour + rr.water + rr.salt + rr.yeast) - rr.totalDough) < 1e-9);

// масса прочего не «уползла» больше чем на процент
o = checkRounded('6 x 250 г (контроль)', base, 1500);
near('гидратация после округления (62 ± 0,7 %)', o.water / o.flour * 100, 62, 0.7);
near('соль после округления (2,8 ± 0,1 %)', o.salt / o.flour * 100, 2.8, 0.1);

// ---------- план ----------
console.log('\n-- план --');
let plan = ctx.buildPlan(base, o);
ok('план построен', !!plan);
near('шаг 1 — с нулевой минуты', plan.steps[0].at, 0);
ok('шаг 1 — замес', /Замес/.test(plan.steps[0].title), plan.steps[0].title);
near('в плане 5 шагов (тёплый режим)', plan.steps.length, 5);
near('выпечка после пунтаты 2 ч и аппрето 22 ч', plan.bakeAt, 25 + 120 + 20 + 22 * 60);
near('шаг выпечки на своей минуте', plan.steps[4].at, plan.bakeAt);
near('общая длительность', plan.totalMinutes, plan.bakeAt + Math.max(12, 6 * 3));
near('печь включается за 50 минут', plan.preheatAt, plan.bakeAt - 50);
ok('в плане есть текст про печь', /430/.test(plan.steps[4].text));

plan = ctx.buildPlan(Object.assign({}, base, { ferment: 'cold', coldHours: 48, warmHours: 4 }), o);
near('в плане 6 шагов (холодильник)', plan.steps.length, 6);
ok('есть шаг «В холодильник»', /холодильник/i.test(plan.steps[3].title), plan.steps[3].title);
ok('есть шаг «согреться»', /согреться/i.test(plan.steps[4].title), plan.steps[4].title);
near('общая длительность в холоде', plan.totalMinutes, 25 + 60 + 20 + 48 * 60 + 4 * 60 + 18);

// ---------- структура страницы ----------
console.log('\n-- страница --');
const idsMatch = fullScript.match(/var ids = \[([\s\S]*?)\];/);
const ids = idsMatch[1].match(/'([a-zA-Z]+)'/g).map(s => s.replace(/'/g, ''));
const dynamic = ['pizzas', 'ballWeight', 'doughWeight', 'flourWeight',
  'rtHours', 'coldHours', 'warmHours', 'roomTemp', 'fridgeTemp'];
const missing = ids.filter(id => !html.includes('id="' + id + '"') && !dynamic.includes(id));
ok('все статические поля есть в html', missing.length === 0, missing.join(', '));

for (const tag of ['html', 'head', 'body', 'script', 'style', 'section', 'table', 'div']) {
  const open = (html.match(new RegExp('<' + tag + '[\\s>]', 'g')) || []).length;
  const close = (html.match(new RegExp('</' + tag + '>', 'g')) || []).length;
  if (open !== close) { fails++; console.log(`FAIL  <${tag}>: открыто ${open}, закрыто ${close}`); }
}
console.log('OK   баланс основных тегов проверен');

console.log(fails === 0 ? '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ' : `\nПРОВАЛЕНО ПРОВЕРОК: ${fails}`);
process.exit(fails === 0 ? 0 : 1);
