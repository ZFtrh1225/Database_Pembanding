const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function extractFunction(source, name) {
  const start = source.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name + ' missing');
  const body = source.indexOf('{', start);
  let depth = 0;
  for (let i = body; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(name + ' unclosed');
}

test('adapter GAS menyediakan seluruh endpoint deteksi dan review relasi', () => {
  assert.match(html, /findDuplicateCandidates\(rowData, user, excludeId\) \{ this\._call\('findDuplicateCandidates'/);
  assert.match(html, /getDataRelations\(user, options\) \{ this\._call\('getDataRelations'/);
  assert.match(html, /reviewDataRelation\(payload, user\) \{ this\._call\('reviewDataRelation'/);
});

test('peta tetap dimulai ketika fitur izin atau badge relasi gagal', () => {
  const calls = [];
  const context = {
    safeInitMap() { calls.push('map'); },
    applyPermissions() { calls.push('permissions'); throw new Error('fitur opsional gagal'); },
    loadFilterOptions() { calls.push('filters'); },
    _setMapLoadingState() { calls.push('map-error'); },
    console: { error() {}, warn() {} }
  };
  vm.runInNewContext(
    extractFunction(html, 'initializeAuthenticatedApp') + '; initializeAuthenticatedApp("Admin");',
    context
  );
  assert.deepEqual(calls, ['map', 'permissions', 'filters']);
});

test('kedua jalur login memakai inisialisasi aplikasi yang terisolasi', () => {
  assert.match(html, /setTimeout\(function\(\) \{ initializeAuthenticatedApp\(activeRole\); \}, 300\)/);
  assert.match(html, /closeLoginOverlay\(\); initializeAuthenticatedApp\(res\.role\);/);
});
