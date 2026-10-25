/* Проверки «как приложение»: манифест, service worker, иконки, статический сервер.
   Запуск:  node test-pwa.js
   Ничего не устанавливает и не требует интернета: сервер поднимается на 127.0.0.1. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const http = require('http');
const { spawn } = require('child_process');

const ROOT = __dirname;
let fails = 0;

function ok(name, cond, extra) {
  if (cond) {
    console.log('OK    ' + name + (extra ? ' — ' + extra : ''));
  } else {
    fails++;
    console.log('FAIL  ' + name + (extra ? ' — ' + extra : ''));
  }
}

function read(name) {
  return fs.readFileSync(path.join(ROOT, name), 'utf8');
}

/* Имена файлов проверяем по реальному списку папки: на Linux и на GitHub Pages
   регистр важен, а Windows молча прощает pizza.HTML вместо pizza.html. */
function existsExact(rel) {
  const parts = rel.split('/');
  let dir = ROOT;
  for (let i = 0; i < parts.length; i++) {
    let list;
    try {
      list = fs.readdirSync(dir);
    } catch (e) {
      return false;
    }
    if (list.indexOf(parts[i]) === -1) return false;
    dir = path.join(dir, parts[i]);
  }
  return fs.statSync(dir).isFile();
}

console.log('-- файлы --');
['pizza.html', 'index.html', 'manifest.json', 'sw.js', 'serve-lan.js', 'README.md',
 'tools/make-icons.py', 'icons/icon-192.png', 'icons/icon-512.png',
 'icons/icon-180.png', 'icons/maskable-512.png'].forEach(function (f) {
  ok('есть ' + f, existsExact(f));
});

console.log('\n-- манифест --');
let man = null;
try {
  man = JSON.parse(read('manifest.json'));
  ok('manifest.json — валидный JSON', true);
} catch (e) {
  ok('manifest.json — валидный JSON', false, e.message);
}

if (man) {
  ok('имя приложения', !!man.name, man.name);
  ok('короткое имя не длиннее 12 знаков', man.short_name && man.short_name.length <= 12, man.short_name);
  ok('есть описание', !!man.description);
  ok('язык русский', man.lang === 'ru');
  ok('start_url указывает на pizza.html', man.start_url === './pizza.html', man.start_url);
  ok('scope — текущая папка', man.scope === './', man.scope);
  ok('режим standalone', man.display === 'standalone', man.display);
  ok('фон тёмный, как у страницы', man.background_color === '#141110', man.background_color);
  ok('цвет темы тёмный', man.theme_color === '#141110', man.theme_color);
  const icons = man.icons || [];
  ok('иконок три', icons.length === 3, icons.length);
  icons.forEach(function (ic) {
    ok('иконка на месте: ' + ic.src, existsExact(ic.src.replace(/^\.\//, '')));
  });
  ok('есть maskable-иконка', icons.some(function (ic) { return ic.purpose === 'maskable'; }));
  ok('иконка 512 заявлена как 512', icons.some(function (ic) { return ic.sizes === '512x512'; }));
}

console.log('\n-- страница --');
const html = read('pizza.html');
ok('подключён манифест', /<link[^>]+rel="manifest"[^>]+href="\.\/manifest\.json"/.test(html));
ok('есть theme-color', /<meta[^>]+name="theme-color"[^>]+content="#141110"/.test(html));
ok('есть apple-touch-icon', /apple-touch-icon[^>]+href="\.\/icons\/icon-180\.png"/.test(html));
ok('страница помечена как веб-приложение',
  /apple-mobile-web-app-capable"\s+content="yes"/.test(html));
ok('статус-бар в тёмном стиле', /apple-mobile-web-app-status-bar-style"\s+content="black-translucent"/.test(html));
ok('заголовок не пустой', /<title>[^<]{10,}<\/title>/.test(html));
ok('описание для поиска', /<meta[^>]+name="description"[^>]+content="[^"]{40,}"/.test(html));
ok('язык страницы русский', /<html[^>]+lang="ru"/.test(html));
ok('масштабирование не ломает поля',
  /<meta[^>]+name="viewport"[^>]+content="[^"]*width=device-width/.test(html));
ok('service worker регистрируется',
  /serviceWorker\.register\('\.\/sw\.js'\)/.test(html));
ok('регистрация только на https и локальном адресе',
  /https:|localhost|127\.0\.0\.1/.test(html) && /location\.protocol/.test(html));

console.log('\n-- service worker --');
let sw = '';
try {
  sw = read('sw.js');
  new vm.Script(sw, { filename: 'sw.js' });
  ok('sw.js — синтаксически корректный скрипт', true);
} catch (e) {
  ok('sw.js — синтаксически корректный скрипт', false, e.message);
}

const cacheName = (sw.match(/CACHE\s*=\s*'([^']+)'/) || [])[1];
ok('есть имя кэша', !!cacheName, cacheName);
ok('кэш назван по приложению', /^pizza-/.test(cacheName || ''), cacheName);
ok('есть список файлов для офлайна', /ASSETS\s*=\s*\[/.test(sw));

const assetsBlock = (sw.match(/ASSETS\s*=\s*\[([\s\S]*?)\]/) || [])[1] || '';
const assets = assetsBlock.match(/'[^']+'/g) || [];
ok('в списке не меньше 6 файлов', assets.length >= 6, assets.length);
assets.map(function (a) { return a.replace(/'/g, ''); }).forEach(function (a) {
  ok('офлайн-файл существует: ' + a, existsExact(a.replace(/^\.\//, '') || 'index.html'));
});
ok('все пути в списке относительные', assets.every(function (a) {
  return a.indexOf("'./") === 0;
}), assets.join(' '));
ok('install кэширует и активируется сразу', /skipWaiting\(\)/.test(sw) && /addAll|add\(/.test(sw));
ok('activate вычищает старые кэши', /caches\.keys\(\)/.test(sw) && /caches\.delete/.test(sw));
ok('офлайн-навигация падает на pizza.html', /caches\.match\([^)]*\)[\s\S]{0,200}pizza\.html/.test(sw));

console.log('\n-- редирект --');
const index = read('index.html');
ok('index.html перекидывает на калькулятор',
  /url=\.\/pizza\.html/.test(index) || /location\.replace\('\.\/pizza\.html'\)/.test(index));

console.log('\n-- сервер --');
/* Поднимаем serve-lan.js на свободном порту и проверяем ответы по HTTP. */
function get(url) {
  return new Promise(function (resolve) {
    const req = http.get(url, function (res) {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', function (c) { body += c; });
      res.on('end', function () {
        resolve({ status: res.statusCode, type: res.headers['content-type'] || '', body: body });
      });
    });
    req.on('error', function (e) { resolve({ status: 0, type: '', body: e.message }); });
    req.setTimeout(4000, function () { req.destroy(); resolve({ status: 0, type: '', body: 'таймаут' }); });
  });
}

function later(ms) {
  return new Promise(function (r) { setTimeout(r, ms); });
}

(async function () {
  const port = 8097;
  const base = 'http://127.0.0.1:' + port;
  const srv = spawn(process.execPath, [path.join(ROOT, 'serve-lan.js'), String(port)], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let log = '';
  srv.stdout.on('data', function (c) { log += c; });
  srv.stderr.on('data', function (c) { log += c; });

  await later(700);

  const home = await get(base + '/');
  ok('главная отдаётся', home.status === 200, 'HTTP ' + home.status);
  ok('главная — это калькулятор или редирект', /pizza\.html|Неаполитанская/.test(home.body));
  ok('тип главной — html', /text\/html/.test(home.type), home.type);

  const page = await get(base + '/pizza.html');
  ok('pizza.html отдаётся', page.status === 200, 'HTTP ' + page.status);
  ok('тип страницы — html', /text\/html/.test(page.type), page.type);
  ok('страница не закэширована намертво', page.body.length > 5000, page.body.length + ' байт');

  const manif = await get(base + '/manifest.json');
  ok('манифест отдаётся', manif.status === 200);
  ok('манифест с правильным типом', /application\/json/.test(manif.type), manif.type);
  ok('манифест парсится по сети', (function () {
    try { JSON.parse(manif.body); return true; } catch (e) { return false; }
  })());

  const icon = await get(base + '/icons/icon-192.png');
  ok('иконка отдаётся', icon.status === 200, 'HTTP ' + icon.status);
  ok('тип иконки — png', /image\/png/.test(icon.type), icon.type);

  const swFile = await get(base + '/sw.js');
  ok('sw.js отдаётся', swFile.status === 200);
  ok('sw.js — javascript', /javascript/.test(swFile.type), swFile.type);

  const missing = await get(base + '/no-such-file.png');
  ok('отсутствующий файл — 404', missing.status === 404, 'HTTP ' + missing.status);

  const escape = await get(base + '/../secret.txt');
  ok('выход из папки запрещён', escape.status === 403 || escape.status === 404, 'HTTP ' + escape.status);

  const encodedEscape = await get(base + '/%2e%2e/%2e%2e/windows/win.ini');
  ok('кодированный выход из папки тоже закрыт',
    encodedEscape.status === 403 || encodedEscape.status === 404, 'HTTP ' + encodedEscape.status);

  ok('сервер написал приветствие', /Wi-Fi|Откройте/.test(log), log.trim().split('\n')[0] || '(пусто)');

  srv.kill();
  await later(200);

  console.log('\n' + (fails === 0 ? 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ' : 'ПРОВАЛЕНО ПРОВЕРОК: ' + fails));
  process.exit(fails === 0 ? 0 : 1);
})();
