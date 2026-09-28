const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
function extract(name) {
  const start = html.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name + ' missing');
  const body = html.indexOf('{', start);
  let depth = 0, quote = '', escaped = false, comment = '';
  for (let i = body; i < html.length; i++) {
    const c = html[i], next = html[i + 1];
    if (comment === 'line') { if (c === '\n') comment = ''; continue; }
    if (comment === 'block') { if (c === '*' && next === '/') { i++; comment = ''; } continue; }
    if (quote) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === quote) quote = ''; continue; }
    if (c === '/' && next === '/') { i++; comment = 'line'; continue; }
    if (c === '/' && next === '*') { i++; comment = 'block'; continue; }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{') depth++;
    if (c === '}' && --depth === 0) return html.slice(start, i + 1);
  }
  throw new Error(name + ' unclosed');
}

const mapClasses = new Map();
function classList(name) {
  if (!mapClasses.has(name)) mapClasses.set(name, new Set(name === 'measureOverlay' ? ['open'] : []));
  const classes = mapClasses.get(name);
  return {
    contains: value => classes.has(value),
    add: value => classes.add(value),
    remove: value => classes.delete(value),
    toggle: (value, force) => force ? classes.add(value) : classes.delete(value)
  };
}
const nodes = new Map();
function node(id) {
  if (!nodes.has(id)) nodes.set(id, {
    value: '', textContent: '', innerHTML: '', style: {}, classList: classList(id),
    attributes: {}, setAttribute(k, v) { this.attributes[k] = v; }
  });
  return nodes.get(id);
}
let nextFrame = 0, cancelledFrame = 0, reduceMotion = false;
const c = vm.createContext({
  document: { getElementById: node, hidden: false },
  window: { matchMedia: () => ({ matches: reduceMotion }) },
  requestAnimationFrame: () => ++nextFrame,
  cancelAnimationFrame: handle => { cancelledFrame = handle; },
  _mLinesVisible: true, _mOsmActive: false,
  _mOsmDashFrame: null, _mOsmDashLast: 0, _mOsmDashOffset: 0,
  _mRoutes: {}, _mMks: {}, _mLbls: {}, _mRouteRunId: 0,
  _mOsmLines: [], _mOsmMarkers: [], _mOsmLabels: [],
  _mDpIds: ['1', '2', '3', '4', '5', '6'],
  _mRouteColors: { '1': '#e60023' },
  _mMap: { zoom: 14, getZoom() { return this.zoom; }, setZoom(z) { this.zoom = z; }, fitBounds() {} },
  _mOsmMap: null
});
class Polyline {
  constructor(opts) { this.opts = opts; this.map = opts.map; this.icons = opts.icons; }
  setMap(map) { this.map = map; }
  get(k) { return k === 'icons' ? this.icons : undefined; }
  set(k, value) { if (k === 'icons') this.icons = value; }
}
c.google = { maps: {
  Polyline, LatLngBounds: class { extend() {} },
  TravelMode: { DRIVING: 'DRIVING' }, UnitSystem: { METRIC: 'METRIC' },
  DirectionsStatus: { OK: 'OK' }
} };
c.window.google = c.google;
for (const name of [
  '_mOsmStopDashAnimation', '_mOsmDashTick', '_mOsmSyncDashAnimation', '_mSyncLineVisibility',
  'toggleMeasurementLines', 'mZoomMeasurement', '_mCreateDashedPolyline',
  '_mParse', '_mHaversine', '_mFmtDist', '_mFmtMeters',
  '_mClearLayers', '_mRedraw', '_mOsmClearLayers', '_mOsmMakeIcon', '_mOsmRedraw'
]) vm.runInContext(extract(name), c);

// Rute jalan Google harus mempertahankan geometri dan jarak Directions.
node('mCoord_obj').value = '-5.380964, 105.284946';
node('mCoord_1').value = '-5.382664, 105.280162';
c._mMakePin = () => ({ setMap() {} });
c._mMakeObjLabel = c._mMakeLabel = () => ({ setMap() {} });
const road = [{ lat: -5.380964, lng: 105.284946 }, { lat: -5.3814, lng: 105.283 }, { lat: -5.382664, lng: 105.280162 }];
c._mDirSvc = { route(request, done) {
  assert.equal(request.travelMode, 'DRIVING');
  done({ routes: [{ legs: [{ distance: { value: 790, text: '790 m' } }], overview_path: road }] }, 'OK');
} };
c._mRedraw();
assert.equal(c._mRoutes['1'].opts.path, road);
assert.equal(c._mRoutes['1'].opts.icons[0].repeat, '22px');
assert.equal(c._mRoutes['1'].opts.icons[0].offset, '0px', 'Garis Google tetap diam');
assert.equal(c._mRoutes['1'].opts.strokeOpacity, 0);
assert.equal(node('mDist_1').textContent, '790 m');
c.mZoomMeasurement(1);
assert.equal(c._mMap.getZoom(), 15);

c._mDirSvc.route = (request, done) => done(null, 'ZERO_RESULTS');
c._mRedraw();
assert.match(node('mDist_1').textContent, /lurus/);
assert.equal(c._mRoutes['1'].opts.icons[0].offset, '0px', 'Garis cadangan Google tetap diam');
assert.equal(c._mRoutes['1'].opts.path.length, 2);
c._mDirSvc.route = (request, done) => done({ routes: [{
  legs: [{ distance: { value: 790, text: '790 m' } }], overview_path: road
}] }, 'OK');
c._mRedraw();

c.toggleMeasurementLines();
assert.equal(c._mRoutes['1'].map, null);
assert.equal(node('mDist_1').textContent, '790 m', 'Menyembunyikan garis tidak menghapus jarak');
assert.equal(node('mLinesToggle').attributes['aria-pressed'], 'false');
c._mRedraw();
assert.equal(c._mRoutes['1'].map, null, 'Garis baru juga tersembunyi saat data berubah');

// Jalur OSM menggunakan SVG dan kontrol yang sama; marker dan label tetap ada.
const osmLayers = new Set();
c._mOsmMap = {
  hasLayer: layer => osmLayers.has(layer), removeLayer: layer => osmLayers.delete(layer),
  fitBounds() {}, zoomIn() { this.zoom = (this.zoom || 14) + 1; },
  zoomOut() { this.zoom = (this.zoom || 14) - 1; }
};
c.L = {
  divIcon: data => data,
  marker: () => ({ addTo(map) { osmLayers.add(this); return this; } }),
  polyline: (points, opts) => ({
    points, options: opts, path: { style: {} },
    getElement() { return osmLayers.has(this) ? this.path : null; },
    addTo(map) { osmLayers.add(this); return this; }
  })
};
c._mOsmActive = true;
c._mOsmRedraw();
assert.equal(c._mOsmLines.length, 1);
assert.equal(c._mOsmLines[0].options.className, 'measure-osm-line');
assert.equal(osmLayers.has(c._mOsmLines[0]), false);
assert.ok(c._mOsmMarkers.length > 0 && c._mOsmLabels.length > 0);
assert.match(node('mDist_1').textContent, /lurus/);
c.toggleMeasurementLines();
assert.equal(osmLayers.has(c._mOsmLines[0]), true);
assert.ok(c._mOsmDashFrame !== null, 'Animasi mulai ketika garis OSM ditampilkan');
c._mOsmDashTick(1000);
c._mOsmDashTick(1034);
assert.equal(c._mOsmLines[0].path.style.strokeDashoffset, '-0.68px', 'Jalur SVG bergerak per frame');
c.toggleMeasurementLines();
assert.equal(c._mOsmDashFrame, null, 'Animasi berhenti ketika garis disembunyikan');
assert.ok(cancelledFrame > 0);
c.toggleMeasurementLines();
reduceMotion = true;
c._mOsmSyncDashAnimation();
assert.equal(c._mOsmDashFrame, null, 'Pengaturan kurangi gerakan dihormati');
reduceMotion = false;
c._mOsmSyncDashAnimation();
c.mZoomMeasurement(-1);
assert.equal(c._mOsmMap.zoom, 13);
assert.equal(node('mLinesToggle').attributes['aria-pressed'], 'true');

// Respons terlambat dari rute lama tidak boleh menggambar garis kembali.
c._mOsmActive = false;
let delayed;
c._mDirSvc = { route(request, done) { delayed = done; } };
c._mRedraw();
c._mClearLayers();
delayed({ routes: [{ legs: [{ distance: { value: 790, text: '790 m' } }], overview_path: road }] }, 'OK');
assert.equal(Object.keys(c._mRoutes).length, 0);

assert.match(html, /renderer: L\.svg\(\)/, 'Leaflet memakai jalur SVG');
assert.doesNotMatch(html, /requestAnimationFrame\(_mDashTick\)/);
assert.match(html, /\.mmap-zoom \{ grid-column: span 2; \}/);
console.log('Measurement: rute Google statis, animasi OSM, toggle, zoom, dan respons terlambat OK');
