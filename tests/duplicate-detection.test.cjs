const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const backend = fs.readFileSync(path.join(__dirname, '..', 'Backend', 'Code.gs'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function extract(source, name) {
  const start = source.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name + ' missing');
  const body = source.indexOf('{', start);
  let depth = 0, quote = '', escaped = false, comment = '';
  for (let i = body; i < source.length; i++) {
    const c = source[i], next = source[i + 1];
    if (comment === 'line') { if (c === '\n') comment = ''; continue; }
    if (comment === 'block') { if (c === '*' && next === '/') { i++; comment = ''; } continue; }
    if (quote) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === quote) quote = ''; continue; }
    if (c === '/' && next === '/') { i++; comment = 'line'; continue; }
    if (c === '/' && next === '*') { i++; comment = 'block'; continue; }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{') depth++;
    if (c === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(name + ' unclosed');
}

const context = vm.createContext({ isFinite, Math, Number, String, Object, Array });
for (const name of [
  '_duplicateNormalizeText_', '_duplicatePhone_', '_duplicateNumber_', '_duplicateAddressSimilarity_',
  '_duplicateRelativeDifference_', '_haversine', '_duplicateScore_'
]) vm.runInContext(extract(backend, name), context);

test('normalisasi dasar menyatukan variasi telepon dan alamat', () => {
  assert.equal(context._duplicatePhone_('0812-3456-7890'), '81234567890');
  assert.equal(context._duplicatePhone_('+62 812 3456 7890'), '81234567890');
  assert.equal(context._duplicateNormalizeText_('Jl. Merdeka No. 10'), 'jalan merdeka nomor 10');
  assert.ok(context._duplicateAddressSimilarity_('Jl Merdeka No 10', 'Jalan Merdeka Nomor 10') >= 0.99);
});

test('properti yang sangat mirip menjadi kandidat kuat walau tahun data berbeda', () => {
  const input = {
    coord:{ lat:-6.200000, lng:106.800000 }, hp:'081234567890', alamat:'Jl Merdeka No 10',
    luasTanah:100, luasBangunan:50, harga:'1.000.000.000', objek:'Tanah Bangunan', waktuData:'2026'
  };
  const existing = {
    coord:{ lat:-6.200025, lng:106.800020 }, hp:'+62 812-3456-7890', alamat:'Jalan Merdeka Nomor 10',
    luasTanah:102, luasBangunan:50, harga:980000000, objek:'Tanah Bangunan', waktuData:'2025'
  };
  const result = context._duplicateScore_(input, existing);
  assert.ok(result.score >= 80, 'kemiripan kuat harus memperoleh skor tinggi');
  assert.ok(result.indicators.some(item => item.key === 'coordinate'));
  assert.ok(result.indicators.some(item => item.key === 'phone'));
  assert.ok(result.indicators.some(item => item.key === 'address'));
});

test('data berbeda tidak memperoleh skor kandidat', () => {
  const result = context._duplicateScore_(
    { coord:{lat:-6.2,lng:106.8}, hp:'081111111111', alamat:'Jalan Merdeka 10', luasTanah:100, harga:1000000000, objek:'Ruko' },
    { coord:{lat:-7.8,lng:110.3}, hp:'082222222222', alamat:'Jalan Kaliurang 99', luasTanah:500, harga:9000000000, objek:'Tanah Kosong' }
  );
  assert.ok(result.score < 35);
});

test('backend memeriksa ulang dan menyimpan keputusan hubungan', () => {
  assert.match(backend, /action === 'findDuplicateCandidates'/);
  assert.equal((backend.match(/action === 'addData'/g) || []).length, 1);
  assert.match(extract(backend, 'addData'), /requiresDuplicateDecision/);
  assert.match(extract(backend, 'editData'), /requiresDuplicateDecision/);
  assert.match(extract(backend, '_recordDataRelation_'), /Menunggu Review/);
  assert.match(backend, /const DATA_RELATION_SHEET = "Relasi_Data"/);
  assert.match(extract(backend, 'setupSpreadsheet'), /_ensureDataRelationSheet_\(\)/);
});

test('form memeriksa kandidat sebelum upload dan meminta klasifikasi manusia', () => {
  const submitSource = extract(html, 'submitData');
  assert.match(submitSource, /findDuplicateCandidates/);
  assert.doesNotMatch(submitSource, /uploadFoto/);
  assert.match(extract(html, '_continueDataSubmit'), /uploadFoto/);
  assert.match(html, /id="duplicateOverlay"/);
  assert.match(html, /value="NEW_MARKET_EVENT"/);
  assert.match(html, /value="SAME_PROPERTY_DIFFERENT_SOURCE"/);
  assert.match(html, /value="DIFFERENT_PROPERTY"/);
  assert.match(extract(html, 'refreshDuplicatePreview'), /findDuplicateCandidates/);
  assert.match(extract(html, 'closeModal'), /document\.body\.style\.overflow = ''/);
});
