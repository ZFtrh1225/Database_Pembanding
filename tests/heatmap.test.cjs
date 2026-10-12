const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
function extract(name) {
  const start = html.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name + ' missing');
  const open = html.indexOf('{', start);
  let depth = 0, quote = '', escaped = false, comment = '';
  for (let i = open; i < html.length; i++) {
    const ch = html[i], next = html[i + 1];
    if (comment === 'line') { if (ch === '\n') comment = ''; continue; }
    if (comment === 'block') { if (ch === '*' && next === '/') { i++; comment = ''; } continue; }
    if (quote) { if (escaped) escaped = false; else if (ch === '\\') escaped = true; else if (ch === quote) quote = ''; continue; }
    if (ch === '/' && next === '/') { i++; comment = 'line'; continue; }
    if (ch === '/' && next === '*') { i++; comment = 'block'; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth++;
    if (ch === '}' && --depth === 0) return html.slice(start, i + 1);
  }
  throw new Error(name + ' unclosed');
}

let viewer = false, loadDeck = () => Promise.resolve();
const messages = [];
const button = {
  disabled: false, textContent: '', attributes: {}, active: false,
  classList: { toggle(name, on) { assert.equal(name, 'active'); button.active = on; } },
  setAttribute(name, value) { this.attributes[name] = value; }
};
const map = { fitBounds() {} };
class Marker {
  constructor(options) { this.map = options.map; }
  setMap(next) { this.map = next; }
  addListener() {}
}
class Overlay {
  constructor(options) { this.layers = options.layers; this.map = null; this.finalized = false; }
  setMap(next) { this.map = next; }
  setProps(options) { this.layers = options.layers; }
  finalize() { this.finalized = true; }
}
class HeatmapLayer { constructor(options) { this.options = options; } }
const context = vm.createContext({
  document: { getElementById: () => button }, window: { deck: { GoogleMapsOverlay: Overlay, HeatmapLayer } },
  deck: { GoogleMapsOverlay: Overlay, HeatmapLayer }, google: { maps: {
    LatLngBounds: class { extend() {} }, LatLng: class { constructor(lat, lng) { this.lat = lat; this.lng = lng; } }, Marker
  } },
  Promise, Number, currentData: [], gMap: map, gMarkers: [], heatLayer: null, isHeatmap: false,
  _heatmapRequestId: 0, _currentMapMode: 'osm', _lastSearchParams: null,
  _gMarkerCluster: null, _gMarkerByUid: {}, _markerRenderVersion: 0, circleObj: null,
  centerMarker: null, polyLayer: null, polyPoints: [], PIN_COLORS: {}, _gInfoWindow: {},
  _isViewerRole: () => viewer, _parseCoordJS: value => {
    const [lat, lng] = value.split(',').map(Number);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  },
  _getPinLabel: id => id, makePinIcon: () => ({}), collectParams: () => ({}),
  _ensureGoogleMapReady: () => Promise.resolve(map), ensureDeckHeatmap: () => loadDeck(),
  switchMapMode: mode => { context._currentMapMode = mode; },
  toast: message => messages.push(message)
});
for (const name of ['_heatmapPoints', '_clearHeatmapLayer', '_syncHeatmapButton', '_renderHeatmapLayer', 'toggleHeatmap', 'renderMarkers']) {
  vm.runInContext(extract(name), context);
}
const rows = [
  { _uid:'one', id:'DP1', koordinat:'-5.38,105.28', indikasiNilai:'Rp 2.000.000' },
  { _uid:'two', id:'DP2', koordinat:'-5.39,105.29', indikasiNilai:'3000000' },
  { _uid:'excluded', koordinat:'-5.40,105.30', indikasiNilai:'4000000', _excluded:true }
];
context.currentData = rows;

(async () => {
  context.toggleHeatmap();
  assert.equal(button.disabled, true, 'Tombol menunggu peta dan pustaka siap');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(context._currentMapMode, 'gmaps', 'Mode awal OSM beralih ke Google');
  assert.equal(context.isHeatmap, true);
  assert.equal(button.attributes['aria-pressed'], 'true');
  assert.equal(context.heatLayer.map, map);
  const layer = context.heatLayer.layers[0];
  assert.equal(layer.options.data.length, 2, 'Titik yang dikecualikan tidak memengaruhi peta panas');
  assert.deepEqual(Array.from(layer.options.getPosition(layer.options.data[0])), [105.28, -5.38]);
  assert.equal(layer.options.getWeight(layer.options.data[0]), 0.8, 'Bobot mengikuti rasio harga terhadap median');
  assert.equal(context.gMarkers[0].map, null, 'Pin pembanding tersembunyi selama heatmap');

  const active = context.heatLayer;
  context.renderMarkers([rows[0]], {}, true);
  assert.equal(context.heatLayer, active, 'Pencarian ulang memperbarui lapisan yang sama');
  assert.equal(context.heatLayer.layers[0].options.data.length, 1);

  const previous = context.heatLayer;
  context.toggleHeatmap();
  assert.equal(context.isHeatmap, false);
  assert.equal(previous.finalized, true, 'Konteks WebGL dilepas setelah dimatikan');
  assert.equal(context.gMarkers[0].map, map, 'Pin kembali terlihat');
  assert.equal(button.attributes['aria-pressed'], 'false');

  context.toggleHeatmap();
  await new Promise(resolve => setImmediate(resolve));
  context.renderMarkers([{ koordinat:'-5.38,105.28', indikasiNilai:'' }], {}, true);
  assert.equal(context.isHeatmap, false, 'Pencarian baru tanpa data harga mematikan heatmap');
  assert.equal(context.gMarkers[0].map, map, 'Pin hasil pencarian tetap tampil');

  context.currentData = [{ koordinat:'-5.38,105.28', indikasiNilai:'' }];
  context.toggleHeatmap();
  assert.equal(context.isHeatmap, false, 'Data tanpa harga valid tidak menyembunyikan pin');
  assert.match(messages.at(-1), /indikasi nilai/);

  context.currentData = rows;
  loadDeck = () => Promise.reject(new Error('CDN terblokir'));
  context.toggleHeatmap();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(context.isHeatmap, false, 'Kegagalan pustaka mengembalikan mode normal');
  assert.equal(context.gMarkers[0].map, map);
  assert.match(messages.at(-1), /CDN terblokir/);

  viewer = true;
  context.toggleHeatmap();
  assert.equal(context.isHeatmap, false, 'Batasan role Viewer tetap berlaku');
  assert.doesNotMatch(html, /google\.maps\.visualization\.HeatmapLayer/);
  console.log('Heatmap: mode OSM → Google, data berbobot, toggle, data kosong, dan gagal CDN OK');
})().catch(error => { console.error(error); process.exitCode = 1; });
