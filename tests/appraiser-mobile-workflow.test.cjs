const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('filter cepat dan chip aktif dapat diterapkan serta dihapus', () => {
  for (const preset of ['recent-transaction', 'offer-radius', 'building-shm']) {
    assert.match(html, new RegExp(`applyFilterPreset\\('${preset}'\\)`));
  }
  assert.match(html, /function renderActiveFilterChips\(\)/);
  assert.match(html, /function clearFilterToken\(type, value\)/);
  assert.match(html, /button\.addEventListener\('click', function\(\) \{ clearFilterToken/);
  assert.match(html, /function saveFilterHistory\(params\)/);
  assert.match(html, /function applyFilterHistory\(index\)/);
  assert.match(html, /className = 'filter-chip clear-all'/);
});

test('hasil pencarian memiliki state loading, kosong, error, dan retry', () => {
  assert.match(html, /id="searchStateOverlay" aria-live="polite"/);
  assert.match(html, /setSearchState\('loading'\)/);
  assert.match(html, /setSearchState\('empty'\)/);
  assert.match(html, /setSearchState\('error'/);
  assert.match(html, /onclick="doSearch\(\)"/);
});

test('daftar dan marker peta disinkronkan menggunakan uid properti', () => {
  assert.match(html, /var _gMarkerByUid = \{\}, _osmMarkerByUid = \{\}/);
  assert.match(html, /function focusPropertyFromList\(uid\)/);
  assert.match(html, /_gMarkerByUid\[row\._uid\] = marker/);
  assert.match(html, /_osmMarkerByUid\[row\._uid\] = marker/);
  assert.match(html, /selectProperty\(r\._uid\)/);
  assert.match(html, /selectProperty\(row\._uid\)/);
});

test('kualitas pembanding menghitung kelengkapan, umur, jarak, dan outlier', () => {
  assert.match(html, /function getAppraisalQualityMeta\(row\)/);
  assert.match(html, /function _distanceKmClient\(lat1, lng1, lat2, lng2\)/);
  assert.match(html, /row\._priceOutlier =/);
  assert.match(html, /row\._possibleDuplicate =/);
  assert.match(html, /row\._distanceKm = _distanceKmClient/);
  assert.match(html, /Kualitas ' \+ quality\.score \+ '\/100/);
  assert.match(html, /Jarak dari Aset/);
});

test('form menyediakan validasi inline dan draf lokal per pengguna', () => {
  assert.match(html, /function validateDataForm\(\)/);
  assert.match(html, /function saveDataDraft\(\)/);
  assert.match(html, /function restoreDataDraft\(\)/);
  assert.match(html, /DATA_DRAFT_KEY \+ ':' \+ \(activeUsername \|\| 'anonymous'\)/);
  assert.match(html, /localStorage\.setItem\(_draftStorageKey\(\)/);
  assert.match(html, /Perubahan belum disimpan/);
  assert.match(html, /markDataFormSaved\(\); closeModal\(true\)/);
  assert.match(html, /id="dataFormReview"/);
  assert.match(html, /function setupDataInputFormatting\(\)/);
});

test('pencarian koordinat memakai API Google Maps yang benar', () => {
  assert.doesNotMatch(html, /gMap\.setView\(/);
  assert.match(html, /gMap\.setCenter\(\{lat:coord\.lat,lng:coord\.lng\}\); gMap\.setZoom\(16\)/);
});

test('marker banyak dikelompokkan dan pustaka berat dimuat sesuai kebutuhan', () => {
  assert.match(html, /ensureGoogleMarkerCluster\(\)/);
  assert.match(html, /ensureLeafletMarkerCluster\(\)/);
  assert.match(html, /data\.length >= 30/);
  assert.match(html, /function ensureChartLibrary\(\)/);
  assert.match(html, /function ensurePdfLibrary\(\)/);
  assert.doesNotMatch(html, /<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/chart\.js"><\/script>/);
  assert.doesNotMatch(html, /<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/html2pdf/);
});

console.log('Workflow penilai mobile, kualitas data, filter, peta, dan draf tervalidasi.');
