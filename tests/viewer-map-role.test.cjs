const test = require('node:test');
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

test('Viewer tidak dapat mengaktifkan Google Maps pada peta utama', () => {
  const notices = [];
  const labels = [];
  const context = vm.createContext({
    activeRole: 'Viewer',
    _currentMapMode: 'osm',
    gMap: null,
    toast: message => notices.push(message),
    _updateModeButtonLabel: mode => labels.push(mode)
  });
  vm.runInContext(extract('_isViewerRole'), context);
  vm.runInContext(extract('switchMapMode'), context);

  assert.equal(context._isViewerRole(), true);
  assert.equal(context._isViewerRole('Admin'), false);
  assert.equal(context.switchMapMode('gmaps'), false);
  assert.equal(context._currentMapMode, 'osm');
  assert.deepEqual(labels, ['osm']);
  assert.match(notices[0], /Viewer.*OpenStreetMap/);
});

test('seluruh pintu masuk Google Maps dikunci untuk Viewer', () => {
  assert.match(extract('applyPermissions'), /_applyViewerMapRestrictions\(role\)/);
  assert.match(extract('_applyViewerMapRestrictions'), /googleOption\.style\.display = viewerOnly \? 'none'/);
  assert.match(extract('_applyViewerMapRestrictions'), /modeButton\.disabled = viewerOnly/);
  assert.match(extract('startDrawingPolygon'), /if \(_isViewerRole\(\)\)/);
  assert.match(extract('toggleHeatmap'), /if \(_isViewerRole\(\)\)/);
  assert.match(extract('_mInitMap'), /if \(_isViewerRole\(\)\) return/);

  const toggleMeasurement = extract('toggleMeasureOSM');
  assert.ok(toggleMeasurement.indexOf('_isViewerRole()') < toggleMeasurement.indexOf('_ensureGoogleMapReady()'),
    'guard Viewer harus dijalankan sebelum Google Maps dimuat');
  assert.match(toggleMeasurement, /_mForceViewerOsmMode\(\)/);
  assert.match(html, /openMeasurement = function\(\) \{\s*_mApplyMeasurementRoleAccess\(activeRole\)/);
});

test('Measurement menampilkan status OSM terkunci yang aksesibel', () => {
  assert.match(extract('_mRenderModeButton'), /btn\.disabled = !!viewerOnly/);
  assert.match(extract('_mRenderModeButton'), /Mode OpenStreetMap terkunci untuk Viewer/);
  assert.match(extract('_mForceViewerOsmMode'), /_mOsmActive = true/);
  assert.match(extract('_mForceViewerOsmMode'), /layerToggle\.hidden = true/);
  assert.match(html, /\.mmap-osm-toggle\.viewer-locked/);
});

