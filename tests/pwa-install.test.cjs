const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

test('manifest PWA menyediakan identitas, mode standalone, dan ikon instalasi', () => {
  assert.equal(manifest.name, 'Database Pembanding');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.theme_color, '#1e3a5f');
  assert.deepEqual(manifest.icons.map(icon => icon.sizes), ['192x192', '512x512']);
  manifest.icons.forEach(icon => assert.ok(fs.existsSync(path.join(root, icon.src))));
  assert.ok(fs.existsSync(path.join(root, 'icons/icon-180.png')));
});

test('halaman mendaftarkan manifest, metadata mobile, dan service worker satu scope', () => {
  assert.match(html, /<link rel="manifest" href="\.\/manifest\.webmanifest"/);
  assert.match(html, /name="apple-mobile-web-app-capable" content="yes"/);
  assert.match(html, /rel="apple-touch-icon" sizes="180x180" href="\.\/icons\/icon-180\.png"/);
  assert.match(html, /navigator\.serviceWorker\.register\('\.\/sw\.js', \{ scope:'\.\/' \}\)/);
  assert.match(html, /id="btnInstallAppMobile"/);
  assert.match(html, /function requestPwaInstall\(\)/);
  assert.match(html, /beforeinstallprompt/);
  assert.match(html, /appinstalled/);
});

test('service worker hanya memberi fallback shell untuk navigasi', () => {
  assert.match(serviceWorker, /request\.method !== 'GET' \|\| request\.mode !== 'navigate'/);
  assert.match(serviceWorker, /fetch\(request\)/);
  assert.match(serviceWorker, /caches\.match\('\.\/index\.html'\)/);
  assert.doesNotMatch(serviceWorker, /script\.google\.com|googleapis\.com|tile\.openstreetmap/);
});
