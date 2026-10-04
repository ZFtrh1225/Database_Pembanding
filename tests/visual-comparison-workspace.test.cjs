const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');

test('ruang perbandingan memakai Profil Aset sebagai acuan', () => {
  assert.match(html, /Ruang Kerja Perbandingan Properti/);
  assert.match(html, /class="compare-target-col"/);
  assert.match(html, /getQualityTargetProfile\(\)/);
  assert.match(html, /Alat bantu telaah, bukan kesimpulan nilai/);
});

test('pembanding utama disimpan per pengguna dan dibatasi tiga data', () => {
  assert.match(html, /databasePembanding:primaryComparables:v1:/);
  assert.match(html, /primaryCompareKeys\.length >= 3/);
  assert.match(html, /Maksimal tiga pembanding utama/);
  assert.match(html, /function _syncComparisonSelectionAfterSearch\(\)/);
  assert.match(html, /row && !row\._excluded/);
});

test('filter cepat dan alasan pemilihan tersedia', () => {
  assert.match(html, /id="compareSort"/);
  assert.match(html, /id="compareCandidateFilter"/);
  assert.match(html, /id="compareVerifiedOnly"/);
  assert.match(html, /id="compareHideDuplicate"/);
  assert.match(html, /function _comparisonReasons\(row, profile\)/);
  assert.match(html, /Ambang CV ≤4%, 4–7%, dan &gt;7% adalah indikator telaah internal/);
});

test('statistik perbandingan menghitung simpangan baku sampel dan koefisien variasi', () => {
  const start = html.indexOf('function _comparisonStatistics(values)');
  const end = html.indexOf('\nfunction showCompareModal', start);
  assert.ok(start >= 0 && end > start);
  const context = {};
  vm.runInNewContext(html.slice(start, end), context);
  const stats = context._comparisonStatistics([100, 110, 120]);
  assert.equal(stats.count, 3);
  assert.equal(stats.average, 110);
  assert.equal(stats.median, 110);
  assert.equal(stats.sampleStdev, 10);
  assert.ok(Math.abs(stats.coefficientVariation - 9.090909) < 0.00001);
  assert.equal(stats.variationTone, 'bad');
  assert.match(html, /Standar Deviasi/);
  assert.match(html, /Koefisien Variasi/);
  assert.match(html, /Sebaran rendah tidak otomatis membuat data layak sebagai pembanding/);
});

test('perbandingan mobile dapat digeser horizontal', () => {
  assert.match(html, /scroll-snap-type:x mandatory/);
  assert.match(html, /compare-reason-card \{ flex:0 0 min\(78vw,270px\)/);
  assert.match(html, /compare-scroll \{ overflow:auto/);
});
