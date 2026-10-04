const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

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
  assert.match(html, /Ringkasan deskriptif, bukan kesimpulan nilai/);
});

test('perbandingan mobile dapat digeser horizontal', () => {
  assert.match(html, /scroll-snap-type:x mandatory/);
  assert.match(html, /compare-reason-card \{ flex:0 0 min\(78vw,270px\)/);
  assert.match(html, /compare-scroll \{ overflow:auto/);
});

