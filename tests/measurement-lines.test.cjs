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
    className: '', attributes: {}, setAttribute(k, v) { this.attributes[k] = v; },
    querySelector(selector) {
      if (selector !== 'button') return null;
      if (!this.button) this.button = { style: {} };
      return this.button;
    }
  });
  return nodes.get(id);
}
let nextFrame = 0, cancelledFrame = 0, reduceMotion = false;
const c = vm.createContext({
  document: { getElementById: node, hidden: false },
  window: { matchMedia: () => ({ matches: reduceMotion }) },
  setTimeout: fn => { fn(); return 1; }, clearTimeout: () => {},
  requestAnimationFrame: () => ++nextFrame,
  cancelAnimationFrame: handle => { cancelledFrame = handle; },
  _mLinesVisible: true, _mOsmActive: false,
  _mOsmDashFrame: null, _mOsmDashLast: 0, _mOsmDashOffset: 0,
  _mRoutes: {}, _mMks: {}, _mLbls: {}, _mRouteRunId: 0,
  _mRouteClassPromise: null, _mRouteNoticeTimer: null,
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
  Point: class { constructor(x, y) { this.x = x; this.y = y; } },
  Size: class { constructor(width, height) { this.width = width; this.height = height; } },
  Marker: class { constructor(opts) { this.opts = opts; } setMap() {} },
  TravelMode: { DRIVING: 'DRIVING' }, UnitSystem: { METRIC: 'METRIC' },
  DirectionsStatus: { OK: 'OK' }
} };
c.window.google = c.google;
for (const name of [
  '_mOsmStopDashAnimation', '_mOsmDashTick', '_mOsmSyncDashAnimation', '_mSyncLineVisibility',
  'toggleMeasurementLines', 'mZoomMeasurement', '_mCreateRoutePolyline', '_mRoutePathToPins',
  '_mParse', '_mHaversine', '_mFmtDist', '_mFmtMeters',
  '_mNormalizeRoutePoint', '_mGetRouteClass', '_mComputeModernRoadRoute', '_mComputeLegacyRoadRoute',
  '_mFriendlyRouteError', '_mComputeRoadRoute', '_mFormatRouteDuration', '_mSetDistanceState',
  '_mShowRouteNotice', 'retryMeasurementRoutes',
  '_mClearLayers', '_mMakePin', '_mRedraw', '_mOsmClearLayers', '_mOsmMakeIcon', '_mOsmRedraw'
]) vm.runInContext(extract(name), c);

async function settle() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise(resolve => setImmediate(resolve));
}

(async function main() {
  // Rute Google modern harus mempertahankan geometri jalan, jarak, dan durasi.
  node('mCoord_obj').value = '-5.380964, 105.284946';
  node('mCoord_1').value = '-5.382664, 105.280162';
  const pin = c._mMakePin({ lat: -5.380964, lng: 105.284946 }, '#db4437', 'OBJ', true);
  assert.equal(pin.opts.icon.anchor.y, 46, 'Titik koordinat Google tepat di ujung pin, bukan bayangan');
  c._mMakePin = () => ({ setMap() {} });
  c._mMakeObjLabel = c._mMakeLabel = () => ({ setMap() {} });
  const road = [{ lat: -5.381, lng: 105.2848 }, { lat: -5.3814, lng: 105.283 }, { lat: -5.3825, lng: 105.2803 }];
  let modernMode = 'success';
  class Route {
    static async computeRoutes(request) {
      assert.equal(request.travelMode, 'DRIVING');
      if (modernMode === 'fail') throw new Error('PERMISSION_DENIED');
      if (modernMode === 'delay') return new Promise(resolve => { Route.delayed = resolve; });
      return { routes: [{ path: road, distanceMeters: 790, durationMillis: 120000, warnings: [] }] };
    }
  }
  c.google.maps.importLibrary = async name => {
    assert.equal(name, 'routes');
    return { Route };
  };
  c._mDirSvc = { route(request, done) {
    done({ routes: [{ legs: [{ distance: { value: 790 }, duration: { value: 120 } }], overview_path: road }] }, 'OK');
  } };

  c._mRedraw();
  await settle();
  assert.equal(c._mRoutes['1'].opts.path[0].lat, -5.380964, 'Rute dimulai tepat pada pin OBJ');
  assert.equal(c._mRoutes['1'].opts.path.at(-1).lat, -5.382664, 'Rute berakhir tepat pada pin DP');
  assert.equal(c._mRoutes['1'].opts.path[1].lat, road[0].lat, 'Geometri jalan Routes dipertahankan');
  assert.equal(c._mRoutes['1'].opts.path[1].lng, road[0].lng);
  assert.equal(c._mRoutes['1'].opts.path.at(-2).lat, road.at(-1).lat);
  assert.equal(c._mRoutes['1'].opts.path.at(-2).lng, road.at(-1).lng);
  assert.equal(road.length, 3, 'Geometri Routes tidak dimutasi');
  const exact = c._mRoutePathToPins([
    { lat: () => -5.380964, lng: () => 105.284946 },
    { lat: () => -5.382664, lng: () => 105.280162 }
  ], { lat: -5.380964, lng: 105.284946 }, { lat: -5.382664, lng: 105.280162 });
  assert.equal(exact.length, 2, 'Titik pin yang sudah tepat tidak digandakan');
  assert.equal(c._mRoutes['1'].opts.strokeColor, '#e60023');
  assert.equal(c._mRoutes['1'].opts.strokeOpacity, 1);
  assert.equal(c._mRoutes['1'].opts.icons, undefined, 'Simbol berulang tidak boleh melebihi ujung pin');
  assert.equal(node('mDist_1').textContent, '790 m · 2 mnt');
  assert.match(node('mRouteNoticeText').textContent, /Rute jalan Google aktif/);
  c.mZoomMeasurement(1);
  assert.equal(c._mMap.getZoom(), 15);

  // Bila modern dan kompatibilitas gagal, fallback harus eksplisit dan dapat dicoba lagi.
  modernMode = 'fail';
  c._mRouteClassPromise = null;
  c._mDirSvc.route = (request, done) => done(null, 'ZERO_RESULTS');
  c._mRedraw();
  await settle();
  assert.match(node('mDist_1').textContent, /lurus/);
  assert.equal(c._mRoutes['1'].opts.icons, undefined, 'Garis lurus juga berhenti di koordinat pin');
  assert.equal(c._mRoutes['1'].opts.path.length, 2);
  assert.equal(c._mRoutes['1'].opts.path[0].lat, -5.380964);
  assert.equal(c._mRoutes['1'].opts.path[1].lat, -5.382664);
  assert.match(node('mRouteNoticeText').textContent, /1 dari 1 rute/);

  modernMode = 'success';
  c._mRouteClassPromise = null;
  c._mRedraw();
  await settle();
  c.toggleMeasurementLines();
  assert.equal(c._mRoutes['1'].map, null);
  assert.equal(node('mDist_1').textContent, '790 m · 2 mnt', 'Menyembunyikan garis tidak menghapus jarak');
  assert.equal(node('mLinesToggle').attributes['aria-pressed'], 'false');
  c._mRedraw();
  await settle();
  assert.equal(c._mRoutes['1'].map, null, 'Garis baru juga tersembunyi saat data berubah');

  // Jalur OSM tetap menggunakan garis lurus SVG dan kontrol yang sama.
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
  reduceMotion = true;
  c._mOsmSyncDashAnimation();
  assert.ok(c._mOsmDashFrame !== null, 'Measurement yang diminta tetap bergerak di laptop');
  c._mOsmLines[0].getElement = () => null;
  c._mOsmDashTick(900);
  assert.ok(c._mOsmDashFrame !== null, 'Animasi menunggu SVG Leaflet yang belum dipasang');
  c._mOsmLines[0].getElement = () => c._mOsmLines[0].path;
  c._mOsmDashTick(1000);
  c._mOsmDashTick(1034);
  assert.ok(Math.abs(parseFloat(c._mOsmLines[0].path.style.strokeDashoffset) + 11.76) < 0.001,
    'Jalur SVG bergerak jelas per frame setelah path tersedia');
  c.toggleMeasurementLines();
  assert.equal(c._mOsmDashFrame, null, 'Animasi berhenti ketika garis disembunyikan');
  assert.ok(cancelledFrame > 0);
  c.toggleMeasurementLines();
  c._mOsmSyncDashAnimation();
  c.mZoomMeasurement(-1);
  assert.equal(c._mOsmMap.zoom, 13);
  assert.equal(node('mLinesToggle').attributes['aria-pressed'], 'true');

  // Respons modern yang terlambat dari rute lama tidak boleh menggambar garis kembali.
  c._mOsmActive = false;
  modernMode = 'delay';
  c._mRouteClassPromise = null;
  c._mRedraw();
  await settle();
  c._mClearLayers();
  Route.delayed({ routes: [{ path: road, distanceMeters: 790, durationMillis: 120000, warnings: [] }] });
  await settle();
  assert.equal(Object.keys(c._mRoutes).length, 0);

  assert.match(html, /renderer: L\.svg\(\)/, 'Leaflet memakai jalur SVG');
  assert.doesNotMatch(html, /requestAnimationFrame\(_mDashTick\)/);
  assert.match(html, /\.mmap-zoom \{ grid-column: span 2; \}/);
  assert.match(html, /Route\.computeRoutes/);
  console.log('Measurement: Routes API, fallback, animasi OSM, toggle, zoom, dan respons terlambat OK');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
