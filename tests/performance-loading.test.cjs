const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');

test('OpenStreetMap menjadi jalur awal tanpa menunggu Google Maps', () => {
  const safeStart = html.indexOf('function safeInitMap()');
  const safeEnd = html.indexOf('\nfunction syncConnectivityState', safeStart);
  const safeInitSource = html.slice(safeStart, safeEnd);
  assert.match(safeInitSource, /_initOpenStreetMap\(\)/);
  assert.match(safeInitSource, /_startInitialSearchOnce\(\)/);
  assert.doesNotMatch(safeInitSource, /loadGoogleMapsApi\(\)/);
  assert.match(html, /function _ensureGoogleMapReady\(\)/);
  assert.match(html, /_mapInitPromise = loadGoogleMapsApi\(\)/);
});

test('Google Maps memiliki loading, retry, dan fallback OpenStreetMap', () => {
  assert.match(html, /function _setMapLoadingState\(state, message\)/);
  assert.match(html, /onclick="retryGoogleMap\(\)"/);
  assert.match(html, /switchMapMode\(\\'osm\\'\)/);
  assert.match(html, /Gunakan OpenStreetMap/);
  assert.match(html, /function retryGoogleMap\(\)/);
  assert.match(html, /Heatmap menggunakan Google Maps\. Menyiapkan peta/);
  assert.match(html, /Menyiapkan Google Maps untuk Measurement/);
});

test('parameter pendukung dicache lintas sesi dan dapat dibatalkan setelah edit', () => {
  assert.match(html, /FILTER_OPTIONS_CACHE_KEY = 'databasePembanding:filterOptions:v2'/);
  assert.match(html, /FILTER_OPTIONS_CACHE_MAX_AGE_MS = 6 \* 60 \* 60 \* 1000/);
  assert.match(html, /localStorage\.setItem\(FILTER_OPTIONS_CACHE_KEY/);
  assert.match(html, /localStorage\.removeItem\(FILTER_OPTIONS_CACHE_KEY\)/);
  assert.match(html, /_applyFilterOptions_\(cached\.result, true\)/);
});

test('respons pencarian lama diabaikan dan render berat dibagi antar frame', () => {
  assert.match(html, /var _searchRequestSequence = 0/);
  assert.match(html, /var searchRequestId = \+\+_searchRequestSequence/);
  const staleChecks = html.match(/searchRequestId !== _searchRequestSequence/g) || [];
  assert.ok(staleChecks.length >= 4);
  assert.match(html, /requestAnimationFrame\(function\(\) \{[\s\S]*renderMarkers\(currentData, params\);[\s\S]*requestAnimationFrame\(function\(\) \{[\s\S]*renderTable\(currentData\)/);
});

test('status offline terlihat dan pencarian dapat dicoba kembali', () => {
  assert.match(html, /id="connectivityBanner" role="status" aria-live="polite"/);
  assert.match(html, /window\.addEventListener\('offline', syncConnectivityState\)/);
  assert.match(html, /window\.addEventListener\('online'/);
  assert.match(html, /navigator\.onLine === false/);
  assert.match(html, /Perangkat sedang offline\. Sambungkan internet, lalu tekan Coba lagi/);
});
