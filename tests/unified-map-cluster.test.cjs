const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');

test('ambang warna cluster sama untuk kedua penyedia peta', () => {
  const source = html.match(/function _mapClusterTier\(count\) \{[\s\S]*?\n\}/);
  assert.ok(source, 'fungsi ambang cluster harus tersedia');
  const context = {};
  vm.runInNewContext(source[0], context);
  assert.equal(context._mapClusterTier(1), 'small');
  assert.equal(context._mapClusterTier(9), 'small');
  assert.equal(context._mapClusterTier(10), 'medium');
  assert.equal(context._mapClusterTier(99), 'medium');
  assert.equal(context._mapClusterTier(100), 'large');
  assert.equal(context._mapClusterTier(139), 'large');
});

test('OpenStreetMap dan Google Maps memakai renderer cluster yang disatukan', () => {
  assert.match(html, /iconCreateFunction:_makeOsmClusterIcon/);
  assert.match(html, /renderer:_makeGoogleClusterRenderer\(\)/);
  assert.match(html, /MAP_CLUSTER_COLORS = \{ small:'#22c55e', medium:'#eab308', large:'#ef4444' \}/);
});

test('legenda menjelaskan jumlah cluster bukan skor kualitas', () => {
  assert.match(html, /Hijau · kurang dari 10 data/);
  assert.match(html, /Kuning · 10–99 data/);
  assert.match(html, /Merah · 100 data atau lebih/);
  assert.match(html, /Angka di lingkaran adalah jumlah data, bukan skor kualitas/);
});

