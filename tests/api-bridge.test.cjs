const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const backend = fs.readFileSync(path.join(root, 'Backend/Code.gs'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

assert.doesNotMatch(html, /AIza[0-9A-Za-z_-]{20,}/,
  'Google API key tidak boleh disimpan di source GitHub');
assert.doesNotMatch(html, /<script[^>]+maps\.googleapis\.com\/maps\/api\/js/i,
  'Google Maps tidak boleh memakai key statis di tag script');
assert.match(html, /function _ensureGasBridge\(\)/);
assert.match(html, /function _gasBridgeCall\(action, args\)/);
assert.match(html, /event\.source !== state\.targetWindow/,
  'Respons bridge harus berasal dari window bridge yang melakukan handshake');
assert.match(html, /hostname\.endsWith\('\.googleusercontent\.com'\)/,
  'Origin final Apps Script harus divalidasi');
assert.match(html, /message\.nonce !== state\.nonce/,
  'Handshake bridge harus memakai nonce acak');
assert.match(html, /_gasBridgeCall\('getPublicConfig', \[\]\)/,
  'Maps key harus diambil melalui runtime configuration');
assert.match(html, /this\._call\('searchData'/,
  'Pencarian harus melewati API Bridge, bukan fetch lintas-domain');
assert.doesNotMatch(html, /fetch\(SCRIPT_URL/,
  'Jalur fetch lama yang gagal tidak boleh tersisa');

assert.match(backend, /function doGet\(e\)/);
assert.match(backend, /HtmlService\.XFrameOptionsMode\.ALLOWALL/);
assert.match(backend, /function apiCall\(action, args\)/);
assert.match(backend, /function _dispatchApiAction_\(action, args\)/);
assert.match(backend, /PropertiesService\.getScriptProperties\(\)\.getProperty\(MAPS_API_KEY_PROPERTY\)/);
assert.match(backend, /event\.origin!==ALLOWED_ORIGIN\|\|event\.source!==window\.top/,
  'Bridge harus menolak pesan dari origin selain GitHub Pages');
assert.match(backend, /msg\.nonce!==NONCE/,
  'Backend bridge harus menolak request dengan nonce yang salah');

console.log('API Bridge dan runtime Google Maps key tervalidasi.');
